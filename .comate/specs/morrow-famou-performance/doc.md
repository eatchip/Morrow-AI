# morrow-famou-performance — Spec Draft

> 状态：Draft，等待用户确认后进入 Feasibility Check 与 Plan。

## 1. 背景与目标

用户希望“用 FaMou 帮 Morrow 优化功能，主要确保性能指标”，但当前目标还比较模糊。本 Spec 的目标是先把问题收敛成一条可执行路径：

1. 先建立 Morrow 的性能指标契约和可复现 benchmark。
2. 再把 FaMou 用在受控、可评分、可回归的优化问题上。
3. 不让 FaMou 无边界地直接改整个 Electron 仓库。

核心判断：第一阶段不做“泛性能优化”，而是建立一个可长期复用的 FaMou 性能实验环境。首个 FaMou 任务聚焦 **Channel Workspace 长历史/多角色场景的派生视图性能**，因为它是纯数据问题，容易建立正确性 oracle，且可以直接映射到现有 `ChannelWorkspace` / `useChannelWorkspace` 中的过滤、排序、派生状态成本。

## 2. Workspace Scan

- Data files: 当前仓库没有独立业务数据集，也没有现成 FaMou `config.yaml`。性能输入需要由 evaluator 生成合成 channel workloads。
- Existing code: Electron + React + TypeScript；E2E 已用 `MORROW_E2E=1` 在 preload 层 mock runtime，适合做不触发真实 Claude/Codex 子进程的性能回归。
- Existing performance work:
  - `.comate/specs/initial-load-perf-ux/` 已诊断启动黑屏和 PATH hydrate 风险，但 tasks 尚未全部完成。
  - `.comate/specs/streaming-and-latency/` 已落地 Codex MCP 流式和 renderer chunk 合批，说明“端到端体感性能”已有历史基线。
- Key hot paths:
  - 启动链路：`src/app/main/index.ts`、`src/app/main/window.ts`、`src/app/main/runtime-detect.ts`。
  - Channel 派生视图：`src/app/renderer/src/screens/ChannelWorkspace.tsx` 当前每次 render 对 `snapshot.events` 过滤并排序，对 roles/runs/handoffs 做多次线性查找。
  - Renderer 状态编排：`src/app/renderer/src/App.tsx`、`src/app/renderer/src/lib/use-channel-workspace.ts`。
- Tooling: `famou-ctl` 已可用，API 配置完整；`famou-sdk==1.1.1` 在 Codex bundled Python runtime 中。

## 3. 外部参考与采用方式

成熟 Electron 性能问题不能靠直觉优化，采用以下参考：

| 参考 | 结论 | Morrow 采用方式 |
|---|---|---|
| Electron Performance Checklist: https://www.electronjs.org/docs/latest/tutorial/performance | 官方建议反复 profile running code，避免过早加载、阻塞 main process、阻塞 renderer process。 | benchmark 先于优化；FaMou candidate 必须用指标证明收益。 |
| Playwright Electron API: https://playwright.dev/docs/api/class-electron | Playwright 可 launch Electron、等待 firstWindow，并对窗口执行自动化。 | 复用现有 E2E 模式采集启动和交互时延。 |
| Chrome DevTools Protocol `Performance.getMetrics`: https://chromedevtools.github.io/devtools-protocol/tot/Performance/ | 可读取 runtime metrics，如 JS 执行、布局、样式计算等。 | benchmark harness 用 CDP 采集 renderer 指标。 |
| Electron `app.getAppMetrics()` / `process.getProcessMemoryInfo()` | Electron 能读取各进程 CPU / memory；macOS 上 `private` memory 更代表实际使用。 | 以内存回归预算作为硬约束，不只看耗时。 |

## 4. 性能指标契约

第一版指标分三层，避免只优化单点数字：

| 层级 | 指标 | 采集方式 | 初始阈值策略 |
|---|---|---|---|
| Startup | launch -> Home `.hero` visible | Playwright Electron + `performance.now()` | 先记录 baseline；后续要求 p50 不退化、p95 不退化超过 5% |
| Interaction | 发送 mock message -> user bubble visible / AI text visible | E2E mock runtime | p95 不退化超过 5%，目标是逐步压低 |
| Channel scalability | N channels / M roles / K events 下派生视图计算耗时、长历史渲染耗时 | Python evaluator + 后续 Playwright scenario | 首个 FaMou 任务以 p95 projection latency 和 allocation proxy 为优化目标 |
| Memory | Home idle / long channel workload 后 Electron private memory | Electron app metrics | 不允许 >5% 回归；优化任务必须报告变化 |
| Correctness | 现有 unit/contract/e2e + FaMou oracle | Vitest + evaluator oracle | 正确性失败直接 0 分 |

第一阶段不会承诺绝对 SLA，因为不同 Mac、冷/热启动、系统负载差异很大；先建立同机 baseline + 相对回归预算。

## 5. FaMou 任务选择

### 5.1 不采用的方案

- 不让 FaMou 直接生成任意 TypeScript patch：不可控，难做安全边界，也难保证架构规则。
- 不先优化启动链路：已有 `initial-load-perf-ux` SDD，且启动链路涉及 Electron 生命周期，先补 benchmark 后再动更稳。
- 不做“优化建议排序器”：它会变成主观打分，无法真正证明性能收益。

