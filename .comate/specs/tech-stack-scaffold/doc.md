# Spec: tech-stack-scaffold

> 把 ADR 0004 与 `DEVELOPMENT.md` 已写死的**技术栈规约**落成一个**可运行、可测、可 pre-commit、可构建**的最小工程骨架。
>
> 本 SDD 的边界：**不写任何业务代码**，不做视觉设计，不做 CI 流水线配置，不做签名/发布。完成后，仓库第一次从"文档仓"变成"可执行仓"。

---

## 1. 背景与动机

仓库当前处于 Harness Refinement 阶段：
- 工程规约、架构契约、设计契约、ADR 体系均已就位；
- 但**没有 `package.json`，没有任何 `src/`**，`DEVELOPMENT.md` 中所有 `pnpm *` 命令仅以**规约**形式存在；
- `AGENTS.md § 1.8` 的"设计 token 硬规则"目前靠 code review 把关，无法升级为 lint 强制；
- 任何后续业务 SDD（第一个 demo、第一个 context）都阻塞在"没有可运行骨架"这一件事上。

本 SDD 就是拆这块堵点。完成后：
- 可执行 `pnpm install / dev / build / test / test:e2e / pre-commit`；
- 存在一个最小可冒烟的 Electron 空壳窗口（用于验证 Playwright E2E 链路）；
- `src/` 只铺**三进程边界**（main / preload / renderer），DDD 分层目录**不提前创建**，等第一个业务 context 来时再铺（遵守 Golden Rule #2 不过度工程化）。

---

## 2. 业界参考与裁剪

**Research 对象（按 `docs/playbooks/research-method.md`）**：

| 参考 | 取 | 舍 |
|---|---|---|
| **OpenCove**（同机 `~/opencove/`） | 整套 `package.json` 脚本与 pre-commit 闸门；`electron.vite.config.ts` 三端装配思路；pnpm `onlyBuiltDependencies` / `overrides` 写法；husky + lint-staged 三段 matcher；`scripts/*.mjs` 一系列闸门脚本的职责划分 | 业务依赖（`@dnd-kit` / `@xterm/*` / `@xyflow` / `better-sqlite3` / `drizzle-orm` / `node-pty` / `ws` / tailwind / lucide-react）；CLI bin 入口；release-manifest；web-canvas / web-shell 专用 playwright 配；复杂的降级 E2E 脚本实现细节 |
| **electron-vite 官方模板** | 三端 entry 组织、preload 默认 `contextBridge` 写法、vite HMR 与 main/preload 不走 HMR 的语义 | 模板自带的示例组件 |
| **electron-toolkit** | `@electron-toolkit/preload` 提供的 `electronAPI` 基座；`@electron-toolkit/utils` 的 `optimizer.watchWindowShortcuts` / `is.dev` | — |

**Adapt 原则**：
- OpenCove 脚本即"规约答案"：`DEVELOPMENT.md § Pre-commit 闸门` 写的 8 步完全对齐 OpenCove 的 `pre-commit` 脚本顺序，直接迁移、改名即可；
- `scripts/*.mjs` **不逐字复制**，先实现最小可工作版本（line-check / secret-check / naming-check / format-check:staged / test:staged / test:e2e:pre-commit 六个），`naming-check` 规则内容等未来命名 ADR，现在只做空壳（pass-through）并在日志里声明"规则未定，默认放行"，避免伪实现；
- **不引入 release-manifest / electron-updater**：ADR 0004 已把发布流程推迟到 ADR 0006，本 SDD 不触碰。

---

## 3. 范围（Scope）

### 3.1 包含（IN）

