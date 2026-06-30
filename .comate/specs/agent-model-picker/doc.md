# Spec · agent-model-picker

> Large 任务。按 AGENTS.md §2/§3/§4 走 SDD：Spec → Approval → Plan → Approval → Execute。
> 视觉稿闸门判定：🟢 已有组件（Composer）局部修改 + 新增下拉 Popover，非新页面/新 Flow → 截图放 PR 即可，不强制产出设计稿。

---

## 1. 目标与用户故事

**用户故事**：
> 作为 Morrow 用户，我在 Chat 界面发送 Prompt 前，能够根据当前绑定的 Agent（codex / claude）：
> - 选择**具体模型**（如 codex 的 `gpt-5` / `gpt-5-codex`；claude 的 `sonnet` / `opus`）；
> - 选择**推理档位 / 智能度**（codex 支持 `minimal | low | medium | high`；claude 另行处理）；
> - 选择结果立即作用于本会话的所有后续轮次，且在应用重启后仍保留默认值。

参考原型（用户提供截图）：级联菜单 `模型 → GPT-5.5 / GPT-5.4 / 其他模型`，以及 `智能 → 低/中/高/超高`。

---

## 2. 业界最佳实践参考（§3 研究前置）

| 工具 | 模型选择 | Effort/思考档位 | 命令行证据 |
|---|---|---|---|
| **codex-cli** | `codex exec -m <id>` / `--model <id>` | `-c model_reasoning_effort=minimal\|low\|medium\|high` | codex `config.md`、`exec --help` |
| **claude-code** | `claude --model <name>`（`sonnet` / `opus` / 具体 ID） | 无对齐的 effort 档位；extended thinking 通过模型本身或 `--permission-mode plan` 等路径触发 | claude `--help` |
| **ChatGPT Desktop / Cursor / Zed / Aider** | 均在 Composer 顶部用下拉 / popover 选模型，默认值来自用户偏好，per-session override | 少数（Aider `--reasoning-effort`）透出 effort | — |

**结论（可行性）**：
- codex：`模型 + effort` 两个维度都能通过 CLI 参数注入，**完全可行**。
- claude：`模型` 可行；"智能度/effort" **没有与 codex 对齐的单一开关**，只有 extended thinking 的 on/off 或模型本身切换。**先交付 `模型选择`，`智能度` 在 claude 下置灰并写 tooltip**；后续想要可以再起一个 SDD。

---

## 3. 业务逻辑与验收标准

### 3.1 交互（UI）

在现有 `Composer.tsx` 的 `composer-row`（发送按钮左侧）**新增一个轻量 Popover 触发器**：

```
[ ⚡ GPT-5.5 · 高 ∨ ]      ← 触发按钮（紧凑 chip）
        ↓ 点击展开
┌─────────────────────┐
│ 模型                │
│ ✓ gpt-5-codex       │
│   gpt-5             │
│   o3                │
├─────────────────────┤
│ 智能               │
│   低 / 中 / ✓高 / 超高 │
└─────────────────────┘
```

- claude runtime 下：第二分组替换为"扩展思考"开关（或直接隐藏，一期隐藏）。
- 触发器文案：`{模型短名} · {档位中文}`（codex）/ `{模型短名}`（claude）。
- Popover 使用已有 tokens（`--radius-md` / `--surface-elev-1` / `--fg-subtle`），禁止硬编码色值。

### 3.2 状态所有权（§3 Pre-Coding）

- **Owner**：渲染层单一 store（暂时以 `App.tsx` 的 `useState` + `localStorage` 持久化；不引入新依赖）。
- **Shape**：
  ```ts
  interface AgentPrefs {
    codex: { model: string; effort: 'minimal' | 'low' | 'medium' | 'high' };
    claude: { model: string };
  }
  ```
- **持久化**：`localStorage['morrow:agent-prefs:v1']`，首次为空时填默认值。
- **作用域**：全局（不绑定 project）——与 Cursor/Zed 行为一致；per-project override 如需后续再加。
- **派生 UI**：触发器文案、Composer 的 `runtimeLabel`。

