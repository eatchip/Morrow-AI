# SDD `codex-json-schema` · 收尾

## 做了什么

1. **根因**：`codex-cli 0.128+` 变更 `exec --json` 事件 schema，顶层 `type` 取代 `msg.type`；`parseCodexLine` 只认旧 schema，所有新事件 `return null`，UI 持续 `(no output)`。
2. **修复**：`src/app/main/runtime-session.ts` 的 `parseCodexLine` 升级为新旧并集解析器，覆盖 `item.completed + agent_message` / `item.completed + error` / 生命周期静默 / 顶层 error 兜底；旧 `msg.type` 分支保留作向后兼容。
3. **测试**：`tests/contract/runtime-parse.spec.ts` 新增 4 条用例，覆盖新 schema 所有路径。`pnpm pre-commit` 全闸门 + E2E 烟测全绿。
4. **活体验证**：把 `echo "..." | codex exec --json --skip-git-repo-check -` 的真实输出喂进 `parseCodexLine`，产出 `["pong"]`，证明不再吞事件。

## 沉淀的可复用资产

- **代码**：解析器注释头写明两种 schema 及其对应 codex-cli 版本，避免后续误改。
- **测试**：4 条新用例作为协议回归锚点。
- **规则升级**：AGENTS.md §5 "并发写保护" 从"提醒"升级为"必须用 `git worktree`"硬规则，原因是本次 SDD 过程中发现并发 AI 会话在主目录 `checkout -b` 会互相吞噬 WIP（这个教训独立成一个 commit `docs(agents): mandate git worktree ...`）。
- **提示词模板**：下次并发任务用户可直接说"**新开 worktree 和分支，做以下任务：XX**"，触发 worktree 路径。

## 产物

- 分支：`fix/codex-json-schema`（worktree 位于 `../Morrow-codex-fix/`）
- Commits:
  - `dadf4a4` fix(runtime): adapt codex-cli new JSONL schema · restore Codex chat output
  - `c50fb19` docs(agents): mandate git worktree for concurrent AI sessions · prevent working tree collisions
- 改动文件：`src/app/main/runtime-session.ts` / `tests/contract/runtime-parse.spec.ts` / `CHANGELOG.md` / `AGENTS.md` + `.comate/specs/codex-json-schema/{doc,tasks,summary}.md`

## 已知限制与后续

- 新 CLI 不再输出 `agent_message_delta`，Morrow 目前对每条 `agent_message` 一次性渲染，**首字节延迟 = 总延迟**。需要真流式体验应另起 SDD 研究 `codex proto` / MCP 协议或其它方案，本次不做。
- 本次修复未触碰 Claude runtime、IPC 契约、detect 逻辑，渲染层零改动。
- GUI 端到端验证（打开 `.app` 手动发送 prompt）请用户自行确认一次；脚本级打通已验证。

## 并发事故后记

本任务执行中触发了一次多会话协作事故：另一个并发 AI 会话在主仓执行了 `git checkout` + 若干未提交编辑，我的工作树在毫无感知的情况下被切到了对方分支并叠加了对方 WIP。AGENTS.md §8 的 Escalation 流程起作用，停下来告知用户；随后通过 `git worktree add ../Morrow-codex-fix fix/codex-json-schema` 把我的改动重放到独立工作区，干净提交，未污染对方 WIP。新的 AGENTS.md 规则确保同类事故不再发生。

## 收尾动作（用户指引）

确认 `origin` 是否允许直推 `fix/codex-json-schema`；如需：

```bash
cd /Users/songhuiyu/Morrow-codex-fix
git push -u origin fix/codex-json-schema
```

不再需要时清理 worktree：

```bash
cd /Users/songhuiyu/Morrow
git worktree remove ../Morrow-codex-fix
# 分支合入后删除：git branch -d fix/codex-json-schema
```
