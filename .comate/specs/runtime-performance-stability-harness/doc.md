# runtime-performance-stability-harness — Spec

## 1. Task Scale

Large.

原因：本任务同时触达 Codex 运行时主链路、PTY/MCP 双通道、renderer 流式渲染、IPC
生命周期、超时/取消/恢复语义、性能基准和用户可见错误体验。它满足以下升级触发器：

- 跨 main / preload / renderer / tests / docs 多模块。
- 存在运行时风险：异步 gap、子进程生命周期、MCP 请求取消、长期会话资源释放。
- 当前已经出现过多次同类问题：慢、卡死、无输出、TUI 污染、timeout 后体验差。
- 用户明确要求性能不回退，并且每次更新都能防止类似问题复发。

本 Spec 是 SDD 必要产物，因此需要新建：

- `.comate/specs/runtime-performance-stability-harness/doc.md`：本方案与验收标准。
- `.comate/specs/runtime-performance-stability-harness/tasks.md`：批准后拆分可验证任务。
- `.comate/specs/runtime-performance-stability-harness/summary.md`：完成后记录实现与取舍。
- 可能的新 benchmark / fixture / visual prototype 文件：用于把性能与稳定性变成回归资产。

## 2. Problem Statement

Morrow 当前用户感知问题：

1. Codex 回复相较 terminal 里的 `codex` 变慢，尤其首 token / 首屏反馈不稳定。
2. 对话中途会突然不继续，最终只显示“等待运行结果超时”。
3. timeout 目前多处各自实现，部分路径只更新 UI 状态，没有保证上游 request / 子进程 /
   buffer / timer 全部清理。
4. 历史上性能方案反复摆动：MCP token streaming -> PTY-first terminal parity -> provider event
   architecture。每次都修了一个维度，但没有形成可持续的性能和稳定性门禁。

用户目标：

- 性能：Morrow 的 Codex 路径必须接近 terminal `codex`，不能明显慢。
- 体验：默认界面仍是友好的 chat timeline，不把 terminal TUI 噪声暴露成主回复。
- 稳定：每次 run 必须可观测、可取消、可清理、最终结算。
- 防复发：每次改 runtime / chat / stream / release 前都能自动暴露性能或稳定性回退。

## 3. Research

### 3.1 References

| Reference | 关键信息 | 对 Morrow 的结论 |
| --- | --- | --- |
| OpenAI Codex CLI docs | Codex CLI 是本地 terminal coding agent，持续发布新版本。 | terminal `codex` 是用户自然性能基线；Morrow 需要持续校准它，而不是只做一次优化。 |
| OpenAI Codex MCP interface | `codex mcp-server` 明确标注 experimental，JSON-RPC over stdio，接口可能变化。 | MCP 可以提供结构化能力，但不应独自承担“绝不比 terminal 慢/不因 schema 变化卡死”的主体验承诺。 |
| MCP cancellation spec | stdio transport 没有可关闭的 per-request stream，必须发 `notifications/cancelled`；接收方可忽略，发送方要忽略迟到响应。 | timeout / cancel 必须建模 race：本地 Run 先结算并清理，迟到事件不能复活 UI。 |
| Electron utilityProcess docs | utility process 支持独立 serviceName、stdio 配置，适合隔离可恢复子系统。 | native PTY / 长寿命外部 CLI 继续隔离在 host process；main 只做 supervisor。 |
| xterm.js Terminal API | xterm 暴露 `onData`、`onRender`、`onWriteParsed`、`dispose` 等事件。 | 如果使用 PTY Fast Lane，renderer 应只渲染 raw bytes / 诊断，不把它反向解析成聊天事实。 |
| Morrow `streaming-and-latency` SDD | MCP 解决 token streaming、暖进程、thread 复用和 renderer O(N²) 问题。 | 保留 MCP 的结构化与 warm path 优势，但需要稳定性 owner。 |
| Morrow `agent-terminal-parity` SDD | PTY-first 能接近 terminal 速度，MCP 作为增强/fallback。 | Fast Lane 应继承 PTY-first 思路。 |
| Morrow `agent-provider-event-architecture` SDD | PTY/TUI 作为主正文会污染 chat timeline；主正文改回 provider events。 | Friendly Lane 必须独立于 PTY raw output。 |

### 3.2 Synthesis

成熟客户端共同模式：

- **速度路径与结构化路径分离**：raw terminal / stream 负责即时反馈，结构化事件负责可读状态。
- **生命周期集中管理**：request、timer、child process、buffer 由单一 owner 管理。
- **取消是状态迁移，不是 UI 文案**：cancel/timeout 后必须清理资源，并忽略迟到事件。
- **观测先于优化**：没有 TTFT、chunk latency、cleanup trace，就无法判断慢在 spawn、模型、MCP、IPC 还是 renderer。
- **性能预算变成门禁**：用户感知性能不能靠手测记忆。