**根级配置文件**
- `package.json`（含 scripts / engines / dependencies / devDependencies / lint-staged / pnpm overrides / electron-builder 最小字段）
- `pnpm-workspace.yaml` ❌ **不创建**（当前单包即可；未来需要再拆）
- `.npmrc`（`engine-strict=true` / `auto-install-peers=true`）
- `tsconfig.json`（根 references 聚合）
- `tsconfig.node.json`（main / preload 侧）
- `tsconfig.web.json`（renderer 侧）
- `electron.vite.config.ts`（三端装配 + alias + CSP 开关）
- `vitest.config.ts`（happy-dom + testing-library 环境 + 四层 include 白名单）
- `playwright.config.ts`（electron project，默认 `offscreen` 窗口模式）
- `.oxlintrc.json`（基础规则 + React + TS）
- `.prettierrc` + `.prettierignore`
- `.secretlintrc.json`
- `.husky/pre-commit`（单行调用 `pnpm pre-commit`）
- `.editorconfig` / `.gitattributes` / `.gitignore` **已存在，按需微调**（补 `out/` / `dist/` / `coverage/` / `.turbo/` 条目）

**`scripts/`（最小可工作版）**
- `scripts/check-max-lines.mjs` — 单文件行数上限检查（默认 400，通过 `MAX_LINES` 环境变量覆盖；只看 staged）
- `scripts/check-secrets-staged.mjs` — 壳子：转调 `secretlint` 并过滤 staged 文件列表
- `scripts/check-naming-staged.mjs` — 壳子：打印 "naming rules TBD (see future ADR), pass"，exit 0
- `scripts/check-format-staged.mjs` — 壳子：转调 `prettier --check` 过滤 staged
- `scripts/run-vitest-related-staged.mjs` — 壳子：转调 `vitest related --run` 过滤 staged
- `scripts/run-precommit-e2e.mjs` — 壳子：检测 staged 是否命中 renderer/presentation 路径，命中则 `pnpm test:e2e`，否则打印 "no user-facing change, skip" 退出 0
- `scripts/test-e2e-with-window-fallback.mjs` — 壳子：最小版本，固定用 `offscreen`，暂不实现自动降级链（先满足 `DEVELOPMENT.md § E2E 执行规约` 的命令契约，降级链作为 TODO 注释 + 未来 SDD 补足）

**`src/`（仅三进程边界 + 最小空壳）**
- `src/app/main/index.ts` — `app.whenReady` → 创建 `BrowserWindow`（`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`）→ load renderer entry；macOS activate 重建窗口；所有平台 window-all-closed 退出
- `src/app/main/window.ts` — 抽出 `createMainWindow()`（即便目前只有一处调用，边界清晰）
- `src/app/preload/index.ts` — 最小 `contextBridge.exposeInMainWorld('morrowApi', {})`（空对象，仅验证桥通；命名占位遵循 ARCHITECTURE.md 的 `window.morrowApi` 约定，正式名称等 ADR 0005 的后续命名 ADR）
- `src/app/preload/index.d.ts` — `morrowApi` 类型声明
- `src/app/renderer/index.html`
- `src/app/renderer/src/main.tsx` — React 19 `createRoot` mount
- `src/app/renderer/src/App.tsx` — 一个纯文本页面：`<h1>Morrow</h1>` + `<p data-testid="scaffold-ok">scaffold ok</p>`（**唯一目的**：给 E2E 一个稳定的断言钩子）
- `src/app/renderer/src/index.css` — 空文件 + 一条注释声明"token system 尚未落地，等 DESIGN.md tokens 的实现 SDD"

**`tests/`（最小冒烟，证明四层命令都跑得通）**
- `tests/unit/scaffold.spec.ts` — 一个 trivial `expect(1+1).toBe(2)`，用来验证 `pnpm test` 路径
- `tests/contract/preload-api-shape.spec.ts` — 断言 `morrowApi` 是一个空对象（当空对象从 preload 导出时不崩）
- `tests/e2e/scaffold-smoke.spec.ts` — Playwright：启动应用 → 等待 `[data-testid="scaffold-ok"]` → 断言文本 == "scaffold ok"

**文档联动（最小必要）**
- `CHANGELOG.md` § [Unreleased] 追加 `### Added` 条目，并把原 Notes 中"下一步 tech-stack-scaffold"的描述改写为"已完成"
- `DEVELOPMENT.md § Setup` 中的 🚧 规约提示替换为"命令已落地，参见 `package.json`"
- `DEVELOPMENT.md § 项目结构` 补一份"当前结构快照"小节（`src/app/{main,preload,renderer}` 三进程 + `tests/{unit,contract,integration,e2e}` 四层）
- `DEVELOPMENT.md § Pre-commit 闸门` 末尾的 🚧 替换为"闸门脚本已落地（naming 规则待定）"
- `AGENTS.md § 1.8` 最后一句"`tech-stack-scaffold` 落地前此规则由 code review 把关，其后由 lint 强制"改为"设计 token 的 lint 强制延后到独立 SDD `design-tokens-enforcement`"

