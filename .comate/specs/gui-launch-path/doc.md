# SDD · gui-launch-path

## 背景

v0.1.0 公开发布后用户报告：从 Finder 双击 `Morrow.app` 启动，Home 页无法识别本机已安装的 `codex` / `claude`；但 `pnpm dev` 从终端启动时可以正常识别。

## 根因

macOS 下，`launchd` 给 GUI 程序的默认 `PATH` 只有 `/usr/bin:/bin:/usr/sbin:/sbin`。用户的 CLI 通常安装在：

- Homebrew (Apple Silicon) → `/opt/homebrew/bin`
- Homebrew (Intel) / npm / pip user → `/usr/local/bin`
- `~/.local/bin`、`~/bin`、`~/.cargo/bin`、nvm 管理的 node 目录 等

这些路径只在 shell 启动脚本（`.zshrc` / `.bashrc` / `.profile`）里手动加入，GUI app 看不到。

`pnpm dev` 时 Electron 是由用户的 terminal shell spawn 的，继承完整 PATH，所以当时工作正常。

## 业界参考

- [`sindresorhus/fix-path`](https://github.com/sindresorhus/fix-path) —— 解决同一问题的事实标准库，被 GitHub Desktop / Hyper / Linear 等使用
- 核心机制：启动时 spawn `$SHELL -ilc 'echo $PATH'`，把用户登录 shell（-i interactive, -l login）的 PATH 取回来覆盖到 `process.env.PATH`
- 关键细节：
  1. 只在 GUI 启动时需要，`TERM_PROGRAM` 存在（说明已在 terminal 里）可跳过
  2. 必须设超时（3 秒）避免 shell 卡死主进程
  3. 失败 fallback：手动拼接常见 bin 路径

## 需求与验收

### AC-1 GUI 启动可探测
用户从 Finder 双击 Morrow.app，Home 页正确显示已安装的 `codex` / `claude` 徽标（与 `pnpm dev` 行为一致）。

### AC-2 终端启动不受影响
`pnpm dev`（继承 shell PATH）时行为不变。

### AC-3 失败不崩溃
`$SHELL` 不存在、超时、非零退出等情况下，主进程必须继续启动；降级到 fallback PATH。

### AC-4 首次发送可用
不仅 detect 能找到 CLI，**实际 spawn（`runtime-session.ts`）也必须能找到**——两者共用 `process.env.PATH`，因此只需在 main 入口点修一处。

## 状态所有权与不变量

- **修 PATH 的时机**：main 进程启动最早期，`app.whenReady()` **之前**完成。任何后续 `execFile` / `spawn` 都依赖修好的 PATH
- **不变量**：`process.env.PATH` 修复后必然包含 `/opt/homebrew/bin`、`/usr/local/bin`、`~/.local/bin`（无论 shell 查询是否成功）
- **幂等**：多次调用不重复拼接

## 实现

### 新文件 `src/app/main/shell-path.ts`
- `getShellPathFromLogin(): string | null` —— spawnSync `$SHELL -ilc 'echo $PATH'`，3s timeout，捕获异常返回 null
- `mergePaths(...sources): string` —— 纯函数，按优先级合并且去重（保序）
- `hydrateProcessPath(): void` —— 编排：如 `process.env.TERM_PROGRAM || process.env.MORROW_E2E` 存在则跳过（dev 模式无需修）；否则取 login shell PATH（可空）+ fallback 常量 + 原 PATH → 覆盖 `process.env.PATH`

### 修改 `src/app/main/index.ts`
- 在 `import` 之后、`app.whenReady()` 之前第一行调用 `hydrateProcessPath()`

### 单测 `tests/contract/shell-path.spec.ts`
- `mergePaths`：去重、保序、空串过滤、`~` 不展开（由调用方展开）
- 覆盖 `hydrateProcessPath` 的幂等（多次调用 PATH 长度不增长）

### 非目标
- Windows / Linux 本来就从 desktop environment 继承合理 PATH，不加解决逻辑
- 不引入 `fix-path` 依赖（AGENTS.md §6 避免新顶层依赖，且我们需求只是子集）
- 不做 PATH UI 展示 / 用户自定义（留到 v0.2+）

## 风险

- `$SHELL -ilc` 在某些极端 rc 配置下会超时（e.g. `.zshrc` 里有慢网络命令）→ 3s timeout 兜底
- 用户 shell 输出有杂质（rc 里的 echo）→ 只取最后一行非空内容
- 终端模式下跳过条件 `TERM_PROGRAM` 在 jetbrains / vscode terminal 也存在，恰好覆盖"从 terminal 跑"的所有场景

## 发布

并入 v0.1.1，同步更新 README "Requirements" 与 CHANGELOG。
