# SDD: design-review-html-first

> **Status**: Draft（待用户确认）
> **Date**: 2026-05-12
> **Scope**: Harness 元变更（不含业务代码）
> **关联 ADR**: [0005 Design North Stars](../../../docs/decisions/0005-design-north-stars.md)
> **后继 SDD**: `agent-bridge-mvp`（将首次按本 SDD 产出规则执行）

---

## 1. 背景与动机

### 1.1 现状
当前 harness（`DESIGN.md §9 载体优先级` / `design-review.md Phase 0 Step 0.1`）规定：

1. Figma 文件（首选）
2. HTML/CSS 可交互原型（**降级**，需在 Spec 记录原因）
3. 位图 mockup（仅方向对齐）

### 1.2 问题
- Comate 会话中 **无 Figma MCP 工具**，也无法 `web_fetch` 解析 Figma Make 链接（JS 渲染 + 鉴权墙），AI 侧实际上拿不到 Figma 内容
- 项目技术栈为 **Electron + React + HTML**，HTML 原型与最终实现同技术栈，认知断层最小
- Solo 开发 + AI 协同模式下，"AI 生成可交互 HTML → 用户浏览器里直接过目 → 反馈迭代" 的闭环比 Figma 短一个数量级
- 现行规则把 HTML 列为"降级"并要求留痕解释，会反复触发不必要的 Spec 噪声

### 1.3 目标
把 **HTML 可交互原型** 从"降级方案"扶正为 🔴/🟡 档位的**首选载体之一**（与 Figma 并列），并规范 AI 产出 HTML 原型的**位置、技术栈、版本化、运行方式**。

### 1.4 非目标
- 不移除 Figma 作为合法载体（未来 Figma MCP 接通后仍可并行使用）
- 不改 ADR 0005（其对载体无强约束）
- 不改 AGENTS.md（§7 设计契约段仅链接 DESIGN.md，无需动）
- 不落地 design tokens 的 lint 强制（属 `design-tokens-enforcement`）
- 不引入新顶层 npm 依赖（原型用 CDN 加载 React / Tailwind，不入 `package.json`）

---

## 2. 业界参考

| 参考 | 要点 | Morrow 采用 |
|---|---|---|
| **shadcn/ui 文档站** | 用可交互 HTML demo 代替静态图，读者所见即所得 | 采用"单文件 + CDN"的轻量模式 |
| **Storybook** | 组件原型托管 + 版本化 | 只取"版本化目录"概念，不引入 Storybook 依赖（过重） |
| **Figma Make（用户体验过）** | AI 生成可交互 React 原型 | 借鉴"一轮生成一个可看的东西"的闭环形态 |
| **v0.dev / Claude Artifacts** | 单文件 React + Tailwind 原型 | 直接采用此技术形态 |

抽取共同模式：**"单文件自包含 + CDN 加载 + 零 build"** 是 AI 协同生成原型的行业事实标准。

---

## 3. 决策

### 3.1 载体优先级（调整后）

```markdown
## 视觉稿载体优先级（design-review-html-first 调整后）

同级首选：
- AI 生成的 HTML 可交互原型（本项目主场景）
- Figma 文件（未来 Figma MCP 接通后 / 人工产出）

降级载体：
- 位图 mockup / create-image / imagegen 产物（仅方向对齐，不作还原参照）

不再要求 "从 Figma 降级到 HTML 需在 Spec 留痕"。
```

### 3.2 HTML 原型产出规约