关键 trade-off：

| 方案 | 优点 | 缺点 | 取舍 |
| --- | --- | --- | --- |
| MCP-only | Chat 干净、结构化、易测 | 依赖 experimental schema；不保证 terminal parity；卡死时用户看不到真实运行 | 不能作为唯一主体验 |
| PTY-only | 最接近 terminal，schema 变化无关 | TUI 噪声、回显、控制字符污染；很难稳定解析成 chat | 不能直接当主正文 |
| Dual-Lane | Fast Lane 保速度，Friendly Lane 保 UI | 架构更复杂，需要 run supervisor 和 race 处理 | 采纳 |

## 4. Decision

采用 **Dual-Lane Runtime + RuntimeRunSupervisor**。

### 4.1 Architecture

```text
Renderer Composer
  -> RuntimeRunSupervisor (main, lifecycle owner)
      -> Fast Lane: PTY codex session / raw bytes / terminal-like immediacy
      -> Friendly Lane: MCP/provider structured stream / clean chat answer
      -> Trace: created, started, first_output, chunk, done, error, timeout, cleanup
  -> Renderer
      -> Chat timeline (clean, friendly)
      -> Live run status (small, recoverable)
      -> Collapsible terminal log (diagnostic, not main truth)
```

### 4.2 Core Rule

Friendly Lane 可以失败，Fast Lane 不能被它阻塞。

Fast Lane 可以展示运行事实，不能反向污染聊天正文。

RuntimeRunSupervisor 是唯一 run lifecycle owner。Renderer 不再拥有真实 timeout 语义，只展示
supervisor 发来的 run 状态。

### 4.3 User Experience

发送后：

1. 用户消息立即进入 chat timeline。
2. Run 进入 `starting`，展示轻量运行状态。
3. Fast Lane 尽快接入 Codex PTY 输出；如果 Friendly Lane 尚未出首 token，UI 显示“Codex 正在运行”，而不是空白等待。
4. Friendly Lane 正常时，chat bubble 按结构化 chunk 流式更新。
5. Friendly Lane 慢或失败时，用户可以展开“运行日志”，看到 Codex 是否仍在运行。
6. timeout / error 后提供可恢复动作：取消、重试、重启 Codex runtime、查看诊断。

默认界面保持友好的 Morrow chat，不把 raw terminal 作为主屏幕。

## 5. Acceptance Criteria

### 5.1 Performance

在同一机器、同一 cwd、同一 prompt 下：

- Warm TTFT：Morrow 首个用户可见输出 ≤ terminal `codex` + 300ms，或 ≤ terminal 的 1.15x。
- Cold TTFT：首次启动允许额外开销，但必须显示明确运行状态，不能静默空等。
- Chunk -> UI latency：P95 < 100ms。
- 长回复：5KB 回复期间 renderer long task < 50ms。
- 连续对话：20 轮连续发送无永久 `streaming/running`，内存斜率可解释。

### 5.2 Stability

- 每个 Run exactly-once 结算到 `done | error | canceled | timeout`。
- timeout 必须触发 cancel/kill/cleanup，且发出 terminal event。
- cancel/timeout 后迟到 chunk/done/error 不得复活旧 run。
- 一个会话卡住不影响另一个会话发送。
- App 启动时旧的 running/streaming 状态不会继续卡住 UI。

### 5.3 User Experience

- 发送后 100ms 内有视觉反馈。
- 超过 1s 无结构化输出时，有明确“Codex 正在运行”状态。
- 超过 10s 的 run 必须提供取消入口。
- Error / timeout 必须有恢复动作，不只显示红字。
- Terminal log 默认折叠，仅作为诊断和高级查看。

### 5.4 Regression Assets

- Synthetic runtime 能模拟：无 done、慢首 token、只 chunk 不结束、MCP 崩溃、PTY host 崩溃、cancel 无响应、迟到响应、多会话并发。
- Benchmark 能输出 JSON/Markdown：terminal baseline、Morrow runtime trace、TTFT、chunk cadence、cleanup 结果。
- 相关改动进入 pre-commit 或 release checklist 的性能门禁。

## 6. State Ownership

