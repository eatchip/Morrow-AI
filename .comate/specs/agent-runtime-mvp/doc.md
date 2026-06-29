# Spec · agent-runtime-mvp

> 把桌面上的 `morrow-mvp.html` 静态原型，替换成一个跑在 Electron 里、真正能调起本机 `claude` / `codex` 的 MVP。
> 完成后用户打开 `pnpm dev` 就能输入一句话、得到 Claude Code 或 Codex CLI 的流式回复。

任务规模判定：**Large**
- 跨进程（main / preload / renderer）接口契约
- 运行时风险：子进程生命周期、stdout 流式解析、取消 / 清理
- 对外接口：首次引入 `window.morrowApi`，将成为后续所有 SDD 的基座

视觉稿前置闸门：🔴 新页面 / 新 Flow
- 视觉稿已由用户确认：`/Users/songhuiyu/Desktop/morrow-mvp.html`（静态 HTML + JS mock，4 屏状态机 + 暗色 Linear/Arc 混合语言）
- 本 SDD 不重新设计 UI，仅"把原型移植进 Electron 并接上真实 IPC"。
- 像素级复刻该 HTML 的 token（颜色、间距、圆角、字体栈）；因 `design-tokens-enforcement` SDD 尚未落地，本期将 HTML 中的 CSS 变量**直接搬进** `src/app/renderer/src/index.css`，不建新组件库、不抽象 primitive，等 design-tokens-enforcement SDD 统一收敛。

---

## 1. 背景与范围

### 1.1 产品意图
Morrow 当前 MVP 的唯一定位：**本机 AI CLI 的前端驾驶舱**。
- 不管模型、不管鉴权、不管对话历史。
- 只负责：检测 → 展示 → 转接 prompt → 流式回显。
- "真正干活的"是用户已经登录过的 `claude` / `codex` 子进程。

### 1.2 In Scope
1. 启动时探测 `claude --version` / `codex --version`，展示 Splash 检测动画。
2. 4 屏状态机：`splash → install`（都没装）/ `home`（至少一个） → `chat`（发送后）。
3. 在 Home / Chat 能切换当前 runtime（仅能切到已安装的）。
4. 输入框回车 → 主进程 spawn 对应 CLI → stdout 流式回写到 Chat 气泡。
5. 可取消（Esc 返回 Home 即中止当前 spawn）。
6. CLI 不存在 / 未登录 / 非 0 退出 → 在 Chat 流末尾显示一条红色错误行。
7. 纯会话内存：关窗即清空，本期不做持久化。

### 1.3 Out of Scope（明确不做）
- ❌ 对话历史持久化、多会话管理、恢复（`claude -c` / `codex resume`）
- ❌ Markdown / 代码块高亮渲染（本期 `white-space: pre-wrap` 纯文本）
- ❌ 设置面板、模型选择、快捷键自定义、主题切换
- ❌ 自动安装 CLI（Install 屏只给文档链接 + 命令示例）
- ❌ 登录态检测与引导（CLI 自己会在 stdout 里说 "Not logged in"，我们原样透出）
- ❌ 文件附件、图片输入、工具调用审批 UI
- ❌ Debug bar（原型里那一排 scene 切换按钮，移植时直接删掉）

### 1.4 Feasibility（已手动验证）
| 探测点 | 命令 | 结果 |
|---|---|---|
| Claude Code 存在且可版本查询 | `claude --version` | `2.1.133 (Claude Code)` |
| Claude 非交互流式 | `claude -p "..." --output-format stream-json --include-partial-messages --verbose` | NDJSON，每行一个 event，`type: "assistant"` 含 `message.content[].text` |
| Claude 未登录 | 同上 | 返回 `{is_error:true, result:"Not logged in · Please run /login"}` — 需要原样透出 |
| Codex CLI 存在且可版本查询 | `codex --version` | `codex-cli 0.128.0` |
| Codex 非交互流式 | `codex exec --json "..."` | JSONL 事件流 |
| Codex 在非 git 仓库 | 需 `--skip-git-repo-check` | 是否开启延到 Plan 一起定（本 repo 是 git repo，默认不需要） |

结论：可行；两者都支持"一句 prompt → JSONL 事件 → 结束退出"。

---

## 2. 架构与技术方案

### 2.1 三进程职责划分

