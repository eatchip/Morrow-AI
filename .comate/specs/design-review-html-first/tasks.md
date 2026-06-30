# Tasks: design-review-html-first

> 对应 [doc.md](./doc.md)。执行顺序为自上而下；每完成一个顶层任务即更新本文件的 checkbox。

- [x] Task 1: 预检与起点核对
    - 1.1: 重读 `DESIGN.md §9` 与 `design-review.md Phase 0` 的现状，锁定待修改锚点
    - 1.2: 确认 `package.json` 当前 scripts 段、确认 5178 端口未被占用
    - 1.3: 确认 `.gitignore` 未误伤 `.comate/specs/**/prototype/**`

- [x] Task 2: 改 `docs/design/DESIGN.md §9` 载体优先级
    - 2.1: 触发表行文保持不变，仅重写"载体优先级"小节为 doc.md §3.1 方案
    - 2.2: 并列首选改为"AI 生成的 HTML 可交互原型 / Figma 文件"
    - 2.3: 删除"从 Figma 降级必须留痕"相关措辞
    - 2.4: 追加指向 `design-review.md` 的"AI 产出 HTML 原型规约"锚点

- [x] Task 3: 改 `docs/playbooks/design-review.md Phase 0`
    - 3.1: Step 0.1 载体表改为并列首选（与 DESIGN.md §9 保持同义）
    - 3.2: 删除 "降级必须留痕" 段
    - 3.3: 新增子节"AI 产出 HTML 原型规约"，内容对应 doc.md §3.2 与 §3.3（路径、版本化、latest 指针、技术栈、运行方式、每轮产出流程、关注点清单上限 5 条）
    - 3.4: 更新 Step 0.4 "用户确认闸门"措辞，强调"已确认 vN 版本号"入 Spec

- [x] Task 4: 新增 `scripts/serve-prototype.mjs`
    - 4.1: 解析命令行参数 `{feature-name}`，缺省时打印 usage 并 exit 1
    - 4.2: 定位 `.comate/specs/{feature-name}/prototype/latest/`（软链解析兼容 Windows `latest.txt` 回退）
    - 4.3: Node 内置 `http` + `fs`，监听 5178；MIME 至少覆盖 html/js/mjs/css/svg/png/ico/json
    - 4.4: 路径穿越防护（拒绝 `..` 与绝对路径逃逸）
    - 4.5: 启动日志打印服务 URL 与源目录；SIGINT 优雅退出

- [x] Task 5: `package.json` scripts 登记
    - 5.1: 新增 `"prototype:serve": "node scripts/serve-prototype.mjs"`
    - 5.2: 不触碰其他 scripts / dependencies / overrides

- [x] Task 6: 产出自证原型
    - 6.1: 创建 `.comate/specs/design-review-html-first/prototype/v1/index.html`，内容为"Hello Morrow 原型闸门就绪"单页 + Tailwind Play CDN 基本样式
    - 6.2: 创建同目录 `README.md`（本版关注点 ≤ 5 条 + 打开方式）
    - 6.3: 建立 `prototype/latest` 指向 `v1`（macOS 用 symlink；同时写 `latest.txt` 记录 `v1` 作为跨平台兜底）

- [x] Task 7: 本地验证
    - 7.1: 双击 `index.html` 或 `open` 命令，确认能在 file:// 下加载 Tailwind
    - 7.2: 运行 `pnpm prototype:serve design-review-html-first`，访问 `http://localhost:5178`，确认返回 v1 页面
    - 7.3: 跑 `pnpm check` 与 `pnpm format-check:staged`，确认无新增错误

- [x] Task 8: 收尾与留档
    - 8.1: 更新 `CHANGELOG.md [Unreleased]` 增加一条 Changed（载体优先级调整）+ 一条 Added（`scripts/serve-prototype.mjs` 与 `pnpm prototype:serve`）
    - 8.2: 产出 `.comate/specs/design-review-html-first/summary.md`（落地清单 + 偏差记录 + 后续触达点）
    - 8.3: 确认所有任务 checkbox 勾选完毕