### 3.3 数据流（端到端）

```
Composer Popover (renderer)
  └─> App state (AgentPrefs) ──persist──> localStorage
         │
         ▼
  sendPrompt({ runtime, prompt, sessionId, projectId, model?, effort? })
         │ (IPC 边界校验)
         ▼
  main/ipc.ts ──> runtime-session.startSession(...)
         │
         ▼
  buildCmd(runtime, prompt, opts)
    claude → ['--model', model, '-p', prompt, ...]
    codex  → ['exec', '--model', model, '-c', `model_reasoning_effort="${effort}"`, '--json', ...]
```

### 3.4 不变量（§3）

1. **IPC 边界**：`SendPromptArgs.model` 必须是 `^[a-zA-Z0-9._:-]{1,64}$`，`effort` 必须 ∈ 四枚举，违反则主进程直接 `emit error`，不落进 spawn。
2. **命令注入零容忍**：`model` / `effort` 只以**独立 argv 元素**传入；禁止拼字符串、禁止 `shell: true`（现状已是 `shell: false`，延续）。
3. **新旧版本兼容**：当 `model` / `effort` 为 undefined（老会话、或空偏好）时，命令行**不注入**对应 flag，走 CLI 默认值——保证不回退任何现有行为。

### 3.5 验收标准

- [ ] codex runtime 下，选 `gpt-5` + `high`，发送后主进程实际 spawn 命令包含 `['exec','--model','gpt-5','-c','model_reasoning_effort=high',...]`（契约测试断言）。
- [ ] claude runtime 下，选 `opus`，spawn 命令包含 `['--model','opus','-p',...]`。
- [ ] 偏好跨应用重启保留（手测 + e2e 冒烟）。
- [ ] 非法 `model`（含空格 / 特殊字符）从 preload/主进程任一侧被拒，不落 spawn。
- [ ] 切换 runtime（codex↔claude）时，Popover 内容自适应（codex 两段，claude 一段）。
- [ ] `pnpm pre-commit` 全绿（lint / typecheck / test / e2e 冒烟）。

---

## 4. 影响范围（文件级）

| 路径 | 变更类型 | 关键改动 |
|---|---|---|
| `/Users/songhuiyu/Morrow-agent-model-picker/src/shared/ipc.ts` | 扩展 | `SendPromptArgs` 新增 `model?: string`、`effort?: 'minimal'\|'low'\|'medium'\|'high'`；导出 `CODEX_MODELS` / `CLAUDE_MODELS` / `EFFORT_LEVELS` 常量作为唯一来源 |
| `/Users/songhuiyu/Morrow-agent-model-picker/src/app/main/ipc.ts` | 扩展 | 校验新字段（正则 + 枚举），透传到 `startSession` |
| `/Users/songhuiyu/Morrow-agent-model-picker/src/app/main/runtime-session.ts` | 扩展 | `StartSessionArgs` 增补；`buildCmd` 按 runtime 注入 flag；新增单测覆盖 |
| `/Users/songhuiyu/Morrow-agent-model-picker/src/app/preload/index.ts` | 小 | `sendPrompt` 透传字段（不再做业务校验） |
| `/Users/songhuiyu/Morrow-agent-model-picker/src/app/renderer/src/components/Composer.tsx` | 扩展 | 新增 prefs 入参与 Popover 触发器 |
| `/Users/songhuiyu/Morrow-agent-model-picker/src/app/renderer/src/components/ModelPicker.tsx` | **新建** | Popover 组件（必要性：Composer 已接近 100 行上限，独立拆出避免超 `check-max-lines.mjs` 警戒） |
| `/Users/songhuiyu/Morrow-agent-model-picker/src/app/renderer/src/App.tsx` | 扩展 | `AgentPrefs` state + `localStorage` 读写 + 下发 |
| `/Users/songhuiyu/Morrow-agent-model-picker/src/app/renderer/src/lib/agent-prefs.ts` | **新建** | 纯函数：默认值、schema 校验、load/save（无副作用部分便于单测） |
| `/Users/songhuiyu/Morrow-agent-model-picker/src/app/renderer/src/index.css` 或 `screens.css` | 小 | Popover 样式（使用 tokens） |
| `tests/unit/runtime-session.spec.ts`（若存在则扩展，否则新建） | 测试 | `buildCmd` 对 codex/claude 的 argv 断言 |
| `tests/unit/agent-prefs.spec.ts` | **新建** | 默认值 / 非法值回退 / 反序列化 |
| `tests/e2e/model-picker.spec.ts` | **新建** | Playwright 冒烟：打开 Popover、切换、重启保留 |
| `CHANGELOG.md` | 小 | `[Unreleased]` 增加用户可感知条目 |