```
┌──────────────┐    IPC (typed)    ┌──────────────┐   child_process   ┌──────────────┐
│   Renderer   │ ────────────────▶ │     Main     │ ───── spawn ────▶ │ claude/codex │
│ (React UI)   │ ◀──────────────── │ (Supervisor) │ ◀──── stdout ──── │   (subproc)  │
└──────────────┘  stream:chunk evt └──────────────┘                   └──────────────┘
                                         ▲
                                         │ expose via
                                   ┌──────┴──────┐
                                   │   Preload   │  contextBridge → window.morrowApi
                                   └─────────────┘
```

- **Main** 独占：PATH 解析、child_process、版本缓存、session 状态机。
- **Preload** 只做：把 IPC 信道包一层 Promise + EventEmitter 式订阅，暴露到 `window.morrowApi`。
- **Renderer** 只消费 API：不 `require`，不 `ipcRenderer`，不操作文件系统。

### 2.2 IPC 契约（本 MVP 的公共接口）

```ts
// src/shared/ipc.ts （新增，用于 main/preload/renderer 三端共享类型）
export type RuntimeId = 'claude' | 'codex';

export interface RuntimeInfo {
  id: RuntimeId;
  installed: boolean;
  version: string | null;       // e.g. "2.1.133"
  binaryPath: string | null;    // 探测到的绝对路径
  error: string | null;         // 探测失败原因（stderr 头 200 字符）
}

export interface DetectResult {
  claude: RuntimeInfo;
  codex: RuntimeInfo;
}

export interface SendPromptArgs {
  runtime: RuntimeId;
  prompt: string;
  sessionId: string;            // renderer 生成的 uuid，用于多条并发/取消路由
}

// 主进程推给渲染层的流式事件
export type StreamEvent =
  | { sessionId: string; kind: 'chunk'; text: string }    // 文本增量
  | { sessionId: string; kind: 'done'; exitCode: number } // 正常结束
  | { sessionId: string; kind: 'error'; message: string };// 异常/非 0 退出

// window.morrowApi 形状
export interface MorrowApi {
  detectRuntimes(): Promise<DetectResult>;
  sendPrompt(args: SendPromptArgs): Promise<void>;      // 立即 resolve，数据走 onStream
  abortSession(sessionId: string): Promise<void>;
  onStream(listener: (e: StreamEvent) => void): () => void; // 返回 unsubscribe
}
```

IPC 信道命名（main 侧注册）：
- `runtime:detect`（invoke / handle）
- `runtime:send-prompt`（invoke / handle，仅作为启动信号，ack 后立即返回）
- `runtime:abort`（invoke / handle）
- `runtime:stream`（webContents.send，单向，渲染层订阅）

### 2.3 检测策略（main 侧）

`src/app/main/runtime-detect.ts`:
1. 对 `claude` / `codex` 分别 `spawn(cmd, ['--version'], { shell: false })`；
   - macOS / Linux：先用 `execFile('/usr/bin/env', ['-S', cmd, '--version'])` 让 PATH 生效；
   - 如果 `ENOENT` → `installed = false`；
2. 3 秒超时，超时按未安装处理；
3. 解析 stdout 头一行版本号（正则 `/\b(\d+\.\d+\.\d+)\b/`），捕获即 `installed = true`；
4. 结果在主进程内存缓存（本期不写磁盘），触发 `runtime:detect` 时直接 re-probe；如果 renderer 触发是从 Splash 或"重新检测"按钮来的，强制重新探测。

### 2.4 spawn 策略（main 侧）

`src/app/main/runtime-session.ts`:

| runtime | 命令与参数 |
|---|---|
| claude | `claude -p <prompt> --output-format stream-json --include-partial-messages --verbose` |
| codex  | `codex exec --json --skip-git-repo-check -` （prompt 从 stdin 传入，避免命令行引号/长度问题） |

通用规则：
- `spawn(binPath, args, { cwd: app.getPath('home'), env: sanitizedEnv, shell: false, stdio: ['pipe','pipe','pipe'] })`
- `env`：继承 `process.env` 但**移除** `ELECTRON_RUN_AS_NODE`（已有先例，见 Playwright launcher）
- `stdin` 直接写 prompt 再 `end()`
- stdout 按行切（`readline.createInterface`），每行 `JSON.parse` 包 try/catch；失败的行视为"裸文本"直接透传
- 文本提取：
  - Claude 事件 `type === 'assistant' && message.content[].type === 'text'` → `message.content[i].text`
  - Codex 事件 `msg.type === 'agent_message' || msg.type === 'agent_message_delta'` → `msg.message` / `msg.delta`
  - 任何无法识别的 JSON 事件：忽略（保底），不 crash
