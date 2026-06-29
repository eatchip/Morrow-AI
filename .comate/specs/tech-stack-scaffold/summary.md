# Summary: tech-stack-scaffold

> SDD 收尾文档 —— 产物清单、验收状态、遗留 TODO、复盘要点。

---

## 1. 目标回顾

把 ADR 0004 与 `DEVELOPMENT.md` 既定的技术栈**规约**落成**可执行**的最小工程骨架：
`pnpm install / dev / build / test / test:e2e / pre-commit` 真实可跑；Electron 三进程骨架 + 冒烟测试 + pre-commit 闸门全部到位；**不引入任何业务代码**。

---

## 2. 产物清单（与 `doc.md § 3` 对照）

### 2.1 包管理 / 构建

| 文件 | 说明 |
|---|---|
| `package.json` | engines (Node ≥22.12 / pnpm ≥9.6)、31 个 scripts、deps 7 / devDeps 21、`pnpm.onlyBuiltDependencies`、security overrides |
| `.npmrc` | `engine-strict=true` / `auto-install-peers=true` |
| `pnpm-lock.yaml` | 首次 install 自动生成，纳入版本管理 |
| `.gitignore` | 追加 `out/` `dist/` `coverage/` `playwright-report/` `test-results/` |

### 2.2 TS / Lint / Format / Secret

| 文件 | 说明 |
|---|---|
| `tsconfig.json` | root references 联邦 |
| `tsconfig.node.json` | main + preload + scripts，ES2022 / NodeNext |
| `tsconfig.web.json` | renderer，JSX react-jsx，DOM+ES2022 lib |
| `.oxlintrc.json` | ts / react / unicorn 基线；`no-restricted-imports` 守 renderer 不 import electron/main/preload；React 19 auto-runtime |
| `.prettierrc` / `.prettierignore` | printWidth 100 / singleQuote；忽略 harness 文档 + `.husky/` |
| `.secretlintrc.json` | `@secretlint/secretlint-rule-preset-recommend` |

### 2.3 Electron 三进程

| 文件 | 说明 |
|---|---|
| `electron.vite.config.ts` | 三端装配，产物到 `out/` |
| `src/app/main/index.ts` | `app.whenReady` + macOS activate + window-all-closed |
| `src/app/main/window.ts` | `createMainWindow` 工厂，安全三开关全开 |
| `src/app/preload/index.ts` | `contextBridge.exposeInMainWorld('morrowApi', Object.freeze({}))` |
| `src/app/preload/index.d.ts` | `Window['morrowApi']` 类型 |
| `src/app/renderer/index.html` | 基础 CSP meta |
| `src/app/renderer/src/{main.tsx,App.tsx,index.css}` | 冒烟 `<p data-testid="scaffold-ok">` |

### 2.4 测试层

| 文件 | 说明 |
|---|---|
| `vitest.config.ts` | happy-dom + @testing-library/jest-dom；include 白名单 |
| `tests/setup/vitest.setup.ts` | jest-dom import |
| `tests/unit/scaffold.spec.ts` | sanity |
| `tests/contract/preload-api-shape.spec.ts` | 静态断言桥 shape 为冻结空对象 |
| `playwright.config.ts` | electron project，offscreen，workers=1 |
| `tests/e2e/scaffold-smoke.spec.ts` | 拉 Electron 断言 `[data-testid="scaffold-ok"]`；env 清掉 `ELECTRON_RUN_AS_NODE` |
| `scripts/test-e2e-with-window-fallback.mjs` | 自动 build + 剥离 IDE 注入的环境变量 |

### 2.5 Pre-commit 闸门

| 脚本 | 职责 |
|---|---|
| `scripts/check-max-lines.mjs` | staged 单文件 ≤ MAX_LINES（默认 400），二进制跳过 |
| `scripts/check-secrets-staged.mjs` | 转调 secretlint + staged 过滤 |
| `scripts/check-naming-staged.mjs` | 占位（stderr TBD，exit 0）|
| `scripts/check-format-staged.mjs` | `prettier --check --ignore-unknown` |
| `scripts/run-vitest-related-staged.mjs` | `vitest related --run` |
| `scripts/run-precommit-e2e.mjs` | staged 命中 renderer/preload/main/e2e 才跑 E2E |
| `.husky/pre-commit` | 注入 Node 22 + corepack pnpm PATH → `pnpm pre-commit` |

### 2.6 文档联动

| 文件 | 变更 |
|---|---|
| `CHANGELOG.md` | Added 追加产物清单；Notes 阶段升级为 Scaffold Landed |
| `DEVELOPMENT.md` | §Setup / §项目结构 / §Pre-commit 闸门 三处 🚧 → 真实状态快照（用户授权） |
| `AGENTS.md` | §1.8 末句重写；§7 去掉脚手架过期 blockquote（用户授权） |

---

## 3. 验收对照（`doc.md § 9`）

### P0（必达）

- [x] `pnpm install` 干净通过
- [x] `pnpm dev` 拉起 Electron 显示 "scaffold ok"
- [x] `pnpm build` 产出 `out/main/index.js` / `out/preload/index.js` / `out/renderer/index.html`
- [x] `pnpm check` 类型零错误
- [x] `pnpm lint` / `pnpm format:check` 零错误
- [x] `pnpm test -- --run` 单元 + contract 全绿（2 test）
- [x] `pnpm test:e2e` 冒烟绿（1 test）
- [x] `pnpm pre-commit` 8 步全绿（Task 6/7 两次 commit 自触发全绿验证）
- [x] `src/app/{main,preload,renderer}` 三端边界（oxlint `no-restricted-imports` + tsconfig references 双保险）