> ⚠️ `AGENTS.md` / `DEVELOPMENT.md` 属于 § 6 Out of Scope，**本 SDD 不允许擅自修改**。上述三条联动修改须在 Plan 阶段作为**用户批准门**单独列出；若用户不批准，这三条改为在 PR 描述中说明由用户手改。

### 3.2 不包含（OUT）

- 任何业务逻辑、任何 context 目录
- DDD 四层占位目录（`domain/application/infrastructure/presentation`）
- Tailwind / 任何 UI 库 / 任何 design token 实现（token 落地是独立 SDD）
- SQLite / Drizzle / 任何持久化
- host process / utilityProcess 机制
- 自动更新 / 签名 / electron-builder 完整发布配置
- CI 配置（`.github/workflows/`）
- i18n / 命名规则 ADR / Renderer → Main IPC 实际 contract（最小脚手架不需要）
- `scripts/test-e2e-with-window-fallback.mjs` 的真·降级链（先占位，由独立 SDD 补）

---

## 4. 状态所有权、不变量、风险

### 4.1 状态所有权
- **构建配置**（`package.json` / `electron.vite.config.ts` / `tsconfig*.json`）owner = 本 SDD；任何后续业务 SDD 对构建配置的修改必须显式说明。
- **`scripts/*.mjs` 闸门**的 owner = 本 SDD；未来 SDD 可替换实现，但不得悄悄增减闸门步骤。
- **`src/app/{main,preload,renderer}`** 作为进程边界 owner；业务 context 落地时**不得**在进程目录下堆业务逻辑（ARCHITECTURE.md § 2 已硬约束）。

### 4.2 不变量（3 条）

1. **三端隔离**：renderer 永远不 import 任何 `main/` / `preload/` 下的模块，也不 import `electron` 包；所有跨进程交互只经过 `window.morrowApi`（目前为空对象）。
2. **闸门命令契约 = pnpm scripts**：`DEVELOPMENT.md § Pre-commit 闸门` 里列出的 8 步，每一步都必须有**同名** pnpm script，且 `pnpm pre-commit` 按原文顺序串行执行。
3. **Electron 安全默认值不可回退**：`contextIsolation: true` / `nodeIntegration: false` / `sandbox: true`；任何后续 SDD 如要关闭其一，必须在 ADR 中说明理由。

### 4.3 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 直接 copy OpenCove 的版本号导致 peer dep 冲突 | 安装失败 / 运行时报错 | 对齐 ADR 0004 的版本下限即可；使用 `pnpm install` 自己的 resolver，不手写 lock；保留 OpenCove 的 `pnpm.overrides`（`ajv / esbuild / minimatch` 的安全修正版本）作为底线 |
| macOS / Windows / Linux 路径与 CRLF 差异 | E2E 脚本或 husky hook 在 Windows 跑挂 | 所有 `scripts/*.mjs` 走 `path.join` / `node:fs/promises`，禁用 `#!/bin/bash` 写法；`.gitattributes` 已有的 text eol=lf 配置保留 |
| Playwright E2E 首次跑耗时长、偶发失败 | 打击团队信心 | 只做一个 smoke case；明确要求"单独跑 Playwright 前先 `pnpm build`"（已写入 DEVELOPMENT.md）；失败首轮动作指向 DEBUGGING.md |
| pnpm `onlyBuiltDependencies` 配错导致 electron 没装 | `pnpm dev` 报 `electron: command not found` | 直接使用 OpenCove 验证过的清单（仅 `electron`），其他 native dep 当前不引入 |
| oxlint 规则缺失导致某些危险模式漏过 | 代码质量 | 本 SDD 先给**最小规则集**（ts + react 基础），留切换到 ESLint 的预案；AGENTS.md § 1.8 的 token 硬规则在独立 SDD `design-tokens-enforcement` 中落地，不在本 SDD 兜底 |
| "scaffold ok" 这个 E2E 断言太弱，无法反映真实业务稳定性 | 虚假安全感 | 显式说明这是**冒烟**而非业务保障；业务 E2E 覆盖率是未来业务 SDD 的责任；CHANGELOG 明确标注 |