| State | Class | Owner | Notes |
| --- | --- | --- | --- |
| Run durable-ish record in memory | Runtime observation / UI fact | `RuntimeRunSupervisor` | 单次运行的状态机 owner；当前不持久化完整 run 历史。 |
| Conversation.messages | UI/durable fact | renderer App 当前 owner | 只接受 supervisor 的 terminal event，不自行判定超时。 |
| Fast Lane PTY session | Runtime observation | main `PtySessionManager` + host process | raw bytes/seq/replay；不生成主正文事实。 |
| Friendly Lane MCP request | Runtime observation | main Codex provider adapter | 结构化 chunk/done/error；受 supervisor 管控。 |
| Timers/deadlines | Runtime observation | `RuntimeRunSupervisor` | first-token / idle / hard deadline 统一管理。 |
| Live text buffer | UI projection | renderer live text store | done/error/canceled/timeout 后必须清理。 |
| Terminal log panel state | UI projection | renderer | 可丢弃；不影响 run truth。 |
| Perf trace | Runtime observation | main trace collector | 本地开发/测试输出，不记录敏感 prompt 全文。 |

## 7. Invariants

1. **Exactly-once settlement**：任一 run 只能从 active 状态迁移到一个 terminal 状态一次。
2. **No resurrection**：run 进入 terminal 状态后，任何迟到 lane event 都只能记录为 ignored trace，不得改写 chat / live text。
3. **Friendly UI, fast evidence**：主 chat 只消费 Friendly Lane 结构化文本；Fast Lane raw output 只进入运行状态和诊断日志，但它的首输出可解除“空等”体验。

## 8. Boundaries

### 8.1 IPC

Renderer 只发送用户意图：

- send message / cancel run / retry run / open diagnostic log。
- 仍只传 `projectId`，cwd 由 main 解析。
- 所有 payload runtime validate。

Main 发送受控事件：

- `run:event`：状态迁移、first output、terminal state。
- `stream`：结构化 chat chunk/done/error，或后续合并到 `run:event`。
- `pty:data`：诊断 raw bytes。

### 8.2 Process Boundary

- `node-pty` 继续只在 host process 加载。
- Codex MCP 子进程由 provider adapter 管理，但生命周期受 supervisor 统一约束。
- `killAll` / cleanup 必须覆盖 PTY host、MCP pool、exec fallback、timers、buffers。

### 8.3 Cancellation

- MCP stdio cancel 使用 `notifications/cancelled`。
- cancel/timeout 后本地 run 立即进入 terminal 状态；若服务端稍后响应，按 ignored late event 处理。
- PTY cancel 先尝试 Codex 内部取消输入（如可行），再 kill session；hard deadline 必须 kill。

## 9. Visual And Interaction Design

档位：🔴 新 Flow。

原因：新增 run 状态、取消/重试/重启 runtime、诊断日志展开等用户可见恢复流。按
`docs/design/DESIGN.md § 9`，实现 UI 前必须产出视觉稿或 HTML 原型并经用户确认。

视觉产物建议：

- `.comate/specs/runtime-performance-stability-harness/prototype/index.html`
- 覆盖状态：
  - Default：正常流式回答。
  - Loading：结构化输出未到，但 Codex 已有 Fast Lane 活动。
  - Slow：超过 10s，展示取消和诊断入口。
  - Error/Timeout：显示恢复动作。
  - Extreme：长 terminal log、长错误、连续多 run。
- 键盘：
  - Esc 可取消当前 run 或关闭日志面板，具体行为需避免误取消。
  - Tab 可达 cancel / retry / diagnostics。
- 动效：
  - 只用 short/medium 展开折叠，用于状态连续性；不做装饰动画。
- Token：
  - 使用现有 CSS variables / design tokens；不新增色值 token，除非视觉稿发现现有 error/warn/info 不够用。

用户视觉确认：待确认。

## 10. Feasibility Check

触发条件：高性能诉求、系统级依赖、核心重构。

批准 Spec 后必须先做最小验证：

1. **真实 Codex parity probe**
   - 同 prompt 跑 terminal `codex` baseline 和 Morrow provider path。
   - 记录 TTFT、first visible output、total duration。
2. **Dual-lane race probe**
   - 用 synthetic runtime 模拟 Friendly Lane 慢、Fast Lane 快，验证 UI 不空等。
3. **Cleanup probe**
   - 模拟 timeout 后 MCP late response / PTY late data，验证 run 不复活。

Feasibility 失败时回到本 Spec 调整，不进入正式实现。

## 11. Implementation Sketch

### 11.1 RuntimeRunSupervisor