### 5.2 采用方案

首个实验：`channel_projection_optimizer`

FaMou candidate 用 Python 实现一个纯函数/策略，输入合成 `ChannelSnapshot` 和 active channel id，输出派生 view model：

- active channel
- channel roles
- ordered events for active channel
- per-event role/run/handoff lookup result
- available roles
- optional incremental cache/update policy

Evaluator 先用 baseline oracle 校验语义完全一致，再用多组规模 workloads 评分：

- small: 5 channels / 8 roles / 100 events
- medium: 20 channels / 40 roles / 2,000 events
- large: 80 channels / 200 roles / 20,000 events

评分原则：

```text
if correctness fails:
  score = 0
else:
  score = weighted_speedup - memory_penalty - complexity_penalty
```

输出不是直接合入代码，而是形成“已验证算法/策略”，再由后续 Morrow SDD 把它移植到 TypeScript，并用 Vitest / E2E 验证。

## 6. 目录与文件策略

本任务需要新建目录，但限定在 SDD 工作区内，避免污染应用源码：

```text
.comate/specs/morrow-famou-performance/
├── doc.md                  # 本 Spec
└── famou/
    └── problem.md          # FaMou Step 1 task contract
```

用户确认后才进入下一步，预计新增：

```text
.comate/specs/morrow-famou-performance/
├── tasks.md
├── feasibility.md
└── famou/
    ├── config.yaml
    ├── evaluator.py
    ├── init.py
    └── prompt.md
```

如后续需要把 benchmark harness 变成长期仓库能力，再另起实现 SDD，评审后决定是否进入 `scripts/` 或 `tests/performance/`。本 Spec 阶段不改 `package.json`、不加依赖、不改应用源码。

## 7. 状态所有权与不变量

状态所有权：

- Channel durable truth 仍由 main 侧 `ChannelsStore` / `ChannelOrchestrator` 拥有。
- Renderer 只能拥有派生 UI view model，不反向写 durable truth。
- FaMou evaluator 只拥有合成 workload 和 candidate score，不写用户数据、不改真实 app state。
- 性能 baseline 由 benchmark harness 产出，后续作为实验输入和回归证据。

不变量：

1. Candidate 输出语义必须与 baseline oracle 完全一致；性能优化不能改变用户可见顺序、角色归属、handoff/runs 关联。
2. Evaluator 必须 deterministic：同一 candidate + 同一 workload seed 得到同一 correctness 和近似稳定的 score。
3. 任何由 FaMou 产生的实现建议进入 Morrow 源码前，仍必须通过 SDD、代码评审和 `pnpm pre-commit`，不能绕过仓库质量门。

## 8. 边界、异步与合规

- 边界：FaMou 第一阶段只处理合成数据，不读取用户真实聊天、真实项目路径或 AI runtime 输出。
- 文件系统：实验文件限定在 `.comate/specs/morrow-famou-performance/famou/`；结果输出如果较大，放 `.comate/tmp/` 或本地 scratch，不纳入提交。
- 网络：只有 `famou-ctl experiment create/status/results` 会访问 FaMou 服务；本地 evaluator 不联网。
- 生命周期：实验失败可删除 FaMou experiment，不影响 Morrow 仓库。
- 合规：不上传密钥、用户本地会话、真实项目内容；API key 已由 `famou-ctl` 本地配置管理，不写入仓库。

## 9. Feasibility Check 要点

本任务有高性能诉求，用户确认 Spec 后必须先做 Feasibility Check：

1. 在本地跑通一个最小 Python evaluator：baseline projection + synthetic workload + timing。
2. 验证 `famou-ctl experiment create --config ... --json` 能接受最小实验目录。
3. 验证 evaluator 不依赖真实 Electron、Claude、Codex，也不会读写用户数据。

Feasibility 通过后再写 `tasks.md` 和完整 FaMou artifacts。

## 10. 验收标准

- `famou/problem.md` 明确、可审查，用户确认后能直接进入 Step 2。
- 后续 `config.yaml` / `evaluator.py` / `init.py` / `prompt.md` 能在本地通过最小验证。
- evaluator 至少覆盖 correctness、speed、memory proxy、complexity penalty 四类信号。
- 提交 FaMou 后能拿到 experiment id，并能轮询到 validation passed 或明确失败原因。
- 任何建议移植到 Morrow 代码前，必须再进入独立实现 Plan。

## 11. 非目标

- 不在本 Spec 阶段修改 Morrow 应用源码。
- 不新增 npm / Python 顶层依赖。
- 不把 FaMou 作为自动 merge 或自动 patch 工具。
- 不上传真实用户会话、真实项目文件或本机私有路径数据。
- 不替代已有 `initial-load-perf-ux` / `streaming-and-latency`，而是给后续性能优化建立量化闭环。

## 12. 待用户确认

默认假设如下：

- 第一阶段优先优化 Channel Workspace 长历史性能，而不是启动链路。
- 指标采用“同机 baseline 相对提升/不回归”，暂不承诺跨机器绝对 SLA。
- FaMou 实验目录放在 `.comate/specs/morrow-famou-performance/famou/`。

确认后进入 Feasibility Check，再写 Plan 和完整 FaMou artifacts。