### 4.4 合规
- 不涉及用户数据、密钥、第三方 API；
- 新增顶层依赖全部在 ADR 0004 中已批准（AGENTS.md § 6 合规）；
- `secretlint` 直接作为 devDep 引入（ADR 0004 列为"可选但推荐"，本 SDD 采纳为必选以满足闸门步骤 2）。

---

## 5. 变更文件清单（绝对路径 + 类型）

| 路径 | 类型 | 说明 |
|---|---|---|
| `/Users/songhuiyu/Morrow/package.json` | 新建 | 核心 |
| `/Users/songhuiyu/Morrow/.npmrc` | 新建 | engine-strict |
| `/Users/songhuiyu/Morrow/tsconfig.json` | 新建 | root references |
| `/Users/songhuiyu/Morrow/tsconfig.node.json` | 新建 | main + preload |
| `/Users/songhuiyu/Morrow/tsconfig.web.json` | 新建 | renderer |
| `/Users/songhuiyu/Morrow/electron.vite.config.ts` | 新建 | 三端装配 |
| `/Users/songhuiyu/Morrow/vitest.config.ts` | 新建 | unit/contract/integration |
| `/Users/songhuiyu/Morrow/playwright.config.ts` | 新建 | e2e |
| `/Users/songhuiyu/Morrow/.oxlintrc.json` | 新建 | lint |
| `/Users/songhuiyu/Morrow/.prettierrc` | 新建 | format |
| `/Users/songhuiyu/Morrow/.prettierignore` | 新建 | format |
| `/Users/songhuiyu/Morrow/.secretlintrc.json` | 新建 | secret |
| `/Users/songhuiyu/Morrow/.husky/pre-commit` | 新建 | hook |
| `/Users/songhuiyu/Morrow/.gitignore` | 编辑 | 加 out/ dist/ coverage/ |
| `/Users/songhuiyu/Morrow/scripts/check-max-lines.mjs` | 新建 | 闸门 1 |
| `/Users/songhuiyu/Morrow/scripts/check-secrets-staged.mjs` | 新建 | 闸门 2 |
| `/Users/songhuiyu/Morrow/scripts/check-naming-staged.mjs` | 新建 | 闸门 3（占位） |
| `/Users/songhuiyu/Morrow/scripts/check-format-staged.mjs` | 新建 | 闸门 5 |
| `/Users/songhuiyu/Morrow/scripts/run-vitest-related-staged.mjs` | 新建 | 闸门 7 |
| `/Users/songhuiyu/Morrow/scripts/run-precommit-e2e.mjs` | 新建 | 闸门 8 |
| `/Users/songhuiyu/Morrow/scripts/test-e2e-with-window-fallback.mjs` | 新建 | test:e2e 入口 |
| `/Users/songhuiyu/Morrow/src/app/main/index.ts` | 新建 | 主进程入口 |
| `/Users/songhuiyu/Morrow/src/app/main/window.ts` | 新建 | 窗口工厂 |
| `/Users/songhuiyu/Morrow/src/app/preload/index.ts` | 新建 | 预加载 |
| `/Users/songhuiyu/Morrow/src/app/preload/index.d.ts` | 新建 | 桥类型 |
| `/Users/songhuiyu/Morrow/src/app/renderer/index.html` | 新建 | html 入口 |
| `/Users/songhuiyu/Morrow/src/app/renderer/src/main.tsx` | 新建 | React mount |
| `/Users/songhuiyu/Morrow/src/app/renderer/src/App.tsx` | 新建 | 冒烟页面 |
| `/Users/songhuiyu/Morrow/src/app/renderer/src/index.css` | 新建 | 空占位 |
| `/Users/songhuiyu/Morrow/tests/unit/scaffold.spec.ts` | 新建 | 冒烟 |
| `/Users/songhuiyu/Morrow/tests/contract/preload-api-shape.spec.ts` | 新建 | 冒烟 |
| `/Users/songhuiyu/Morrow/tests/e2e/scaffold-smoke.spec.ts` | 新建 | 冒烟 |
| `/Users/songhuiyu/Morrow/CHANGELOG.md` | 编辑 | [Unreleased] 追加 |
| `/Users/songhuiyu/Morrow/DEVELOPMENT.md` | 编辑（需批准，§6 out-of-scope） | 去除 🚧 规约提示、加当前结构快照 |
| `/Users/songhuiyu/Morrow/AGENTS.md` | 编辑（需批准，§6 out-of-scope） | § 1.8 末句改写 |

