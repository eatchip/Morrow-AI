# ADR 0001: 采用 AGENTS.md 作为 Agent 指令开放标准

- **Status**: Accepted
- **Date**: 2026-06-30
- **Deciders**: Morrow 初始团队
- **Tags**: tooling, agent, standard

---

## Context

2026 年 AI 编程 agent 生态已百花齐放：Claude Code、OpenAI Codex CLI、Cursor、Jules、Aider、Zed、Warp、VS Code agent mode、Comate、Gemini CLI、Windsurf、Cline 等。每种工具早期都有自己的指令承载方案：

- Claude Code：`CLAUDE.md`
- Cursor：`.cursorrules` / `.cursor/rules/`
- GitHub Copilot：`.github/copilot-instructions.md`
- Codex：`AGENTS.md`
- Gemini CLI：`GEMINI.md`
- 各类 IDE agent：各自的配置文件

如果项目为每个工具单独维护一套指令，维护成本线性增长，且极易彼此漂移。

2025 年 8 月起，**`AGENTS.md`** 作为开放标准由 OpenAI Codex 发起，Cursor、Google Jules、Factory、Amp、Aider、Goose、OpenCode、Zed、Warp、VS Code、Cognition Devin、UiPath Autopilot、JetBrains Junie 等 20+ 工具陆续采纳。2026 Q1，Claude Code 也原生读取根目录 `AGENTS.md`，不再强依赖 `CLAUDE.md`。目前 GitHub 上已有 60k+ 仓库采用该格式，标准由 Linux Foundation 旗下的 **Agentic AI Foundation** 托管。

Morrow 处于 harness bootstrap 阶段，需要一个**跨 agent 可移植**的指令承载方案。

---

## Decision

**采用 `AGENTS.md` 作为本仓库 AI agent 指令的唯一权威来源。**

- 根目录 `AGENTS.md` 承载硬规则、决策门、non-negotiables
- 子模块可自带 `AGENTS.md`，按开放标准的层级合并语义覆盖根文件
- 保留一个极简 `CLAUDE.md`，其内容仅为 "See AGENTS.md" 与说明，避免双份维护
- **不引入** `.cursorrules` / `.cursor/rules/`（Cursor-only，锁定单一工具生态）

---

## Consequences

### Positive
- 跨 agent 可移植：切换 / 新增工具成本为零
- 单一权威：避免多份指令漂移
- 符合业界主流，后续 agent 工具默认支持
- 可被 Codex 的层级合并语义利用（根 + cwd 合并）

### Negative / Trade-offs
- 某些工具可能还有专有能力（如 Claude Code 的 `context: fork`、Codex 的 `openai.yaml` 元数据）无法通过 `AGENTS.md` 表达，需单独处理
- 对于首次接触 Claude Code 的贡献者，可能习惯找 `CLAUDE.md` — 通过兼容壳缓解

### Neutral
- 未来若引入 skills，将额外采纳 `SKILL.md` 开放标准（Claude / Codex / Gemini / Cursor 均支持），届时另起 ADR

---

## Alternatives Considered

| 方案 | 评估 | 未采纳原因 |
|---|---|---|
| 为每种工具单独维护指令文件 | 控制最精细 | 维护成本爆炸、漂移不可控 |
| 仅用 `CLAUDE.md` | 对 Claude Code 最友好 | 私有格式，锁定单工具，Codex/Cursor 等不读 |
| 仅用 `.cursorrules` | Cursor 体验最好 | 同上，非开放标准 |
| 把规则塞进 `README.md` | 零成本 | README 是给人类看的；agent 识别率不一致，会污染人类导航 |

---

## References

- [AGENTS.md 开放标准](https://agents.md/)
- [Linux Foundation · Agentic AI Foundation](https://www.linuxfoundation.org/)
- [InfoQ 2025: AGENTS.md Emerges as Open Standard](https://www.infoq.com/news/2025/08/agents-md/)
- [OpenAI Codex custom instructions guide](https://developers.openai.com/codex/guides/agents-md)
- 本仓库 `AGENTS.md`、`CLAUDE.md`
