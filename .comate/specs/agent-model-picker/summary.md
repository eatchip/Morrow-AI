# Summary · agent-model-picker

## 交付

Composer 下方新增模型 / 智能档位选择器，codex 与 claude 两种 runtime 的模型、codex 的 reasoning effort 均可在发送前切换；偏好本地持久化、重启后仍在。所有值经主进程白名单校验，不可命令注入。

## 范围

- **shared/ipc.ts**：扩展 `SendPromptArgs` 新增 `model?` / `effort?`；导出唯一事实源常量 `CODEX_MODELS` / `CLAUDE_MODELS` / `EFFORT_LEVELS` / `MODEL_ID_REGEX` + 类型 `EffortLevel`
- **main/ipc.ts + main/ipc-validate.ts**：新增 `validateSendPromptArgs` 纯函数作为 renderer→main 唯一信任边界；非法值直接 emit `error` 并 return，不落 spawn
- **main/runtime-session.ts**：`buildCmd` 按独立 argv 元素注入 `--model` / `-c model_reasoning_effort=…`（codex）/ `--model`（claude）；无 `shell: true`
- **renderer/src/lib/agent-prefs.ts**：`loadPrefs` / `savePrefs` / `sanitizePrefs`；localStorage key = `morrow:agent-prefs:v1`；非法值静默回退默认
- **renderer/src/components/ModelPicker.tsx + model-picker.css**：Chip + Popover（点外部 / Esc 关闭，键盘可达），完全走 design tokens
- **App.tsx → Chat.tsx → Composer.tsx**：`prefs` state 下传，`sendPrompt` 调用链携带 `model` / `effort`；runtimeLabel 文案去重
- **preload/index.ts(.d.ts)**：`sendPrompt` 签名扩展，仅结构透传

## 测试

- `tests/unit/agent-prefs.spec.ts` · 11 tests：默认值、非法 JSON / 字段回退、save↔load 往返
- `tests/contract/runtime-build-cmd.spec.ts` · 7 tests：codex/claude argv 精确断言 + 命令注入白盒
- `tests/contract/send-prompt-args.spec.ts` · 20 tests：合法 / 非法 model（空格/反引号/`$()`/分号/管道/换行/>64 字符/空）/ effort / runtime 全覆盖
- `tests/e2e/model-picker.spec.ts`：打开 → 切模型 → 切档位 → reload 后偏好仍在

109 unit + contract + integration tests 全绿。

## 真实 bug 留下的资产

**bug**：首版默认 / 常量用的是 codex-cli **API key 模式**的模型 id（`gpt-5-codex` / `gpt-5` / `o3`），用户实际是 **ChatGPT 账号模式**，服务端直接 400 `model is not supported when using Codex with a ChatGPT account`。

**根因**：`codex-cli v0.130` 两种认证模式暴露的模型列表不一样——ChatGPT 账号模式 TUI 里可见的是 `gpt-5.5` / `gpt-5.4` / `gpt-5.4-mini` / `gpt-5.3-codex` / `gpt-5.3-codex-spark` / `gpt-5.2`，effort 还多了 `xhigh`。文档和实现只对齐了一边。

**资产**：
1. `shared/ipc.ts` 的 `CODEX_MODELS` JSDoc 明写 **"对齐 codex-cli v0.130 ChatGPT 账号 TUI，非 API key 模式"**，把"旧 id 为什么不列"写进注释
2. `EFFORT_LEVELS` 补齐 `xhigh`
3. 默认改 `gpt-5.5 + medium`
4. CHANGELOG `[Unreleased]` 写清晰模式出处，避免后续 agent 再回退

## 已知限制

- 模型列表是硬编码白名单，不是运行时从 codex-cli 枚举的。未来如果 codex-cli 新加模型需要手工补常量
- E2E 烟测只覆盖 UI 切换 + 持久化，不覆盖真实 codex-cli spawn（主进程白名单 + argv 独立元素由单元/契约测试托底）
- 无跨设备同步（localStorage only）
- **codex MCP 路径暂不透传 model/effort**：合入 `streaming-and-latency` 后 codex 默认走 `codex-mcp.ts` 的 MCP 协议，model/effort 仅在 MCP 不可用回退到 `exec` 路径时通过 argv 生效；MCP 路径下会沿用 codex-cli 默认模型。后续 SDD 处理（涉及 codex-mcp 重构，超出本 SDD 范围）

## 验收

- [x] chip 显示 `模型 · 档位`（codex）或 `模型`（claude）
- [x] 打开 Popover → 切换 → 触发器文案即时更新
- [x] reload 后偏好仍在
- [x] 非法 model / effort 被主进程拒绝，renderer 收到 `error` 事件
- [x] buildCmd 所有 argv 是独立元素，不含 shell 特殊字符拼接
- [x] `pnpm test` 全绿（109/109）