共：新增 33 个文件，编辑 3 个文件。

---

## 6. 关键实现细节

### 6.1 `package.json` 核心字段（片段）

```jsonc
{
  "name": "morrow",
  "private": true,
  "version": "0.0.0",
  "main": "./out/main/index.js",
  "type": "module",
  "engines": { "node": ">=22.12.0", "pnpm": ">=9.6.0" },
  "packageManager": "pnpm@9.6.0",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "check": "tsc -b tsconfig.node.json tsconfig.web.json --noEmit",
    "lint": "oxlint .",
    "lint:fix": "oxlint --fix .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "format-check:staged": "node scripts/check-format-staged.mjs",
    "line-check:staged": "node scripts/check-max-lines.mjs",
    "secret-check:staged": "node scripts/check-secrets-staged.mjs",
    "naming-check:staged": "node scripts/check-naming-staged.mjs",
    "test": "vitest",
    "test:staged": "node scripts/run-vitest-related-staged.mjs",
    "test:e2e": "node scripts/test-e2e-with-window-fallback.mjs",
    "test:e2e:pre-commit": "node scripts/run-precommit-e2e.mjs",
    "pre-commit": "pnpm line-check:staged && pnpm secret-check:staged && pnpm naming-check:staged && pnpm lint:fix && pnpm format-check:staged && pnpm check && pnpm test:staged && pnpm test:e2e:pre-commit",
    "prepare": "husky"
  }
}
```

**顶层依赖清单**（最小集，全部在 ADR 0004 范围内）：
- dependencies: `react` / `react-dom` / `@electron-toolkit/preload` / `@electron-toolkit/utils`
- devDependencies: `electron` / `electron-vite` / `vite` / `@vitejs/plugin-react` / `typescript` / `@types/node` / `@types/react` / `@types/react-dom` / `@electron-toolkit/tsconfig` / `vitest` / `happy-dom` / `@testing-library/react` / `@testing-library/jest-dom` / `@vitest/coverage-v8` / `@playwright/test` / `oxlint` / `prettier` / `husky` / `lint-staged` / `secretlint` / `@secretlint/secretlint-rule-preset-recommend` / `electron-builder`

**不**引入：`tailwindcss` / `class-variance-authority` / `clsx` / `lucide-react` / 任何持久化 / 任何 xterm / 任何图形库。

### 6.2 `electron.vite.config.ts` 要点
- 三端 entry：`src/app/main/index.ts` / `src/app/preload/index.ts` / `src/app/renderer/index.html`
- renderer 开启 `@vitejs/plugin-react`
- 生产构建产物统一落到根目录 `out/`（与 `main` 字段一致）
- CSP：dev 允许 `unsafe-inline`；prod 通过 `<meta http-equiv="Content-Security-Policy">` 在 `index.html` 中写入基础策略（`default-src 'self'`；留 font/img/connect-src TODO）

### 6.3 主进程窗口创建（`src/app/main/window.ts` 片段）

```ts
import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(fileURLToPath(new URL('.', import.meta.url)), '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(fileURLToPath(new URL('.', import.meta.url)), '../renderer/index.html'));
  }
  return win;
}
```

### 6.4 Preload 最小桥（`src/app/preload/index.ts`）

```ts
import { contextBridge } from 'electron';
// 白名单桥：当前为空对象；真正的 command/query/event 由第一个业务 SDD 引入
contextBridge.exposeInMainWorld('morrowApi', Object.freeze({}));
```

