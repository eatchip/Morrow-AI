# Spec: no-project-cwd-isolation

修复"未选择项目时"的两类语义错误：

1. **Bug A — 隐式 cwd 泄漏**：未选择任何项目时，发送 prompt 调用 `spawn(codex|claude, ...)` 不传 `cwd`，子进程**继承 Electron 主进程的 cwd**（开发态为 `/Users/<u>/Morrow`，打包后为 `/`）。结果是 Codex CLI 自动加载了该目录的 `AGENTS.md` 并把它当作"当前项目"，与用户的"我没选任何项目"心智模型不符，且构成隐式文件系统/隐私越界。
2. **Bug B — 错误的"退出项目"入口**：当对话 `pickerLocked === true` 但 `activeProjectId === null`（典型场景：在未选择项目状态下发送了第一条消息，会话 projectId 被定版为 null），ProjectPicker 仍然渲染"退出项目"按钮；点击后 `onSelect(null)` 与当前状态相同，无任何效果。

## 1. 背景与现状

### 数据流（送 prompt）

`Composer → App.send → window.morrowApi.sendPrompt({projectId})` 走 IPC `send-prompt`：

- `src/app/main/ipc.ts:30-55`：当 `projectId` 为 null/undefined → `cwd = null` → `startSession({cwd: null})`。
- `src/app/main/runtime-session.ts:170-177`：

  ```ts
  const spawnOptions: SpawnOptionsWithoutStdio = { env: sanitizedEnv(), shell: false };
  if (args.cwd) {
    spawnOptions.cwd = args.cwd;
  }
  child = spawn(bin, cmdArgs, spawnOptions);
  ```

  → `cwd` 缺省时 `spawn` 直接继承 `process.cwd()`。Electron 主进程在开发态 `process.cwd() === /Users/songhuiyu/Morrow`，于是 Codex 把仓库当成项目。

### Picker 锁定语义

`src/app/renderer/src/App.tsx:222-223`：

```ts
const pickerLocked = !!activeConv && activeConv.messages.some((m) => m.role === 'user');
```

只看是否发过消息，与是否选过项目正交。`ProjectPicker.tsx:69-79`：

```tsx
{locked ? (
  <button … onClick={() => { onSelect(null); close(); }}>退出项目</button>
) : ( … )}
```

即使 `active === null` 也会展示"退出项目"按钮，点击是 no-op。

## 2. 业界最佳实践参考

- **不可信 cwd**：Node `child_process.spawn` 文档明确"未指定时继承父进程 cwd"——把 Electron 主进程的 cwd 直接交给 LLM CLI 是反模式。VS Code、Zed、Cursor 在"无 workspace"模式下都会显式 sandbox 到一个空目录或临时目录，避免无意泄漏当前目录的 source。
- **Locked dropdown empty-state**：成熟产品（Linear / Notion / Arc）在"目标即当前态"时，要么把触发器渲染成纯静态标签（不可点击），要么 panel 里给出"无可用操作"提示，避免出现按了等于啥都没做的孤立按钮。

## 3. 不变量（Invariants）

- **I1**：CLI 子进程的 `cwd` **永远是显式选择的结果**，绝不允许"用户视角下未选择项目"的会话静默落到任意有意义的目录上。
- **I2**：ProjectPicker 在 panel 中渲染的每个动作项都对应一个**会改变状态的行为**；对当前状态而言的 no-op 不允许出现。
- **I3**：会话的 `projectId` 一经定版（首条用户消息发送），UI 锁定语义不再改变；但展示出的可达动作集合必须随 `activeProjectId` 调整。

## 4. 修复方案

### Fix A — 显式 "no-project" cwd 隔离

修改 `src/app/main/runtime-session.ts`：当 `args.cwd` 为 null 时，**强制将 `spawnOptions.cwd` 设为一个 Morrow 拥有的、空白的目录**，使 Codex/Claude 无法读取任何用户工程或仓库源码。

实现方式：

- 在主进程启动时（`ipc.ts` 注册阶段或 `index.ts`）准备 `app.getPath('userData')/no-project-cwd/`，确保存在且为空（不写入 AGENTS.md / 任何配置）。
- `startSession` 接受新参数 `noProjectCwd: string`（由调用方注入），当 `args.cwd` 为 null 时使用它；不再 fallback 到 `process.cwd()`。
- 不引入新顶层依赖。`fs.mkdirSync(..., { recursive: true })` 即可。