| 维度 | 决策 |
|---|---|
| **存放路径** | `.comate/specs/{feature-name}/prototype/v{n}/index.html`（与 Spec 共生，随 SDD 一起归档） |
| **版本化** | 每轮新建 `v1 / v2 / v3 ...` 子目录，保留历史；同目录下 `README.md` 记录本轮变更点与待确认项 |
| **当前指针** | `.comate/specs/{feature-name}/prototype/latest` 软链指向当前确认中的版本（macOS/Linux：`ln -s`；Windows：改用 `latest.txt` 记录版本号，跨平台脚本兜底） |
| **技术栈** | 单文件 HTML + Tailwind via CDN（Play CDN） + React 18 + ReactDOM via `esm.sh` + Babel standalone（浏览器内编译 JSX）— 零 build，不污染 `package.json` |
| **默认运行** | 双击 `index.html`（`file://`）直接打开 |
| **兜底运行** | `pnpm prototype:serve {feature-name}`（当 CORS / ESM 问题出现时）—— 新增 `scripts/serve-prototype.mjs`，基于 Node 内置 `http` + `fs`，无外部依赖 |
| **视觉 token 使用** | 原型内**允许**硬编码 Tailwind class（设计规约 §1.8 的"禁止硬编码"指 **最终业务代码**；原型阶段尚无 token 源码文件），但选色/选距必须遵循 `DESIGN.md §3` 的阶梯语义（如 gray-50/100/../950、spacing 4/8/12/16...） |

### 3.3 AI 产出流程（每轮）

1. 根据当前 Spec 的"视觉与交互设计"章节需求，AI 在 `prototype/v{n+1}/` 下生成 `index.html` + `README.md`
2. AI 在回复中给出**打开方式**（双击 / `pnpm prototype:serve`）与**本轮关注点清单**（≤ 5 条）
3. 用户在浏览器里查看，用自然语言反馈
4. AI 若需修改：**新开 `v{n+2}/`**（不原地覆盖 `v{n+1}/`），保留迭代轨迹
5. 用户确认通过 → 在 Spec 的"视觉与交互设计"章节勾选"已确认"并记录 `vN` 版本号 → 进入实现

### 3.4 迭代上限（继承原规则）
- > 3 轮不收敛 → 暂停、重审需求 / benchmark / 最低可接受版本

---

## 4. 影响面与变更清单

| 文件 | 变更类型 | 主要内容 |
|---|---|---|
| `docs/design/DESIGN.md` | 编辑 §9 | 载体优先级调整；移除"首选 Figma"措辞；加入 HTML 原型的存放路径与运行方式链接 |
| `docs/playbooks/design-review.md` | 编辑 Phase 0 Step 0.1–0.2 | 载体表同步；新增"AI 产出 HTML 原型规约"子节；移除"降级留痕"要求 |
| `scripts/serve-prototype.mjs` | 新增 | ~40 行静态 server，参数 `{feature-name}`，默认端口 5178（避开 electron-vite 5173），仅服务 `.comate/specs/{feature}/prototype/latest/` |
| `package.json` | 编辑 scripts | 新增 `"prototype:serve": "node scripts/serve-prototype.mjs"` |
| `.gitignore` | 编辑 | 不 ignore `prototype/`（原型需要入库作为评审证据） |
| `CHANGELOG.md` | 编辑 `[Unreleased]` | 记录本次 harness 调整 |

**不动**：`AGENTS.md` / `DEVELOPMENT.md` / `ADR 0005` / CI 配置 / pre-commit 闸门

---

## 5. 预期产出目录结构

```
.comate/specs/agent-bridge-mvp/         (首次按新规则产出的 feature)
├── doc.md
├── tasks.md
└── prototype/
    ├── latest → v2                     (软链)
    ├── v1/
    │   ├── index.html
    │   └── README.md                   (本版关注点)
    └── v2/
        ├── index.html
        └── README.md
```

---

## 6. 状态所有权 / 不变量 / 风险

### 6.1 状态所有权
- **prototype 源码** owner：当前 SDD 的 `feature-name` 作者（Spec 生命周期内）
- **latest 指针** owner：AI（每轮生成时更新）
- **"视觉已确认" 事实** owner：用户（只能用户翻牌）

