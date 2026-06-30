# Summary: design-review-html-first

- **Status**: Completed · 2026-05-12
- **Spec**: [doc.md](./doc.md)
- **Plan**: [tasks.md](./tasks.md)

## 目标回顾

把 HTML 可交互原型从"降级方案"扶正为 🔴/🟡 档位的**首选载体之一**（与 Figma 并列），并规范 AI 产出 HTML 原型的路径、技术栈、版本化与运行方式。后续业务 SDD（首个为 `agent-bridge-mvp`）按新规则执行视觉评审。

## 交付清单

### Harness 文档调整
- `docs/design/DESIGN.md §9`：载体优先级改为 "HTML 可交互原型 / Figma 文件" 并列首选；移除 "从 Figma 降级需在 Spec 留痕" 要求
- `docs/playbooks/design-review.md Phase 0 Step 0.1`：载体表同步；新增 "AI 产出 HTML 原型规约" 子节（存放路径 / 版本化 / 当前指针 / 技术栈 / 运行方式 / 视觉 token 使用约束）
- `docs/playbooks/design-review.md Phase 0 Step 0.4`：用户确认记录形式升级为 "已确认 · v{n}"

### 工具链
- `scripts/serve-prototype.mjs`（135 行）
  - CLI：`node scripts/serve-prototype.mjs <feature> [--port N]`
  - 解析顺序：`prototype/latest` 软链 → `prototype/latest.txt` 跨平台兜底
  - 内置路径穿越防护（`..` 拒绝 400/404）、基础 MIME 覆盖、SIGINT 优雅退出
  - 默认端口 5178（避开 electron-vite 5173）
- `package.json` scripts：新增 `"prototype:serve": "node scripts/serve-prototype.mjs"`

### 自证原型
- `.comate/specs/design-review-html-first/prototype/v1/index.html`：Tailwind Play CDN + React 18（esm.sh）+ Babel standalone，含一个可点击计数的按钮，验证三条 CDN 链路与交互
- `.comate/specs/design-review-html-first/prototype/v1/README.md`：本轮关注点清单
- `prototype/latest` → `v1` 软链 + `prototype/latest.txt` = `v1`

### CHANGELOG
- `Added`：`scripts/serve-prototype.mjs` + `pnpm prototype:serve` + 首个自证原型
- `Changed`：DESIGN.md §9 / design-review.md Phase 0 的载体规则调整
- `Notes`：延后 SDD 清单中把 "Figma MCP 正式接入" 更名为独立的 `figma-mcp-integration`

## 验证记录

| 项 | 结果 |
|---|---|
| `curl http://localhost:5178/` | HTTP 200，返回目标页（含 "原型评审闸门就绪" 串） |
| 路径穿越 `/../../../etc/passwd` | 404（正确拒绝） |
| 兄弟文件 `/README.md` | 200（root 内允许） |
| `oxlint scripts/serve-prototype.mjs` | 0 warnings / 0 errors |
| `prettier --check` 所有改动文件 | 全部合规 |
| `pnpm check` (tsc) | **沙箱限制未能执行**（沙箱 Node 20，repo 要求 ≥22.12）；改动无 `.ts` 文件，本机 Node 22+ 下无风险 |

## 偏差 / 决策变更

1. **oxlint 提示 `preserve-caught-error`**：按提示给 `throw new Error(..., { cause: err })` 传递了 cause，不吞原错误
2. **`.gitignore` 未改**：预检确认当前 `.comate/specs/**/prototype/**` 未被任何规则命中，无需新增豁免规则
3. **`AGENTS.md` / `DEVELOPMENT.md` / ADR 0005 未改**：这三者对载体无强约束，保持 harness 稳定

## 对后续的影响

- **`agent-bridge-mvp`（下一 SDD）**：在 `doc.md` 的"视觉与交互设计"章节直接按新规则产出 HTML 原型，无需再声明载体降级原因
- **`figma-mcp-integration`（未来 SDD）**：Figma MCP 接通后，DESIGN.md §9 两条并列首选已经预留了并存位置，无需再调整规则
- **`design-tokens-enforcement`（未来 SDD）**：原型阶段允许 raw Tailwind class 的约定已写入 design-review.md；tokens 落地后如需迁移原型样式，届时新增一条迁移条目即可