- stderr 聚合 → 子进程退出码非 0 时作为 `error.message` 发出
- `abort` → `child.kill('SIGTERM')`，2 秒后仍未退出 → `SIGKILL`
- 窗口关闭 → 主进程 `app.before-quit` 里 `kill` 所有在飞会话

### 2.5 Renderer 状态机

单文件就够，暂不引状态管理库：

```ts
type Scene = 'splash' | 'install' | 'home' | 'chat';
interface AppState {
  scene: Scene;
  runtimes: DetectResult | null;
  current: RuntimeId | null;       // 只能指向 installed === true
  messages: Msg[];                 // 当前会话（关窗即丢）
  streaming: { sessionId: string; runtime: RuntimeId } | null;
}
type Msg =
  | { role: 'user'; text: string }
  | { role: 'ai'; runtime: RuntimeId; text: string; status: 'streaming'|'done'|'error'; error?: string };
```

状态迁移（合法的）：
- `splash` → detect 完成 → 两个都没装: `install`；否则 `home`
- `install` → 点"重新检测": `splash`
- `home` → 发送 prompt: 追加 user msg + 占位 ai msg, `scene = chat`, `streaming = {...}`
- `chat` → 收到 `stream:chunk`: 追加到最后一条 ai msg 的 text
- `chat` → 收到 `stream:done`: `streaming = null`, ai msg `status = 'done'`
- `chat` → 收到 `stream:error`: `streaming = null`, ai msg `status = 'error'`
- `chat` 空会话 + Esc: `scene = home`（若有 streaming → 先 abort）
- `home/chat` → 点 runtime badge: 仅切换 `current`，不重置会话

### 2.6 目录 & 文件清单

| 路径 | 新增 / 修改 | 说明 |
|---|---|---|
| `src/shared/ipc.ts` | 新增 | § 2.2 类型 |
| `src/app/main/runtime-detect.ts` | 新增 | 检测逻辑 |
| `src/app/main/runtime-session.ts` | 新增 | spawn / 流 / 终止 |
| `src/app/main/ipc.ts` | 新增 | 注册所有 `runtime:*` handler |
| `src/app/main/index.ts` | 修改 | 调用 `registerIpc(mainWindow)` + app.before-quit 清理 |
| `src/app/preload/index.ts` | 修改 | 用 `contextBridge.exposeInMainWorld('morrowApi', ...)` 暴露 § 2.2 API |
| `src/app/preload/index.d.ts` | 修改 | 声明 `window.morrowApi: MorrowApi` |
| `src/app/renderer/src/App.tsx` | 重写 | 4 屏状态机主壳 |
| `src/app/renderer/src/screens/Splash.tsx` | 新增 | 检测动画 |
| `src/app/renderer/src/screens/Install.tsx` | 新增 | 两张安装卡 |
| `src/app/renderer/src/screens/Home.tsx` | 新增 | hero + composer + runtime strip |
| `src/app/renderer/src/screens/Chat.tsx` | 新增 | 消息流 + 底部 composer |
| `src/app/renderer/src/components/Composer.tsx` | 新增 | 复用输入框（Home/Chat 都用它） |
| `src/app/renderer/src/components/RuntimeBadge.tsx` | 新增 | 顶部右侧切换 popover |
| `src/app/renderer/src/lib/stream.ts` | 新增 | `useStream()` hook，订阅 `window.morrowApi.onStream` |
| `src/app/renderer/src/index.css` | 修改 | 从 `morrow-mvp.html` 搬 `:root` tokens + 4 屏样式 |
| `src/app/renderer/index.html` | 修改 | 加 Google Fonts link + wordmark title |
| `tests/unit/runtime-parse.spec.ts` | 新增 | 解析 claude/codex JSONL 的纯函数测试（§ 5） |
| `tests/contract/preload-api-shape.spec.ts` | 修改 | 从 "frozen empty" 改为断言 MorrowApi 5 个方法存在 |
| `tests/e2e/mvp-smoke.spec.ts` | 新增 | Playwright mock 下跑通 splash→home→chat（§ 5） |

**新增 14 个文件** — 符合 AGENTS.md §1.3（每个都在此 Spec 中说明必要性）。

### 2.7 文件行数约束
Golden Rule 之外，`scripts/check-max-lines.mjs` 限制 400 行。
- `App.tsx` 拆成 4 个 Screen 组件后，每个预计 < 120 行
- `runtime-session.ts` 约 150 行，独立
- `index.css` 预计 350 行（移植自 HTML 的样式），若超限再拆 `screens.css` / `components.css`