### 6.2 不变量
1. **每个 🔴/🟡 档位 SDD 在进入 `tasks.md` 执行前，必须有一份被 owner 勾选"已确认"的 `prototype/v{n}/`**
2. **迭代只增不改：`v{n}` 目录一旦产出即冻结，新改动进 `v{n+1}`**（保留审计轨迹）
3. **原型不引入 `package.json` 依赖**（保持"零 build、可双击打开"承诺）

### 6.3 风险与缓解
| 风险 | 等级 | 缓解 |
|---|---|---|
| 原型用 CDN，离线场景打不开 | 低 | README 注明"首次打开需联网加载 Tailwind/React CDN，之后浏览器缓存" |
| 原型样式与最终实现漂移（因原型用 raw Tailwind，最终用 tokens） | 中 | 在 `design-tokens-enforcement` SDD 落地后，同步写一条迁移清单，但不阻塞本 SDD |
| Windows 下软链失败 | 中 | 降级为 `latest.txt`（纯文本记录版本号），`serve-prototype.mjs` 两种方式都识别 |
| 原型文件数膨胀（每 feature 3–5 版） | 低 | feature 归档 summary 时，允许只保留最终确认版 + 最初版（README 说明压缩规则） |
| "原型过度完善 → 失去迭代意义" | 中 | 每轮 README 必填"关注点清单 ≤ 5 条"，超过即拆 |

---

## 7. 验收标准

- [ ] `DESIGN.md §9` 载体优先级表按 §3.1 改写；旧 "Figma 优先 / HTML 降级" 措辞彻底移除
- [ ] `design-review.md Phase 0 Step 0.1–0.2` 同步调整；新增"AI 产出 HTML 原型规约"子节，内容与本 SDD §3.2 / §3.3 一致
- [ ] `scripts/serve-prototype.mjs` 存在、可执行、`pnpm prototype:serve` 能起起来并在 `http://localhost:5178` 返回 `prototype/latest/index.html`
- [ ] `package.json` 新增 `prototype:serve` 脚本，无其他无关改动
- [ ] 三个 md 改动不破坏原有 anchors（如 `#9-视觉稿前置闸门触发表`、`#phase-0--开发前视觉对齐`）—— 跨文件引用仍然有效
- [ ] `CHANGELOG.md [Unreleased]` 记录本次变更
- [ ] `pnpm pre-commit` 8 步全绿
- [ ] 本 SDD `summary.md` 产出；随后 `agent-bridge-mvp` SDD 的 `doc.md` 中"视觉与交互设计"章节引用本 SDD 规则

---

## 8. 验证方式

| 类型 | 方式 |
|---|---|
| **静态** | md 跨引用的 anchor 手工核对；`pnpm check` / `lint:fix` / `format-check:staged` |
| **脚本** | 写一个极简示例 `.comate/specs/design-review-html-first/prototype/v1/index.html`（演示"Hello Morrow"），运行 `pnpm prototype:serve design-review-html-first`，确认 200 返回 |
| **流程自证** | 后续 `agent-bridge-mvp` SDD 按新规则走一遍，作为 end-to-end 自证 |

---

## 9. 未决事项（不阻塞本 SDD，留待后续）

- Figma MCP 的正式接入由 **后续独立 SDD**（暂名 `figma-mcp-integration`）承接，届时回头在 DESIGN.md §9 并列位补 Figma 产出路径即可
- 原型目录的归档压缩策略（保留最终 + 最初 vs 全保留）在首次出现"单 feature ≥ 3 版" 时再形成规则，不提前规定

---

## 10. References

- [DESIGN.md §9 视觉稿前置闸门触发表](../../../docs/design/DESIGN.md#9-视觉稿前置闸门触发表)
- [design-review.md Phase 0](../../../docs/playbooks/design-review.md)
- [ADR 0005 Design North Stars](../../../docs/decisions/0005-design-north-stars.md)
- [AGENTS.md §4 Workflow](../../../AGENTS.md)