---

## 5. 边界条件与异常

- **localStorage 解析失败 / 字段非法** → 回退默认值，**不抛**（渲染层信任 owner，owner 信任 schema）。
- **用户选了一个 CLI 不识别的模型**（例如 codex-cli 升级后旧常量过期）→ CLI 自身会报错，主进程把 stderr 原样吞并作为 `kind: 'error'` 事件透出，**不特殊处理**（符合当前 `runtime-session.ts:229` 的兜底）。
- **模型列表升级**：仓库内常量（`CODEX_MODELS`/`CLAUDE_MODELS`）作为唯一来源；**不动态探测**（两个 CLI 都无稳定的 list-models API，探测只会引入运行时不确定性）。升级靠 PR 改常量。
- **正在 streaming 时切换偏好**：新偏好只影响**下一次 send**；当前会话不受影响（符合 CLI 的"一次性参数"语义）。

---

## 6. 主要风险 & 缓解

| 风险 | 缓解 |
|---|---|
| 命令注入 | 严格白名单 + argv 分离（§3.4 不变量 #2） |
| CLI 版本差异（codex 老版本无 `-c model_reasoning_effort`） | Spec 范围内锁定"当前 README 支持的 CLI 版本"；检测失败时把 CLI stderr 透出即可，不做 version probe |
| UI 膨胀 | 一期只做 codex 两档 + claude 模型；"扩展思考"等留坑，tooltip 说明 |
| 偏好 schema 演进 | `localStorage` key 带 `:v1`，升级时可 no-op 回退默认 |

---

## 7. 开放问题（请确认）

Q1. **Claude 的"智能/extended thinking"一期方案**  
  - A. 一期**不做**，只给模型选择（触发器只显示模型名）。← 推荐
  - B. 一期做开/关开关，底层尝试传 `--permission-mode` 等（不稳定，易坑）。

Q2. **持久化范围**  
  - A. 全局偏好（Cursor/Zed 风格）。← 推荐
  - B. per-project 偏好（需要扩 `projects.json` 并写迁移，工作量翻倍）。

Q3. **模型列表来源**  
  - A. 仓库内白名单常量 + 随 Morrow 版本升级。← 推荐
  - B. 允许用户手输任意字符串（正则放宽，体验差但能抗 CLI 升级）。

Q4. **是否值得为这个功能起一条 ADR？**  
  - 偏好"全局 vs per-project"这类长期设计决策值得记录；"模型列表硬编码"不需要。  
  - 推荐：**不单独起 ADR**，决策写在本 `doc.md` 即可；如你要升级为项目级原则再起 ADR。

---

## 8. 预期验证方式

- **Unit（vitest）**：`buildCmd` argv 断言（codex/claude 四组 case）、`agent-prefs` 的 load/save/非法回退。
- **Contract（tests/contract/）**：`SendPromptArgs` 边界校验（非法 model / effort 被拒）。
- **E2E（Playwright）**：Popover 打开 → 选择 → 发送 → 重启 → 偏好仍在。
- **Pre-commit 闸门**：`pnpm pre-commit` 全绿。
- **手测**：codex 下实际观察 `high` vs `minimal` 的响应差异（非必须，感性验证）。

---

## 9. 超出范围（不做）

- 模型价格 / token 使用量展示。
- 每项目偏好、每会话 override。
- 动态拉取 CLI 支持的模型清单。
- Claude 扩展思考档位化（需另起 SDD）。
- 模型/档位作为 URL / deep link 参数。
