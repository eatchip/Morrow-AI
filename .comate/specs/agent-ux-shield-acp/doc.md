# agent-ux-shield-acp — Spec

## 1. Task Scale

Large.

原因：本任务改变 Codex 对话主界面、输入焦点模型、权限确认路径和 PTY 输出展示方式，
跨 renderer / preload mock / tests / docs。底层 PTY 速度保持不变，但默认体验从“操作终端”
升级为“和 Agent 对话”。

## 2. References

- ACP Overview：Client 负责 UI、权限和 terminal capabilities；Agent 通过 JSON-RPC
  `session/prompt` 与 `session/update` 通知状态。
- ACP Tool Calls：权限通过 `session/request_permission` 让 Client 呈现用户可理解的
  allow/reject 选择；terminal 输出可以挂在 tool call 中，而不必成为主交互面。
- Zed ACP：成熟 IDE 产品把 Agent protocol 作为外部 Agent 与编辑器 UI 的边界，而不是把
  Agent 的 TUI 原样暴露给用户。

## 3. Decision

本阶段做 **UX Shield + ACP-ready Event Adapter**：

```text
PTY bytes
  -> renderer AgentTranscript adapter
  -> Morrow conversation/activity UI
  -> optional raw terminal log
```

不直接把 Codex TUI 作为主界面。原因：当前 `codex --help` 未暴露稳定 ACP server 命令；
真实 ACP runtime 需要上游 agent 或 adapter 支持。本阶段先把 Morrow 内部 UI/事件模型做成
ACP-compatible shape，后续接入 ACP 时只替换 adapter，不重写界面。

## 4. Acceptance Criteria

- AC-1：Codex 仍走 PTY-first，速度不回退。
- AC-2：页面上只有 Composer 是输入入口；terminal 区域不可聚焦、不接收键盘输入。
- AC-3：默认主界面显示 Morrow 的对话与活动流，不显示 xterm 输入框。
- AC-4：raw terminal 只在“终端日志”折叠面板里展示，用于 debug / 兜底。
- AC-5：检测到 Codex approval/permission prompt 时，Composer 上方出现浮层操作：
  “允许本次 / 拒绝”，按钮向 PTY 写入 Enter / Escape。
- AC-6：工具执行、状态、终端输出进入活动卡片；长输出折叠，避免污染会话正文。
- AC-7：保留 ACP-ready 事件类型和 adapter 边界，为后续真实 ACP transport 接入做准备。

## 5. Visual / Interaction Gate

- 档位：🟢 existing Chat surface refinement。没有新增页面、没有新增设计系统原语；
  主要是在现有 Chat 里把默认 xterm 主界面替换成 Morrow activity timeline。
- Phase 0：跳过；用户已明确要求直接实现并交付完整结果。
- Phase 1：通过 E2E 覆盖默认态、approval 态、terminal log 折叠态与 Composer focus。

## 6. Ownership

| State | Owner | Notes |
| --- | --- | --- |
| PTY process/session | main `PtySessionManager` | 不变 |
| Raw PTY bytes | renderer `AgentTerminalSession` hook | 只读展示 + parse |
| Conversation messages | renderer `App` | user message 仍为事实 |
| Agent activity items | renderer transcript adapter | 从 PTY 或未来 ACP 派生 |
| Permission prompt UI | renderer `ApprovalPromptBar` | 当前 PTY 键盘映射，未来 ACP response |
| ACP transport | future main adapter | 本阶段只落类型 / 边界 |

## 7. Invariants

1. 用户文本只能从 Morrow Composer 进入 Agent；xterm 不得成为第二输入焦点。
2. raw terminal 输出不得成为默认主体验；主界面必须是 Morrow 自己的 timeline。
3. Approval UI 必须是显式用户动作；不得自动 approve。

## 8. Boundary Checks

- 状态所有权：PTY process 仍归 main；renderer 只持有 raw bytes 的 UI projection。
- 异步生命周期：transcript hook 在 session 切换时重置 raw / approval state，并注销 `onData`。
- IPC 边界：本阶段不新增 IPC channel；approval 只复用既有 `pty.write`。
- 合规：不新增依赖，不读取额外文件，不触达凭证。
- 性能：仍复用 PTY-first 首字节路径；adapter 只对当前 session buffer 做线性解析。

## 9. Non-goals

- 不实现真实 ACP transport，除非 Codex CLI 暴露稳定 ACP server。
- 不删除 PTY fallback。
- 不做完整 TUI 语义解析；只解析高价值用户可见事件：assistant text、tool/status、permission。
