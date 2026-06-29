# Tasks: no-project-cwd-isolation

按 TDD 推进；每个 top-level task 完成即提交一次（worktree: `../Morrow-no-project-cwd-isolation`，branch: `fix/no-project-cwd-isolation`）。

- [x] Task 1: 主进程 — no-project cwd 隔离
    - 1.1: 写 unit test（tests/unit/main/runtime-session.test.ts 或新增）：断言 `startSession` 必须显式接收 cwd 字符串；mock spawn 校验传入的 `spawnOptions.cwd` 等于注入值
    - 1.2: 修改 `src/app/main/runtime-session.ts`：`StartSessionArgs.cwd` 由 `string | null | undefined` 收敛为必填 `string`；删除 `if (args.cwd)` 分支，spawnOptions 永远显式带 cwd
    - 1.3: 修改 `src/app/main/ipc.ts`：在 `registerIpc` 中计算 `noProjectCwd = path.join(app.getPath('userData'), 'no-project-cwd')`，`fs.mkdirSync(..., { recursive: true })`；`projectId` 为 null/undefined 时把 cwd 设为它，再调 `startSession`
    - 1.4: 跑 `pnpm test` 相关用例确认绿；commit

- [x] Task 2: 渲染层 — ProjectPicker locked&&!active 静态化
    - 2.1: 写 unit test（tests/unit/renderer/ProjectPicker.test.tsx 或新增）：`locked=true, activeProjectId=null` 时点击触发器不展开 panel；`locked=true, active != null` 仍能展开并看到"退出项目"
    - 2.2: 修改 `src/app/renderer/src/components/ProjectPicker.tsx`：引入 `lockedNoProject = locked && !active`；触发器在该状态下 onClick no-op、`aria-haspopup`/`aria-expanded` 设为 false、文案改为"本对话未关联项目"
    - 2.3: 跑相关 unit test 绿；commit

- [x] Task 3: 端到端验证 + 收尾
    - 3.1: `pnpm pre-commit` 全量闸门；失败必须修复，禁止 `--no-verify`
    - 3.2: 手动验证：未添加项目 → 新对话发 "hi" → Codex 回复中不再出现 Morrow 路径 / AGENTS.md 引用；定版后 picker 触发器变静态"本对话未关联项目"
    - 3.3: 更新 `CHANGELOG.md` `[Unreleased]` 段（用户可感知变更）
    - 3.4: 写 `.comate/specs/no-project-cwd-isolation/summary.md`；commit；worktree 收尾留给用户决定何时合入 main
