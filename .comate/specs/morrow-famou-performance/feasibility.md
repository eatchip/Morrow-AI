# morrow-famou-performance — Feasibility Check

## 结论

可行。首个 FaMou 任务应聚焦 `ChannelWorkspace` 的纯数据 projection 性能，先产出可评分策略，再由后续 Morrow 实现 SDD 移植到 TypeScript。

## 已验证内容

### 1. 本地 evaluator 原型可行

在 ignored scratch 目录 `.comate/specs/morrow-famou-performance/famou/build/` 中创建了最小 evaluator 原型：

- 生成 deterministic `ChannelSnapshot` synthetic workloads。
- 实现 baseline oracle：过滤 active channel events、按 `createdAt` + original input order 稳定排序、线性查找 role/run/handoff。
- 加载 candidate 的 `project(snapshot, active_channel_id)` 函数。
- 检查 candidate 不修改 evaluator-owned input。
- correctness 失败时返回 `validity = 0`、`combined_score = 0`。
- correctness 通过后用 p95 latency、speedup、memory proxy、source size penalty 计算 score。

### 2. evaluator 能区分可行解质量

运行结果摘要：

| Candidate | Validity | Score | Weighted speedup | 结论 |
|---|---:|---:|---:|---|
| `candidate_naive.py` | 1.0 | ~99 | ~0.99x | 可行但接近 baseline |
| `candidate_indexed.py` | 1.0 | ~209 | ~3.27x | 可行且明显更优 |
| `candidate_bad.py` | 0.0 | 0 | n/a | 语义不匹配，被正确拒绝 |

关键观察：

- large workload 下，indexed candidate p95 约 `1.9ms`，naive/baseline 约 `10-12ms`。
- correctness gate 能捕获明显错误输出。
- 评分方向符合预期：indexed > naive > invalid。

### 3. FaMou CLI 本地加载链路可行

使用 scratch `config.yaml` 跑过：

```bash
famou-ctl test --config .comate/specs/morrow-famou-performance/famou/build/config.yaml --json
```

第一次失败点是 config 最小参数约束：

- `max_iterations >= 10`
- `population_size >= 10`
- `num_islands >= 2`

修正为最小合法值后，本地测试通过，CLI 返回：

- `success: true`
- message: local environment is ready
- score: ~96

这证明 FaMou CLI 可以加载该 evaluator 形态和初始解。

## 未在 Feasibility 阶段执行的内容

- 未执行 `famou-ctl experiment create` 或远程 dry-run。
- 原因：正式 `config.yaml`、`evaluator.py`、`init.py`、`prompt.md` 尚未按 Plan 生成；远程校验和提交应在 Plan 审批后执行。

## 风险与处理

| 风险 | 当前判断 | 处理 |
|---|---|---|
| timing 有机器噪声 | 存在 | 用多 workload、p95、相对 speedup；正确性是硬门槛 |
| Python 策略移植到 TypeScript 后收益缩水 | 存在 | FaMou 输出只作为算法证据；移植后仍需 Morrow 单测和 E2E/perf benchmark |
| candidate 使用不安全能力 | 可控 | 正式 evaluator 增加 source scan + subprocess timeout + isolated cwd |
| memory proxy 粗糙 | 可接受 | 第一版用 `tracemalloc` peak；后续移植时用 Electron metrics 验证 |

## Feasibility 结论

进入 Plan。正式实现应把 scratch 原型收敛为 FaMou 标准 artifacts：

- `famou/evaluator.py`
- `famou/init.py`
- `famou/prompt.md`
- `famou/config.yaml`

并在提交远程实验前通过：

1. `python evaluator.py init.py`
2. 至少两个可行候选质量区分验证
3. `famou-ctl test --config config.yaml --json`
4. `famou-ctl experiment create --config config.yaml --experiment-name <name> --dry-run --json`