> 命名 `morrowApi` 为 **ARCHITECTURE.md § 6 的占位名**；后续命名 ADR（原 ADR 0005 规划项，现序号待确认）确定正式名后由独立 SDD 改名。本 SDD 不承担命名决策。

### 6.5 `scripts/*.mjs` 实现规约
- 全部 `#!/usr/bin/env node` + ESM
- 统一导入 `node:child_process` / `node:fs/promises` / `node:path`
- 获取 staged 文件：`git diff --cached --name-only --diff-filter=ACMR`
- 失败退出码 1；成功 0；`naming-check` 永远 0（并在 stderr 打"rules TBD"）
- 单文件 ≤ 120 行（遵守未来 line-check 规则；当前默认阈值 400，远低于）

### 6.6 Playwright 冒烟用例骨架

```ts
// tests/e2e/scaffold-smoke.spec.ts
import { _electron as electron, expect, test } from '@playwright/test';

test('scaffold smoke: window loads and renders', async () => {
  const app = await electron.launch({ args: ['out/main/index.js'] });
  const win = await app.firstWindow();
  await expect(win.locator('[data-testid="scaffold-ok"]')).toHaveText('scaffold ok');
  await app.close();
});
```

---

## 7. 数据流路径（脚手架层面）

```
 开发态:
   pnpm dev
     ├─ electron-vite dev (启动 main/preload 构建 watch + renderer vite dev server)
     └─ electron 启动 → main load preload → renderer load http://localhost:<port>
                                                       ↓
                                  <App /> 渲染 "scaffold ok"

 E2E 态:
   pnpm test:e2e
     ├─ pnpm build → out/main/index.js + out/preload/index.js + out/renderer/*
     └─ playwright 启动 → electron.launch(out/main/index.js)
                            ↓
                         scaffold-smoke.spec.ts assert "scaffold ok"

 Pre-commit 态:
   git add <files>
   git commit → husky/pre-commit → pnpm pre-commit → 顺序执行 8 步闸门
```

---

## 8. 边界条件与异常

| 场景 | 预期行为 |
|---|---|
| `pnpm install` 在 Node < 22.12 | `.npmrc` 的 `engine-strict=true` 让安装失败并打印版本要求 |
| `pnpm dev` 时 port 占用 | electron-vite 默认自动选端口；main 通过 `process.env.ELECTRON_RENDERER_URL` 读取，不硬编码 |
| `pnpm test:e2e` 未先 `pnpm build` | test-e2e-with-window-fallback.mjs 检测 `out/main/index.js` 不存在 → 自动先跑 `pnpm build` 再跑 playwright（便利性，不违反 DEVELOPMENT.md 规约） |
| renderer 端空 `morrowApi` 被业务代码调用 | `Object.freeze({})` 保证写入抛错；调用不存在方法时 `TypeError` 立刻暴露越界 |
| husky hook 在 Windows cmd 下 | 依赖 husky 9 的跨平台壳；hook 文件只有一行 `pnpm pre-commit`，不走 bash 语法 |
| `lint-staged` 匹配到无扩展名 / 二进制文件 | lint-staged 的 glob 已限定扩展；`check-max-lines` 遇到二进制 `isBinaryFileSync` 跳过 |
| `naming-check` 尚未定义规则 | 退出 0 + stderr 打印 "naming rules TBD, see future ADR" |
| CI 机器无 GUI | Playwright 使用 Electron headless 模式 + `offscreen` 窗口；Linux 机器需装 xvfb（在 playwright.config.ts 注释中声明） |

---

## 9. 预期验收标准（AC）

**P0（本 SDD 必须满足才能合入）**：
- [ ] `pnpm install` 干净通过，无 `peer dep` 严重错误
- [ ] `pnpm dev` 拉起 Electron 窗口，显示 "scaffold ok"
- [ ] `pnpm build` 产出 `out/main/index.js` / `out/preload/index.js` / `out/renderer/index.html`
- [ ] `pnpm check` 类型零错误
- [ ] `pnpm lint` / `pnpm format:check` 零错误
- [ ] `pnpm test -- --run` 单元 + contract 测试全绿
- [ ] `pnpm test:e2e` 冒烟 case 绿
- [ ] `pnpm pre-commit` 8 步全绿（空 staged 时也应绿；mock 几个 staged 文件应分别触发对应闸门）
- [ ] `src/app/{main,preload,renderer}` 三端互不 import（由 oxlint 的 `no-restricted-imports` 规则或 tsconfig references 边界保证）