```ts
type RunStatus =
  | 'created'
  | 'starting'
  | 'running'
  | 'awaitingFirstOutput'
  | 'streaming'
  | 'done'
  | 'error'
  | 'canceled'
  | 'timeout';

interface RuntimeRun {
  runId: string;
  conversationId: string;
  runtime: 'codex' | 'claude';
  status: RunStatus;
  lanes: {
    fast?: LaneHandle;
    friendly?: LaneHandle;
  };
  deadlines: {
    firstOutputAt: number;
    idleAt: number;
    hardAt: number;
  };
}
```

### 11.2 Deadlines

- First-output deadline：判断用户是否需要看到“仍在运行”的明确反馈。
- Idle deadline：有输出后长时间无进展，提示可取消/重试。
- Hard deadline：强制终止，进入 timeout。

### 11.3 Late Events

所有 lane event 先过 supervisor：

```ts
if (run.isTerminal()) {
  traceIgnoredLateEvent(run.id, event);
  return;
}
```

## 12. Affected Files

预计影响，实际以 Plan 为准：

| Path | Operation | Purpose |
| --- | --- | --- |
| `src/app/main/runtime-run-supervisor.ts` | 新增 | 统一 run 状态机、deadlines、cleanup。 |
| `src/app/main/runtime-session.ts` | 修改 | 从直接 start session 改为 provider adapter / lane。 |
| `src/app/main/codex-mcp.ts` / `codex-mcp-client.ts` | 修改 | 接入 supervisor cancellation、late response、trace。 |
| `src/app/main/pty-session.ts` / `pty-supervisor.ts` | 修改 | Fast Lane handle、cleanup、health。 |
| `src/app/main/ipc.ts` | 修改 | IPC 只做 validate/map/invoke；增加 run events。 |
| `src/shared/ipc.ts` | 修改 | 增加 RunEvent DTO / cancel/retry command。 |
| `src/app/preload/index.ts` / `index.d.ts` | 修改 | 暴露 run API 和 E2E mock。 |
| `src/app/renderer/src/App.tsx` | 修改 | 从本地 timeout owner 改为消费 RunEvent。 |
| `src/app/renderer/src/lib/use-send-message.ts` | 修改 | 移除真实 timeout，发送走 run command。 |
| `src/app/renderer/src/lib/live-text-store.ts` | 修改 | 终止状态强清理。 |
| `src/app/renderer/src/components/*` | 新增/修改 | Run status、diagnostics、recovery controls。 |
| `tests/unit/*` | 新增/修改 | 状态机、renderer store、UI state。 |
| `tests/integration/*` | 新增/修改 | supervisor + synthetic runtime + cleanup。 |
| `tests/e2e/*` | 新增/修改 | 连续对话、卡死恢复、多会话隔离。 |
| `scripts/*` | 新增 | parity benchmark / release perf gate。 |
| `CHANGELOG.md` | 修改 | 用户可感知性能/稳定性变更。 |

## 13. Verification

### Targeted

- `pnpm test -- --run tests/unit/runtime-run-supervisor.spec.ts`
- `pnpm test -- --run tests/integration/runtime-run-supervisor.spec.ts`
- `pnpm test -- --run tests/e2e/runtime-stability.spec.ts`
- `pnpm test -- --run tests/e2e/codex-parity.spec.ts`（可跳过真实 Codex 时给出明确 skip）

### Full Gate

- `pnpm pre-commit`
- 发布前真实本机 parity benchmark。

## 14. Non-goals

- 不把 raw terminal 重新设为默认主界面。
- 不尝试稳定解析 Codex TUI 成聊天正文。
- 不持久化完整 terminal replay 到磁盘。
- 不引入新顶层依赖，除非 feasibility 证明现有工具无法实现 benchmark。
- 不改 AGENTS.md / DEVELOPMENT.md / CI；发布门禁先通过本仓脚本和文档 checklist 落地，CI 变更另起批准。

## 15. Open Questions

1. “重启 Codex runtime”是否杀掉当前 cwd 的 MCP pool + PTY session，还是只重启当前 run？
2. Fast Lane 首屏是否默认显示一行轻量状态，还是只有 Friendly Lane 超过 1s 未输出才显示？
3. Terminal baseline benchmark 是否允许在无真实 Codex 登录的环境中 skip，并只跑 synthetic gate？

## 16. Sources

- OpenAI Codex CLI docs: https://developers.openai.com/codex/cli
- OpenAI Codex MCP interface: https://github.com/openai/codex/blob/main/codex-rs/docs/codex_mcp_interface.md
- MCP cancellation spec: https://modelcontextprotocol.io/specification/draft/basic/utilities/cancellation
- Electron utilityProcess docs: https://www.electronjs.org/docs/latest/api/utility-process
- xterm.js Terminal API: https://xtermjs.org/docs/api/terminal/classes/terminal/