---

## 3. 关键代码草稿

### 3.1 Preload（替换当前 frozen-empty 版本）

```ts
// src/app/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { MorrowApi, StreamEvent } from '../../shared/ipc';

const api: MorrowApi = {
  detectRuntimes: () => ipcRenderer.invoke('runtime:detect'),
  sendPrompt: (args) => ipcRenderer.invoke('runtime:send-prompt', args),
  abortSession: (sessionId) => ipcRenderer.invoke('runtime:abort', sessionId),
  onStream: (listener) => {
    const wrapped = (_: unknown, e: StreamEvent) => listener(e);
    ipcRenderer.on('runtime:stream', wrapped);
    return () => ipcRenderer.off('runtime:stream', wrapped);
  },
};
contextBridge.exposeInMainWorld('morrowApi', api);
```

### 3.2 Main 注册（节选）

```ts
// src/app/main/ipc.ts
import { ipcMain, BrowserWindow } from 'electron';
import { detectRuntimes } from './runtime-detect';
import { startSession, abortSession, killAll } from './runtime-session';

export function registerIpc(win: BrowserWindow) {
  ipcMain.handle('runtime:detect', () => detectRuntimes());
  ipcMain.handle('runtime:send-prompt', (_, args) =>
    startSession(args, (evt) => win.webContents.send('runtime:stream', evt)),
  );
  ipcMain.handle('runtime:abort', (_, sessionId) => abortSession(sessionId));
  return { cleanup: killAll };
}
```

### 3.3 Claude stdout 解析（单元可测的纯函数）

```ts
// src/app/main/runtime-session.ts （节选）
export function parseClaudeLine(line: string): string | null {
  try {
    const e = JSON.parse(line);
    if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
      return e.message.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');
    }
    if (e.type === 'result' && e.is_error) return `\n[error] ${e.result}`;
  } catch { /* 裸文本直出 */ return line; }
  return null;
}

export function parseCodexLine(line: string): string | null {
  try {
    const e = JSON.parse(line);
    if (e.msg?.type === 'agent_message_delta') return e.msg.delta ?? '';
    if (e.msg?.type === 'agent_message')       return '';  // 完整版已被 delta 覆盖，跳过
    if (e.msg?.type === 'error')               return `\n[error] ${e.msg.message ?? ''}`;
  } catch { return line; }
  return null;
}
```

> 这两个函数是本 MVP 最脆弱的点（外部 schema，随版本可能变）—— § 5 必须有单元测试兜底。

---

## 4. 不变量与边界

### 4.1 不变量（优先于场景枚举）
1. **`state.current` 永远指向 `installed === true` 的 runtime，或为 `null`**。
2. **同一时刻每个 `sessionId` 最多一个活跃 child_process**；关窗时全部被 kill。
3. **渲染层从不直接 spawn 或访问文件系统**；所有副作用走 `window.morrowApi`。

### 4.2 边界校验（AGENTS.md §1.5）
- 进入 `runtime:send-prompt`：校验 `runtime ∈ {'claude','codex'}`、`prompt` 非空字符串、`sessionId` 是 UUID v4 形状。失败直接抛（renderer 按 error 事件展示）。
- 进入 `runtime:abort`：`sessionId` 不存在 → 静默成功（幂等）。

### 4.3 异步 / 生命周期风险
- **spawn 泄漏**：window 关闭、app 退出 → `app.before-quit` → `killAll()`。
- **stdout 背压**：readline 按行推，不缓存全量；单行 > 1MB 截断（防恶意输出）。
- **renderer 乱序**：用 `sessionId` 路由；老 session 的 chunk 到达时，若渲染层已切 scene/runtime，UI 丢弃。
- **检测超时**：3 秒未返回 → 视为未安装。

---

## 5. 验收标准（AC）