**P1（体验 / 记录）**：
- [ ] `CHANGELOG.md` 已更新
- [ ] `DEVELOPMENT.md` 的 🚧 提示已去除（需用户批准）
- [ ] `AGENTS.md § 1.8` 末句已改写（需用户批准）
- [ ] 每条 commit 遵循 `<type>(<scope>): <what> · <why>`，按"一个 meaningful unit of work 一次提交"拆分（预期约 6–8 次提交）

**P2（已知不做，明确记录）**：
- [ ] CHANGELOG 的 Notes 里显式声明：`naming-check` / E2E 降级链 / design token lint 强制 均由后续独立 SDD 补齐
- [ ] `DEVELOPMENT.md` 的当前结构快照明确写出"DDD 四层目录尚未创建，由第一个业务 context SDD 引入"

---

## 10. 不变量与 AGENTS 硬规则自检

对照 `AGENTS.md § 3 Pre-Coding Checks`：

| 项 | 本 SDD 的答案 |
|---|---|
| 状态所有权 | 见 § 4.1 |
| 1–3 条不变量 | 见 § 4.2 |
| 边界（源头/路由/owner） | 进程边界：main = supervisor；preload = 白名单 bridge；renderer = UI 组合；IPC channel = 空集（本 SDD 不引入业务 channel） |
| 异步 & 生命周期 | `BrowserWindow` 在 `window-all-closed` 时退出（Windows/Linux）；macOS 保留 app 实例，activate 时重建；无 watcher / timer / child process，无需 dispose 路径 |
| 合规 | 见 § 4.4 |
| 研究前置 | 见 § 2 |

**确认未触达 AGENTS.md § 6 Out of Scope 中未经批准的项**：
- 引入顶层依赖 → **ADR 0004 已批准整包技术栈**
- 修改 AGENTS.md / DEVELOPMENT.md → **已在 § 3.1 作为"需用户批准门"单独列出**，若不批准，将改为 PR 描述中说明由用户手改
- CI / 发布配置 → **不动**
- ADR 状态 → **不动**

---

## 11. Feasibility Check

按 AGENTS.md § 2.B，Large 任务在"引入新技术 / 高性能诉求 / 系统级依赖 / 核心重构"时必须做 Feasibility Check。

本 SDD 情况：
- **不引入新技术**（全在 ADR 0004 已批清单内）
- **不做性能优化**
- **系统级依赖**（Electron + Node 22）已由 ADR 0004 验证
- **不是重构**（空仓初始化）

→ **Feasibility Check 不触发**。参考实现（OpenCove）已跑通 6 个月以上，视为现成可行性证据。

---

## 12. 预期验证方式

- 本地：`pnpm install && pnpm check && pnpm lint && pnpm test -- --run && pnpm build && pnpm test:e2e && pnpm pre-commit`
- 人工：
  - 开 `pnpm dev`，肉眼确认窗口显示 "scaffold ok"；
  - 伪造一个超长文件 staged，确认 `line-check:staged` 拦截；
  - 伪造一个含 AWS key 的 staged 文件，确认 `secret-check:staged` 拦截；
  - 在 renderer 里尝试 `import { app } from 'electron'`，确认 oxlint 或 tsc 报错（保证不变量 1）。

---

## 13. 下一步 SDD 依赖（仅记录，不执行）

本 SDD 完成后解锁：
1. `naming-conventions`（命名 ADR + `naming-check` 实现）
2. `design-tokens-enforcement`（DESIGN.md tokens 落地 + oxlint 规则强制）
3. `renderer-ipc-contract`（第一个真正的 Renderer → Main command / query / event 端口）
4. `first-domain-context`（第一个业务 context，落地 DDD 四层目录）
5. `release-pipeline`（ADR 0006 + electron-updater + 签名 + CI）
