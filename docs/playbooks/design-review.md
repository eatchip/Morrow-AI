# Playbook: 视觉评审（Design Review）

> 适用于**任何含 UI 变更的任务**。与 [`new-feature.md`](./new-feature.md) / [`spec-review.md`](./spec-review.md) / [`DESIGN.md`](../design/DESIGN.md) / [ADR 0005](../decisions/0005-design-north-stars.md) 配合使用。
> **核心约束**：Large UI 任务，用户确认视觉稿前不得写实现代码；合入前必须完成 Phase 1 自检五步。

---

## 判定入口：是否需要走本 playbook？

按 [DESIGN.md § 9 视觉稿前置闸门触发表](../design/DESIGN.md#9-视觉稿前置闸门触发表) 判定档位：

| 档位 | 走哪个 Phase |
|---|---|
| 🔴 新页面 / 新 Flow / 布局重构 / 新原语 | **Phase 0 + Phase 1 全走** |
| 🟡 新动效 / 新过渡 | **Phase 0（交互原型）+ Phase 1** |
| 🟢 已有组件局部修改 | **跳过 Phase 0，只走 Phase 1** |
| ⚪ 纯逻辑 / 文档 / 不可见变更 | **本 playbook 不适用** |

档位判定必须写进 Spec 的"视觉与交互设计"章节，接受 spec-review 阶段复核。

---

## Phase 0 — 开发前视觉对齐

### Step 0.1 — 按档位选载体

| 载体 | 定位 | 适用 |
|---|---|---|
| **AI 生成的 HTML 可交互原型** | 同级首选 | 本项目主场景；产出规约见下方 § AI 产出 HTML 原型规约 |
| **Figma 文件** | 同级首选 | Figma MCP 接通后 / 人工产出 |
| **位图 mockup**（`create-image` / `imagegen`） | 降级 | 早期方向对齐，**不得**作为最终还原参照 |

HTML 原型与 Figma 不再分"首选 / 降级"，择一即可，**无需**在 Spec 中做载体选择留痕。

#### AI 产出 HTML 原型规约

| 维度 | 规约 |
|---|---|
| **存放路径** | `.comate/specs/{feature-name}/prototype/v{n}/index.html`，与 Spec 共生，随 SDD 一起归档 |
| **版本化** | 每轮新建 `v1 / v2 / v3 ...` 子目录，不原地覆盖；同目录 `README.md` 记录本轮关注点（≤ 5 条）与变更点 |
| **当前指针** | `prototype/latest/` 软链指向当前评审版本；跨平台兜底：同目录 `latest.txt` 写版本号（如 `v2`） |
| **技术栈** | 单文件 `index.html` + Tailwind Play CDN + React 18（`esm.sh`）+ Babel standalone（浏览器内编译 JSX），**零 build、不入 `package.json`** |
| **默认运行** | 双击 `index.html`（`file://`）直接打开 |
| **兜底运行** | `pnpm prototype:serve {feature-name}` 启动 `http://localhost:5178`，用于规避 CORS / ESM 限制 |
| **视觉 token** | 原型阶段允许 raw Tailwind class（尚无 token 源码文件）；但选色 / 间距 / 圆角必须遵循 [`DESIGN.md §3`](../design/DESIGN.md#3-design-tokens规约层) 的阶梯语义 |

#### 每轮 AI 产出流程

1. AI 基于 Spec 的"视觉与交互设计"章节需求，生成 `prototype/v{n+1}/index.html` + `README.md`
2. 在回复中给出**打开方式** 与**本轮关注点清单（≤ 5 条）**
3. 用户在浏览器里查看，自然语言反馈
4. AI 需要修改时**新开 `v{n+2}/`**（不覆盖历史版本），同步更新 `latest` 软链与 `latest.txt`
5. 用户确认通过 → 在 Spec "视觉与交互设计"章节勾选 "已确认" 并**记录确认版本号**（如 `已确认 · v3`） → 进入 `tasks.md` 实现

### Step 0.2 — 产出视觉稿

基本要求：

- [ ] 至少覆盖 [DESIGN.md § 6](../design/DESIGN.md#6-state-coverage-checklist) 中的 Default / Empty / Loading / Error 四态
- [ ] 涉及的所有新原语组件都有明确外观
- [ ] 动效 / 过渡有描述或动画稿（🟡 档位必填）
- [ ] 视觉稿路径（Figma URL / 本地 HTML 路径 / 图片目录）写入 Spec

### Step 0.3 — North Star 并排对比

对每一个主要界面，**与 [ADR 0005](../decisions/0005-design-north-stars.md) 的 North Star 做并排截图**：

- 基础结构/密度 → 对比 Linear 同类界面（看板、列表、详情、命令面板等）
- 动效/色彩 → 对比 Arc 同类交互（新标签页、命令输入、状态切换等）

并排对比的目的**不是复刻**，而是：
- 确认结构不比 benchmark 差
- 识别 Morrow 的差异化在哪（必须有，否则 = 仿品）
- 捕捉潜意识里的审美漂移

并排对比图贴到 Spec 或 PR。

### Step 0.4 — 用户确认闸门

把视觉稿提交给用户（项目 owner）确认。**未获明确确认前，禁止提交实现代码**（仅允许改视觉稿本身）。

确认状态在 Spec 的"视觉与交互设计"章节用勾选 + 版本号表示：

```markdown
- **用户视觉确认**：[x] 已确认 · v3  /  [ ] 待确认
```

确认后才进入 `tasks.md` 的实现执行。

### Step 0.5 — 迭代上限

若视觉稿反复迭代 **> 3 轮**仍不收敛，触发以下任一动作：

- 暂停实现，回到 Spec 阶段重审需求与约束
- 重新审视 benchmark 是否仍适用（特殊场景可能需要临时偏离 North Star，但必须在 Spec 显式说明）
- 与用户对齐"最低可接受版本"，迭代时间盒化

---

## Phase 1 — 合入前物理自检五步

**目的**：用**物理动作**替代主观判断，弥补 solo 没有第二双眼睛的兜底。每步都极低成本、极高信号。

### Step 1.1 — 四态截图

截下 Default / Empty / Loading / Error 四态截图。

**如何做**：
- Default：常规数据下打开页面
- Empty：通过开发工具或 mock 数据清空
- Loading：在开发工具中模拟慢速网络 / 打断异步
- Error：mock 一个失败响应

**判定**：任一状态缺失或视觉破碎 → 回改。

### Step 1.2 — North Star 并排

把刚实现出来的界面与 Phase 0 Step 0.3 的 benchmark 截图**再次并排**看一遍。

**如何做**：同时打开两个窗口（或把两张截图左右拼在一起）。

**判定**：若实现相比视觉稿在结构 / 节奏 / 密度上有明显退化，回改。

### Step 1.3 — 缩小 50% 再看

把屏幕缩放到 50% 或把窗口拖到远处看。

**如何做**：macOS `⌘ -` 缩小浏览器 / Electron 窗口；或 PR 截图导入到设计工具按 50% 缩放。

**判定**：缩小后仍应能清晰识别主要视觉层级与节奏。若整体"糊成一团"或"失去结构" → 层级不够、节奏失衡。

**目的**：丢失细节后暴露**结构性问题**（对齐、留白、层级）。

### Step 1.4 — 灰度再看

把截图去色变成纯黑白灰。

**如何做**：
- macOS 预览 → 工具 → 调整颜色 → 饱和度拉到 0
- 或用 `convert` / 截图工具的灰度滤镜
- 或在 DevTools 中加 CSS filter: `filter: grayscale(100%)`

**判定**：失去色彩后，主次层级是否仍然清晰？若必须依赖颜色区分层级 → 对色弱用户不友好 + 证明层级设计过度依赖色彩。

### Step 1.5 — 键盘全流程

把鼠标放在一边，**仅用键盘**走一遍本次变更涉及的所有操作。

**如何做**：
- Tab / Shift+Tab 导航焦点
- Enter / Space 激活
- ESC 取消/关闭
- 方向键在列表/菜单中移动
- 快捷键（⌘/Ctrl + 相关键）

**判定**：任一操作无法用键盘完成 → 违反 [DESIGN.md § 1.5](../design/DESIGN.md#15-键盘先行鼠标后补) + V5 验收标准 → 必改。

---

## Phase 1 执行记录

五步结果必须记录到 PR（见 [`.github/pull_request_template.md`](../../.github/pull_request_template.md) 的 Visual Review 段）：

```markdown
- [ ] 四态截图
- [ ] North Star 并排
- [ ] 缩小 50%
- [ ] 灰度
- [ ] 键盘全流程
```

任一项未勾选或勾选但无证据 → reviewer 有权 blocking。

---

## 特殊情形

### 极紧急修复（hotfix）含 UI 变更

- 允许先合入
- 但必须开 follow-up issue，在 **7 天内**补齐 Phase 1 五步并记录结果
- follow-up 未完成 → 下一次 release 阻断

### 纯重构的 UI 表现

- 若 PR 目标是重构但**不改变**视觉表现：Phase 0 可跳过，Phase 1 的四态对比验证"前后视觉等价"即可
- 若重构**顺便改了**视觉：必须走完整流程，不得把视觉改动藏进重构 PR

### 极端数据态的专项验证

按 [DESIGN.md § 6](../design/DESIGN.md#6-state-coverage-checklist)：

- 0 项数据
- 超长文本
- 1000+ 项列表
- 320px / 1440px / 超宽三档窗口

这些不属于 Phase 1 五步（它们是 Spec 阶段的设计要求），但 PR 自审时应抽样验证。

---

## 与其他 playbook 的关系

| Playbook | 何时读 |
|---|---|
| [`new-feature.md`](./new-feature.md) Step 2 | 判定档位 + 填 Spec 的视觉章节 |
| [`new-feature.md`](./new-feature.md) Step 5–6 | Phase 0 完成后开始写代码；Step 6 Verify 时走 Phase 1 |
| [`spec-review.md`](./spec-review.md) | Reviewer 核对 Spec 中视觉章节完整性 |
| [`research-method.md`](./research-method.md) | 若需要研究新的交互模式（如命令面板）先于视觉稿 |
| [`bug-fix.md`](./bug-fix.md) / [`refactor.md`](./refactor.md) | 若含 UI 表现变化，同样适用本 playbook |

---

## FAQ

**Q：我只改了一个按钮的 padding，也要走五步？**
A：按触发表属 🟢，跳过 Phase 0，Phase 1 仅需截图即可，其他四步按实际复杂度裁剪。关键原则：**档位决定轻重**，不是"所有变更同等对待"。

**Q：用户（我自己）就是 owner，Phase 0 Step 0.4 的"用户确认"如何自证？**
A：在 Spec 的"视觉与交互设计"章节用时间戳 + 勾选"已确认"即可。Solo 的自证要点在于**给自己一个物理停顿**：画完稿先不写代码，至少合上文件过段时间再回来确认，避免"画稿与写代码在同一个心流里"导致的审美盲区。

**Q：视觉稿里的动效怎么展示？**
A：优先级：Framer/Figma 动画原型 > 录屏 GIF/MP4 > CSS transition demo（HTML 原型内）> 文字描述 + easing/duration 参数（最后选）。

**Q：Phase 1 Step 1.3 缩小 50% 在 Electron 窗口里怎么做？**
A：开发期用 `⌘ -` 缩放 webContents；或在 BrowserWindow 的 DevTools Console 里 `document.body.style.zoom = 0.5`；或截图后在图像工具里缩放。
