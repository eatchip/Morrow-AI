# Tasks · agent-model-picker

> 基于 `doc.md` 拆分的独立可验证任务。执行顺序自顶向下；每个任务完成后留一次 commit（按 AGENTS.md §5 Commit Hygiene）。
> 所有路径基于 worktree：`/Users/songhuiyu/Morrow-agent-model-picker/`

- [x] Task 1: 扩展 IPC 契约（shared/ipc.ts）
    - 1.1: 在 `SendPromptArgs` 增补 `model?: string`、`effort?: 'minimal' | 'low' | 'medium' | 'high'`
    - 1.2: 导出常量 `CODEX_MODELS`、`CLAUDE_MODELS`、`EFFORT_LEVELS`、`MODEL_ID_REGEX` 作为唯一来源
    - 1.3: 导出类型别名 `EffortLevel`
    - 1.4: JSDoc 注明校验责任在主进程 ipc 层

- [x] Task 2: 主进程校验与命令构造（main/ipc.ts + main/runtime-session.ts）
    - 2.1: `main/ipc.ts` 在 sendPrompt handler 中按 `MODEL_ID_REGEX` 和 `EFFORT_LEVELS` 校验新字段；违反即 emit `kind: 'error'` 并 return（不落 spawn）
    - 2.2: `StartSessionArgs` 增补 `model?` / `effort?` 字段
    - 2.3: `buildCmd` 按 runtime 注入 flag：
        - codex：`['exec', '--model', model, '-c', `model_reasoning_effort=${effort}`, '--json', ...]`（仅在字段存在时注入对应 flag，独立 argv 元素）
        - claude：`['--model', model, '-p', prompt, ...]`
    - 2.4: 未传 `model`/`effort` 时不注入对应 flag，保证老会话零回退

- [x] Task 3: buildCmd 单测（tests/unit/runtime-session.spec.ts）
    - 3.1: 若文件不存在则新建；定位现有测试目录约定
    - 3.2: codex: 无 model/effort → 现状 argv
    - 3.3: codex: 有 model + effort → argv 精确断言（位置顺序、独立元素、无 shell 拼接）
    - 3.4: claude: 有 model → argv 精确断言
    - 3.5: 非法 model（含空格、反引号、`$()`）不走到 buildCmd（由 ipc 层拦截，在 ipc 层单测中覆盖）

- [x] Task 4: IPC 边界校验契约测试（tests/contract/send-prompt-args.spec.ts）
    - 4.1: 新建；导入 `main/ipc.ts` 的校验函数（如不对外暴露，抽出纯函数 `validateSendPromptArgs`）
    - 4.2: 覆盖合法 / 非法 model 正则 / 非法 effort / runtime 缺失等 case

- [x] Task 5: Preload 透传（preload/index.ts）
    - 5.1: `sendPrompt` 签名对齐新的 `SendPromptArgs`
    - 5.2: 仅做结构透传，不做业务校验（业务校验唯一事实源是主进程）
    - 5.3: 同步更新 `preload/index.d.ts`

- [x] Task 6: 偏好持久化纯函数（renderer/src/lib/agent-prefs.ts）
    - 6.1: 新建文件，定义 `AgentPrefs` 接口与默认值（codex 默认 `gpt-5-codex` + `medium`；claude 默认 `sonnet`）
    - 6.2: `loadPrefs()` / `savePrefs()` 基于 `localStorage['morrow:agent-prefs:v1']`
    - 6.3: `sanitizePrefs(raw: unknown): AgentPrefs` —— 非法字段回退默认，不抛
    - 6.4: 所有常量从 `shared/ipc.ts` 导入（禁止两处 drift）

- [x] Task 7: agent-prefs 单测（tests/unit/agent-prefs.spec.ts）
    - 7.1: 默认值正确
    - 7.2: 非法 JSON 回退默认
    - 7.3: 缺字段 / 非法 effort / 非白名单 model 回退到默认字段
    - 7.4: save → load 往返等价

- [x] Task 8: ModelPicker 组件（renderer/src/components/ModelPicker.tsx + 样式）
    - 8.1: 新建组件，props: `runtime`, `value: AgentPrefs[runtime]`, `onChange`
    - 8.2: chip 触发器 + Popover（点击外部 / Esc 关闭）
    - 8.3: codex runtime 显示"模型 + 智能"两段；claude runtime 只显示"模型"
    - 8.4: 使用 design tokens（`--radius-md`、`--surface-elev-1`、`--fg-subtle` 等），无硬编码色值
    - 8.5: 键盘可达（Tab / 方向键 / Enter）

- [x] Task 9: 接入 Composer 与 App（Composer.tsx / App.tsx / Chat.tsx）
    - 9.1: `App.tsx` 持 `AgentPrefs` state + `useEffect` 同步 localStorage
    - 9.2: 向下传 `prefs` 和 `onChangePrefs` 到 Chat → Composer
    - 9.3: `Composer.tsx` 在 composer-row 插入 `<ModelPicker>`，不破坏现有布局/快捷键
    - 9.4: `sendPrompt` 调用链携带 `model` / `effort`
    - 9.5: runtimeLabel 文案不重复显示模型（避免冗余）

- [x] Task 10: E2E 冒烟（tests/e2e/model-picker.spec.ts）
    - 10.1: 打开应用 → 进入 Chat → 打开 ModelPicker → 切换模型 → 关闭
    - 10.2: 断言触发器文案更新
    - 10.3: 重启应用（或重载 window）→ 断言偏好仍在
    - 10.4: 遵循 `playwright.config.ts` 现有启动约定

- [x] Task 11: 文档与收尾
    - 11.1: `CHANGELOG.md` `[Unreleased]` 增加用户可感知条目
    - 11.2: `pnpm pre-commit` 跑全绿
    - 11.3: 自审：所有硬编码 model / effort 值均从 `shared/ipc.ts` 常量导入；无 `shell: true`；无 `--no-verify`
    - 11.4: 生成 `.comate/specs/agent-model-picker/summary.md`
