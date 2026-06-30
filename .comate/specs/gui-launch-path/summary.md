# gui-launch-path 收尾

## 结果

**v0.1.1 已发布** → https://github.com/eatchip/Morrow/releases/tag/v0.1.1

## 根因

macOS launchd 给 GUI 进程的默认 PATH 只有 `/usr/bin:/bin:/usr/sbin:/sbin`。用户 CLI (`codex`、`claude`) 通常装在 shell rc 额外加的路径里（`/opt/homebrew/bin`、`/usr/local/bin`、`~/.local/bin`、`~/.local/node/bin`、nvm/asdf 目录等）。GUI 继承不到 → `execFile('codex', …)` 直接 ENOENT。

`pnpm dev` 时 electron 由 terminal 启动，继承了 shell 的完整 PATH，所以开发时看不到这个问题。

## 落地

| 文件 | 类型 | 作用 |
|---|---|---|
| `src/app/main/shell-path.ts` | 新 | `mergePaths()` 纯函数 · `getShellPathFromLogin()` spawn `$SHELL -ilc 'echo $PATH'` · `hydrateProcessPath()` 编排（跳过 TERM_PROGRAM / MORROW_E2E / 非 darwin） |
| `src/app/main/index.ts` | 改 | 首行 `hydrateProcessPath()`，在 `app.whenReady()` 前完成，确保 `detectRuntimes` 与 `runtime-session.spawn` 都拿到正确 PATH |
| `tests/contract/shell-path.spec.ts` | 新 | 7 测试：mergePaths 保序去重 / 空过滤 / null 忽略；hydrateProcessPath 的三条跳过分支 + 幂等 |
| `package.json` | 改 | `0.1.0` → `0.1.1` |
| `CHANGELOG.md` | 改 | `[0.1.1] - 2026-05-12` 段 |

## 实际验证

- 本地 `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin zsh -ilc 'echo $PATH'` 输出包含 `~/.local/node/bin`（即用户 `codex` 所在目录）→ shell 查询机制在极限 PATH 下仍能恢复
- 单测 7/7 通过
- `pnpm pre-commit` 全闸门绿（含 E2E）
- `pnpm dist:mac` 产出 `Morrow-0.1.1-{arm64,x64}.dmg`
- CI (GitHub Actions) 也成功打包并挂到 draft release

## 设计取舍

- **未引入 `fix-path` 依赖**：AGENTS.md §6 新依赖需用户批准；我们需求只是该库的一个子集，内联实现约 80 行代码 + 7 个测试
- **跳过条件选 `TERM_PROGRAM`**：覆盖 Apple Terminal / iTerm / VSCode / JetBrains / Hyper 所有主流 terminal；遗漏 tmux 嵌套等边缘场景可接受
- **只改 darwin**：Windows / Linux 的 GUI 继承 PATH 机制不同（desktop environment 管理），不需要此 hack

## 遗留

- 代码仍未签名（Gatekeeper 首次拦截照旧）
- 如果用户的 `.zshrc` 加载特别慢（>3s）仍可能探测失败 → 未来可考虑缓存上次 PATH 到 user data dir
- `.local/node/bin` 等非常规位置不在 fallback 常量中，完全依赖 shell 查询；shell 查询失败 + 非常规位置的组合场景目前无法解决
