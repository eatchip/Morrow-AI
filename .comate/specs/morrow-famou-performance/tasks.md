# morrow-famou-performance — Plan

> 状态：等待用户确认。确认后再开始执行正式 artifacts 和远程 FaMou 操作。

- [x] Task 1: 固化 FaMou evaluator
  - 从 feasibility prototype 提炼 `famou/evaluator.py`。
  - 保留固定接口 `evaluate(path_user_py: str, task_name: str = "default", timeout: int = 3600) -> dict`。
  - 加入硬约束：无网络、无文件写、无 subprocess、不得修改输入、必须暴露 `project(snapshot, active_channel_id)`。
  - 支持 correctness details、p95 latency、speedup、memory proxy、complexity penalty。
  - 验证：`python famou/evaluator.py <candidate.py>` 可返回合法 JSON。

- [x] Task 2: 准备两个可行候选并选择 `init.py`
  - 实现 baseline/naive candidate。
  - 实现 indexed candidate。
  - 用 evaluator 确认两者都 `validity == 1`、`error_info == ""`。
  - 保留质量更好的 indexed 策略作为 `famou/init.py`，把其他候选放入 ignored `famou/build/`。
  - 验证：indexed score 明显高于 naive。

- [x] Task 3: 编写 `prompt.md` 和 `config.yaml`
  - `prompt.md` 控制在 100 行内，明确角色、任务、数据结构、硬约束、参考可行解。
  - `config.yaml` 使用 FaMou CLI 最小合法参数起步：`max_iterations: 10`、`population_size: 10`、`num_islands: 2`。
  - `initial_program` 指向 `init.py`，`evaluator` 指向 `evaluator.py`，`system_message` 指向 `prompt.md`。
  - 验证：config 文件路径和字段能被 `famou-ctl test` 识别。

- [x] Task 4: 本地验证 FaMou artifacts
  - 运行 `python famou/evaluator.py famou/init.py`。
  - 运行 `famou-ctl test --config famou/config.yaml --json`。
  - 修复所有 evaluator/config/prompt 形态问题。
  - 验证：local test 返回 `success: true`。

- [x] Task 5: 远程提交前 dry-run
  - 运行 `famou-ctl experiment create --config famou/config.yaml --experiment-name <name> --dry-run --json`。
  - 若网络或权限失败，记录阻塞点；不绕过 API 配置。
  - 验证：dry-run 能返回可提交状态或明确失败原因。

- [x] Task 6: 提交 FaMou 实验并轮询验证
  - experiment name 使用不超过 20 字符、仅字母数字下划线，例如 `morrow_perf_01`。
  - 运行 `famou-ctl experiment create --config famou/config.yaml --experiment-name morrow_perf_01 --json`。
  - 每 10 秒查询状态，直到 validation passed 或 failed。
  - 若 failed，修复 evaluator/init/prompt，删除失败实验后重提。
  - 验证：拿到 experiment id，且在线 validation 通过。

- [x] Task 7: 拉取结果并形成 Morrow 后续实现输入
  - 用 `famou-ctl experiment results <experiment-id> --output <path> --json` 获取结果。
  - 总结最佳策略、score、关键 trade-off。
  - 如果策略值得移植，新开独立 Morrow 实现 SDD，不直接把 FaMou 输出合入应用源码。
  - 验证：生成 `summary.md`，包含可复现命令、实验 id、最佳 candidate 摘要、后续建议。

## 执行边界

- 不改 Morrow 应用源码。
- 不新增顶层依赖。
- 不上传真实用户数据、真实会话或本机私有项目内容。
- 远程提交前必须先通过本地 `famou-ctl test`。