### P1（体验 / 记录）

- [x] `CHANGELOG.md` 已更新
- [x] `DEVELOPMENT.md` 🚧 已去除
- [x] `AGENTS.md §1.8` 末句已改写
- [x] Commit 拆分：7 次 atomic commit（ADR 严格守住 `<type>(<scope>): <what> · <why>` 格式）
  - `chore(scaffold): bootstrap package manifest and install baseline`
  - `chore(scaffold): wire typescript / oxlint / prettier / secretlint configs`
  - `feat(scaffold): wire electron main/preload/renderer entry with safe defaults`
  - `test(scaffold): add vitest config and smoke unit/contract specs`
  - `test(scaffold): add playwright e2e smoke and window fallback launcher`
  - `chore(scaffold): wire pre-commit gate scripts and husky hook`
  - `docs(scaffold): close changelog and update harness status`

### P2（明确不做，已记录）

- [x] CHANGELOG Notes 段声明延后 SDD：`design-tokens-enforcement` / `naming-rules` / E2E 降级链 / Figma MCP
- [x] DEVELOPMENT 结构快照注明"DDD 四层目录尚未创建，由第一个业务 context SDD 引入"

---

## 4. 遗留 TODO（交接给后续 SDD）

| 项 | 承接 SDD | 现状 |
|---|---|---|
| Token 硬规则由 lint 强制 | `design-tokens-enforcement` | 当前由 code review 把关 |
| 命名规范 lint | `naming-rules` | `scripts/check-naming-staged.mjs` 占位 `exit 0` |
| E2E 窗口降级链（hidden → offscreen → inactive） | 后续 E2E 稳定化 SDD | 目前仅 offscreen 一档 |
| Figma MCP 正式接入 | 独立视觉链路 SDD | 视觉稿载体暂按 design-review.md 自由选择 |
| 业务 context 四层目录（domain/application/infrastructure/presentation） | 第一个业务 SDD | 本 SDD 刻意未预铺（不过度工程化） |

---

## 5. 过程中的关键决策 / 踩坑

### 5.1 Node 22 本机缺失 → 手动 tarball 安装

- ADR 0004 硬要求 Node ≥ 22.12，但机器为 v20.12.2
- fnm 脚本因 Homebrew 缺失失败，改用 npmmirror.com 直传 tarball 到 `~/.local/share/node-versions/v22.22.2/`
- `.zshrc` 修改 PATH；`corepack enable && corepack prepare pnpm@9.6.0 --activate`

### 5.2 React 19 JSX 类型推断

- `App(): JSX.Element` 在 React 19 下找不到 `JSX` 命名空间 → 去掉返回类型让推断接管
- oxlint 配 `react/react-in-jsx-scope: off`（auto-runtime 下不需要 `import React`）

### 5.3 `ELECTRON_RUN_AS_NODE` 污染

- Comate IDE 在父环境注入了 `ELECTRON_RUN_AS_NODE=1`，导致 Playwright 启 electron 时被识别为 Node 进程，`--remote-debugging-port` 选项报错
- 双处清理：`tests/e2e/scaffold-smoke.spec.ts` 构造 clean env + `scripts/test-e2e-with-window-fallback.mjs` spawnSync env 中删掉该变量

### 5.4 Husky v9 在 git 剥离环境里 PATH 丢失

- `git commit` 调用 hook 时 PATH 被剥离，找不到 `pnpm`
- `.husky/pre-commit` 开头显式 `export PATH=...`，涵盖 `~/.local/share/node-versions/...`、`~/.local/node/bin`、`/opt/homebrew/bin`、`/usr/local/bin` 四种常见安装位置

### 5.5 `prettier --check` 遇到无扩展名文件

- `.husky/pre-commit` 无扩展名 prettier 无法推断 parser → staged 检查报 exit 2
- 修：`.prettierignore` 加 `.husky/`；`check-format-staged.mjs` 加 `--ignore-unknown`

---

## 6. 未触达 Out of Scope 的自检

- 未引入 ADR 0004 清单外的顶层依赖
- AGENTS.md / DEVELOPMENT.md 修改在用户明确授权（A 选项）后才执行
- 未改 CI / 发布配置（repo 当前无 CI，未新增）
- 未改 ADR 状态
- 未触碰密钥 / 生产凭证
- 批量重构规模可控，无 > 5 文件的非机械性修改

---

## 7. 验证命令（复现）

```bash
# 完整自检
pnpm install
pnpm check
pnpm lint
pnpm format:check
pnpm test -- --run
pnpm build
pnpm test:e2e
pnpm pre-commit   # 空 staged 时 8 步应全绿

# 冒烟人工
pnpm dev   # 应看到 "scaffold ok"
```

---

## 8. 下一步建议

按优先级：
1. **第一个业务 context SDD**：例如 `translation-editor-mvp`（对齐 Morrow 产品设定），开始铺 DDD 四层目录与首个 IPC channel（会触发 preload API 正式命名 ADR）。
2. **`naming-rules` SDD**：把命名规范从空气落成 ADR + `check-naming-staged.mjs` 实装，解锁当前占位闸门。
3. **`design-tokens-enforcement` SDD**：把 `AGENTS.md §1.8` 的硬规则升级为 lint 强制（需配合首批实际组件/token 数据落地）。
4. **CI pipeline**：本地闸门链已稳定，可平移到 GitHub Actions / 其他 CI，门槛 = `pnpm pre-commit` 全绿。