> 备选方案考量（已淘汰）：
> - `os.tmpdir()`：每次进程不同 path，且可能含其他 app 的临时文件，不可控。
> - `os.homedir()`：用户 home 通常含 `~/AGENTS.md`、`~/.codex` 等，反而更糟。
> - 阻止"无项目发送"：违反产品已存在的"全局问答"形态，且与 bug B 无关，扩大改动面，拒绝。

主进程文件：

- `src/app/main/ipc.ts`
  - 在 `registerIpc` 中计算 `noProjectCwd = path.join(app.getPath('userData'), 'no-project-cwd')` 并 `fs.mkdirSync(..., { recursive: true })`；传给 `startSession`。
  - `cwd === null` 分支保留（projectId 为 null 时不去查 store）。

- `src/app/main/runtime-session.ts`
  - `StartSessionArgs.cwd: string | null` → `cwd: string`（必填），由调用方解析。
  - 若仍想保留 null 表达，则文档里说明"null 视作 no-project，由 caller 替换"——但实际把 null 收敛到 caller 更干净。

### Fix B — Locked 模式下根据 active 切换可达动作

修改 `src/app/renderer/src/components/ProjectPicker.tsx`：

- 当 `locked && !active`：**触发器渲染为静态标签（不可点击/不展开 panel）**。文案："本对话未关联项目"。
- 当 `locked && active`：维持现有"展开 → 退出项目"行为。
- 触发器视觉上保持与 `has-project` 相同的 token（不新增颜色）。

最小代码变更：

```tsx
const lockedNoProject = locked && !active;
// onClick 中 if (lockedNoProject) return;
// aria-haspopup/aria-expanded 在 lockedNoProject 时设为 false
// caret 已经在 locked 时隐藏，无需改
```

## 5. 影响文件

| 文件 | 修改类型 | 关键点 |
|---|---|---|
| `src/app/main/runtime-session.ts` | 修改 | `StartSessionArgs.cwd` 收敛为 `string`；移除 `if (args.cwd) {…}` 分支，永远显式传 cwd |
| `src/app/main/ipc.ts` | 修改 | 准备 `noProjectCwd` 目录；`projectId === null` 时把 `cwd` 设为该目录 |
| `src/app/renderer/src/components/ProjectPicker.tsx` | 修改 | `locked && !active` 时触发器变成静态标签 |
| `tests/unit/...` 新增 | 测试 | (1) 主进程 `startSession` 无 cwd 时不再继承 process.cwd；(2) ProjectPicker 在 `locked && !active` 时不展开 panel |

## 6. 边界与异常

- `userData` 目录在 first-run 不存在 → `mkdirSync recursive` 兜底。
- 用户手动删除该目录 → 下次启动重建（`registerIpc` 每次都 `mkdirSync`）。
- 已存在 e2e 期望：no project 发 prompt 也能成功 → 新行为下子进程 cwd 改变，不影响 IPC 协议；除非 e2e 断言了 cwd，需要 grep 一遍。
- 跨平台：`app.getPath('userData')` 在 macOS / Windows / Linux 均有效。

## 7. 验收标准

- 启动 app，不添加任何项目，新建对话直接发送 "hi"：Codex 回复中**不再**出现 `AGENTS.md instructions for /Users/<u>/Morrow` 与 `当前工作目录: /Users/<u>/Morrow`。
- 同一对话再次发送，结果一致；多对话并行无串扰。
- 上述对话被首条 user msg 定版后，picker 触发器显示"本对话未关联项目"且**不可展开**；不再出现 no-op 的"退出项目"。
- 既有 use case：选了项目后发消息，picker 仍能展开并显示"退出项目"，能切回 null。
- `pnpm pre-commit` 全绿（lint / type / unit / e2e gates）。

## 8. 风险

- Codex CLI 可能仍读取 `~/.codex/` 全局配置，那不是本 SDD 范围（用户全局配置属于自愿）。
- 若 Electron 主进程未来改 cwd 策略（例如启动时主动 chdir），本修复仍然 robust，因为 cwd 永远显式指定。
