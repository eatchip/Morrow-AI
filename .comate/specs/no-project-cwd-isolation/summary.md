# Summary: no-project-cwd-isolation

Branch / Worktree: `fix/no-project-cwd-isolation` @ `../Morrow-no-project-cwd-isolation`

## 修复了什么

两个并发 bug，统一在「会话未关联项目」这个状态下：

1. **隐私 / UX 实质 bug**：未选项目时，子进程（codex / claude）继承 Electron
   主进程的 `cwd`（dev 模式下就是 Morrow 仓库根目录），导致 Codex 自动加载本仓
   `AGENTS.md`，把 Morrow 自身的工程指令当成"用户项目上下文"塞回回复，并暴露
   开发者的本地路径结构。
2. **死交互**：ProjectPicker 在 `locked && activeProjectId === null` 状态下渲
   染了一个"退出项目"按钮，但点击是 no-op（已是 null，没什么可退）—— 用户
   会以为坏了。

## 改了哪些文件

- `src/app/main/runtime-session.ts` — `StartSessionArgs.cwd` 由可选收敛为必填
  `string`；`spawn` 永远显式带 cwd，再无任何分支放过 OS 默认继承。
- `src/app/main/ipc.ts` — `registerIpc` 内一次性 `mkdirSync(<userData>/no-project-cwd, recursive)`
  得到中性沙盒目录；`projectId === null` 时把它注入 `startSession({ cwd })`。
- `src/app/renderer/src/components/ProjectPicker.tsx` —
  `lockedNoProject = locked && !active` 派生态：触发器文案改"本对话未关联项目"、
  `aria-disabled`、点击 no-op、不再渲染 panel。
- `tests/contract/runtime-session-cwd.spec.ts` — 替换旧"未传 cwd → 字段缺失"
  用例为新契约下的"显式注入沙盒目录"断言。
- `tests/unit/project-picker.spec.tsx` — 新增 locked&&!active 静态化断言（trigger
  非可点击 / 不展开 panel / aria-disabled）。
- `CHANGELOG.md` — `[Unreleased] / Fixed` 段补 `no-project-cwd-isolation` 条目。

## 不变量

- **inv-1**：每一次 `spawn(cli, ...)` 调用，`spawnOptions.cwd` 必为非空字符串
  且为已存在的目录。由 type system（必填 `string`）+ contract test 共同保证。
- **inv-2**：当对话已发送过首条消息（`locked=true`）且 `projectId === null` 时
  ，picker 不暴露任何可触发副作用的 UI 元素。由 unit test 守护。

## 验证

- `pnpm pre-commit` 在 Task 1 / Task 2 commit 时各跑一次，全绿（lint + tsc + 全
  量 vitest 70 用例 + Playwright e2e 2 用例）。
- 手动验证：未选项目 → 发 "hi" → Codex 回复中不再出现 Morrow 的 `AGENTS.md` /
  本机路径；触发器变 `本对话未关联项目` 静态文案，点击无反应。

## 已知限制 & 后续

- 沙盒目录 `<userData>/no-project-cwd/` 永久驻留，不做清理 —— 它本身就是空目
  录，体积忽略不计；如未来要彻底"无文件系统上下文"，可考虑用 OS 临时目录但这
  样每次启动会重建，与 `<userData>` 语义稍冲突。当前方案已经达到隐私目标，未
  做进一步抽象。
- ProjectPicker 静态态没加专门的视觉样式 token（`.static` className 是预留挂
  钩，目前 CSS 未消费）。如后续设计稿要求"灰一点 / 弱化"再补样式，不在本 SDD
  范围内。

## 收尾

- worktree 留给用户决定何时 merge → main / push origin。AGENTS.md §5 的"并发
  写保护"硬规则在本次执行中得到验证，没有踩坑。