### 5.1 功能 AC
- [ ] `pnpm dev` 启动，Splash 在 ~1s 内显示两行检测结果（本机 claude ✓ 2.1.133 / codex ✓ 0.128.0）。
- [ ] 两个都装好 → 自动跳 Home，默认选中 Claude Code。
- [ ] 把 `claude` 临时 rename（`mv ~/.local/bin/claude ~/.local/bin/claude.bak`）再启动 → Home 只显示 Claude 为灰色不可选，默认选中 Codex。
- [ ] 两个都 rename → Splash 跳 Install，点"重新检测"会回 Splash 重新探测。
- [ ] 在 Home 输入 "hello in 3 words" 回车 → 秒级切到 Chat，ai 气泡出现 streaming 光标，接到文本逐步填入（Claude 未登录场景下透出 "Not logged in · Please run /login" 作为 ai 文本，不崩溃）。
- [ ] 切换 runtime badge：仅 installed 的可点；切换后 hint 文本同步更新，当前流不中断。
- [ ] Esc 在 Chat 中：若 streaming → abort + 回 Home；若已 done → 直接回 Home。
- [ ] 关窗后 `ps -ef | grep -E 'claude|codex'` 没有残留 Morrow 起的子进程。

### 5.2 工程 AC
- [ ] `pnpm type-check` 过：`MorrowApi` 三端（main/preload/renderer）签名一致。
- [ ] `pnpm test` 过：`parseClaudeLine` / `parseCodexLine` 对 10+ 条真实样本行回归。
- [ ] `pnpm test:e2e` 过：新增 `mvp-smoke` — 通过 mock `window.morrowApi` 验证状态机迁移（不 spawn 真实 CLI）。
- [ ] `pnpm pre-commit` 过：所有 8 步闸门绿灯。
- [ ] 无文件超过 400 行；新文件均被 `tests/contract/preload-api-shape.spec.ts` 或单元测试覆盖。

### 5.3 非 AC（特意留口）
- 不校验回复 Markdown 渲染效果、代码块样式 — 本期纯文本即可。
- 不校验多轮对话上下文 — 每次 `sendPrompt` 都是独立一次 CLI invocation。

---

## 6. 风险与回滚

| 风险 | 可能性 | 后果 | 缓解 |
|---|---|---|---|
| Claude/Codex JSONL schema 升级打破解析 | 中 | 文本无输出 | `parseXxxLine` 未识别事件一律忽略 + 单元测试锁 10 条样本；失败时 stderr 原样透出，用户能看到"为啥没输出" |
| 用户 PATH 没被 Electron 继承（launchd 启动） | 中（macOS 双击 icon 起 app 常见） | 检测全为 not installed | 主进程 spawn 前先从登录 shell 读 PATH（`execFile('/bin/zsh', ['-lic', 'echo $PATH'])`） —— 本期先不做，装在文档里说"请在终端用 `pnpm dev` 启动"；延到后续 SDD `path-inheritance` 处理 |
| 子进程卡死不退出 | 低 | 关窗后僵尸进程 | SIGTERM + 2s SIGKILL 兜底 + `app.before-quit` killAll |
| 某条 stdout 过长（数 MB 代码块） | 低 | renderer 卡顿 | 单行 >1MB 截断；本期 MVP 不追求大块高亮 |

**回滚策略**：整个 MVP 是 14 个新文件 + 3 个轻改。如果合并后用户发现体验不达标，`git revert` SDD 对应的所有 commit 即可 —— 渲染层回到 scaffold 的占位 `<p>scaffold ok</p>`，不影响已落地的脚手架。

---

## 7. 预期数据流（一次完整发送）

```
[Home]                [Preload]          [Main]                        [CLI]
 enter "hi"  ───────▶ sendPrompt ──────▶ runtime:send-prompt
                                          │ validate args
                                          │ spawn('claude', [...])
                                          └──── stdin.write("hi\n") ──▶
                                                                     │
                                                         ◀─── line ──│ {"type":"system",...}
                                       parseClaudeLine → null (忽略)
                                                         ◀─── line ──│ {"type":"assistant",...}
                                       parseClaudeLine → "Hi!"
               ◀── webContents.send('runtime:stream',{kind:'chunk',text:'Hi!'})
onStream → append to ai msg
                                                         ◀─── exit 0
               ◀── send {kind:'done', exitCode:0}
onStream → status='done', 关闭打字光标
```

---

## 8. 参考

- ADR 0004 · 技术栈（Electron + electron-vite + React + pnpm 已落地）
- ADR 0005 · Design North Stars（Linear 骨架 + Arc 血肉）
- `morrow-mvp.html` · 静态 UI 原型（4 屏 + mock IPC，用户已确认视觉）
- Claude Code CLI docs · `--output-format stream-json` / `--include-partial-messages`
- OpenAI Codex CLI · `codex exec --json` 事件流
- Electron 安全默认值 · contextIsolation + sandbox（已在 `window.ts` 配置）
