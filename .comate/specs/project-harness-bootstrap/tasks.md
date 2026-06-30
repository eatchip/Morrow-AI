# Morrow Harness Bootstrap 任务计划

每个顶层任务独立可验收。建议顺序执行，但 Task 3/4/5/6 之间可并行。

- [x] Task 1: 建立仓库基础卫生文件（编辑器 / VCS / 忽略规则）
    - 1.1: 创建 `.editorconfig`（UTF-8、LF、trim trailing、insert final newline、indent 约定）
    - 1.2: 创建 `.gitattributes`（文本行尾统一 LF、常见二进制标记）
    - 1.3: 创建 `.gitignore`（OS: .DS_Store / Thumbs.db；IDE: .idea / .vscode 例外；logs / env / dist / node_modules 等通用项）
    - 1.4: 创建 `docs/architecture/.gitkeep` 与 `.comate/specs/.gitkeep` 占位

- [x] Task 2: 产出核心 Agent 指令文件 `AGENTS.md`
    - 2.1: 撰写 § 0 First Read 与开放标准声明
    - 2.2: 撰写 § 1 Golden Rules（project-agnostic 铁律，不涉及业务）
    - 2.3: 撰写 § 2 Decision Framework（Small vs Large 判定规则与升级触发器）
    - 2.4: 撰写 § 3 Pre-Coding Checks（所有权 / 不变量 / 异步边界 / 合规）
    - 2.5: 撰写 § 4 Workflow（Plan → Code → Verify → Handoff，SDD 入口说明）
    - 2.6: 撰写 § 5 Commit Hygiene（message 格式、提交粒度、CHANGELOG 联动）
    - 2.7: 撰写 § 6 Out of Scope（未经批准禁止行为清单）
    - 2.8: 撰写 § 7 Setup & Commands（指向 DEVELOPMENT.md，留 TBD）
    - 2.9: 自检行数 ≤ 150，无业务判断

- [x] Task 3: 产出开发方法论文件 `DEVELOPMENT.md`
    - 3.1: Index 导航与"如何使用本文件"
    - 3.2: Setup / 项目结构（TBD 占位，明确依赖哪个 ADR）
    - 3.3: 核心编码原则（复用优先 / 状态所有权 / 边界清洁 / 关注点封装 / 结构清晰优于补丁堆叠）
    - 3.4: 架构执行触发器（何时从 Small 升到 Large、何时重构而非打补丁）
    - 3.5: 高风险问题预防策略（状态分类、不变量优先、按风险层分配测试）
    - 3.6: Research → Synthesize → Adapt → Verify 方法论
    - 3.7: 风险与合规检查清单（异步 gap / 并发 / 边界 / IPC / 资源生命周期 / 性能 / 数据完整性）
    - 3.8: Pre-commit 闸门（命令 TBD，顺序与职责先定义）
    - 3.9: Observability / Logging 通用原则
    - 3.10: 安全通用规则（密钥、输入校验、沙箱边界）

- [x] Task 4: 产出兼容壳与人类入口
    - 4.1: 创建 `CLAUDE.md`，内容仅为 "See AGENTS.md" 一行 + 简短解释
    - 4.2: 重写 `README.md` 为纯导航（项目名 + Working in this repo + Key files 链接）
    - 4.3: 创建 `CONTRIBUTING.md`（人类贡献流程：如何 clone / 如何开新任务 / PR 流程 / 代码评审期望 / 行为准则占位）
    - 4.4: 创建 `CHANGELOG.md`（Keep a Changelog 风格，`[Unreleased]` 顶部，含 Added / Changed / Fixed / Removed 分节）

- [x] Task 5: 建立决策记录体系（ADR）
    - 5.1: 创建 `docs/decisions/README.md`（ADR 机制说明、编号规则、状态流转）
    - 5.2: 创建 `docs/decisions/template.md`（Context / Decision / Consequences / Alternatives）
    - 5.3: 创建 `docs/decisions/0001-adopt-agents-md.md`（采用 AGENTS.md 开放标准的决策）
    - 5.4: 创建 `docs/decisions/0002-harness-dual-file.md`（双文件 harness 架构决策）
    - 5.5: 创建 `docs/decisions/0003-sdd-workflow.md`（Large 任务默认走 SDD 流程）

- [x] Task 6: 建立 Playbook 体系
    - 6.1: 创建 `docs/playbooks/README.md`（索引 + 何时用哪本 playbook）
    - 6.2: 创建 `docs/playbooks/new-feature.md`（Triage → Spec → Plan → TDD → Verify → Handoff）
    - 6.3: 创建 `docs/playbooks/bug-fix.md`（复现 → 定位 → 测试先行 → 修复 → 留资产）
    - 6.4: 创建 `docs/playbooks/refactor.md`（识别触发器 → 不变量固化 → 小步换梁 → 回归）
    - 6.5: 创建 `docs/playbooks/research-method.md`（Research → Synthesize → Adapt → Verify 四阶段）
    - 6.6: 创建 `docs/playbooks/spec-review.md`（Spec 评审 checklist：是否覆盖不变量/风险/验收）

- [x] Task 7: 建立 GitHub 协作模板
    - 7.1: 创建 `.github/pull_request_template.md`（Summary / Type / Size / Linked / Verification checklist / Risk checklist / Screenshots）
    - 7.2: 创建 `.github/ISSUE_TEMPLATE/bug_report.md`（环境 / 复现步骤 / 预期 / 实际 / 日志）
    - 7.3: 创建 `.github/ISSUE_TEMPLATE/feature_request.md`（问题 / 目标用户 / 方案草案 / 验收）
    - 7.4: 创建 `.github/ISSUE_TEMPLATE/config.yml`（禁用空白 issue、指向讨论或 docs）

- [x] Task 8: 整体自检与首次快照提交
    - 8.1: 通读 AGENTS.md / DEVELOPMENT.md / README.md 三者之间链接是否闭环
    - 8.2: 校验文件清单（doc.md § 4 共 22 个目标文件）全部落地且非空
    - 8.3: 校验无业务判断泄漏（grep 场景/竞品/东南亚/IM-native 等关键词不应出现在 harness 文件中）
    - 8.4: 更新 `CHANGELOG.md [Unreleased]` 记录本次 harness bootstrap
    - 8.5: 输出 `.comate/specs/project-harness-bootstrap/summary.md`
