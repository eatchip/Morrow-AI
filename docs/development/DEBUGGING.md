# Debugging Guide — Morrow

## 规则

- 凡遇到 `pnpm pre-commit` / `pnpm test` / `pnpm test:e2e` / 单独 Playwright 用例失败，**继续排查前先读本文件**。
- **先缩小复现范围，再改代码**；不要一上来跑全量。
- **若 UI 表现与代码不一致，先怀疑是否跑到了旧构建产物**。

---

## 失败后的首轮动作

1. 记录**原始失败命令**与**首个失败用例 / 报错**（不要滚屏覆盖）。
2. 判断失败类型：`format / lint` → `typecheck` → `unit` → `contract` → `integration` → `E2E` → `runtime crash`。
3. 若是单独跑 Playwright，先 `pnpm build`，消除"旧 `out/` 产物"嫌疑。
4. **只重跑目标失败项**，确认是否稳定复现。不稳定复现的 flaky 用例需要单独分析是否为时序问题。
5. 若是 E2E，优先看 `trace.zip`、`screenshot`、`console`、持久化状态四类证据。

---

## 测试层级选择（策略）

目标：用**最低成本**的测试层级先定位问题；确认根因后再补足能防回归的覆盖。

层级定义与适用场景详见 `DEVELOPMENT.md § 测试分层与 E2E 策略`。此处只补调试视角的选层原则：

- **能用 Unit 定位的绝不升到 Contract**：纯函数 / 解析逻辑 / 状态迁移错误优先写 Unit 复现。
- **Contract 适合"边界误用"类问题**：IPC payload 校验、错误码、handler 输入输出契约。
- **Integration 适合"组合才出问题"**：watcher / hydration / persistence / lifecycle 之间的时序交互。
- **E2E 作为最后兜底**：只有跨进程、真实交互才能触发的问题，才值得进入 E2E。
- **定位完成后，防回归测试写在触发该 bug 的最低层**，不要为了保险每层都写一遍。

---

## E2E 稳定运行原则

### 优先使用仓库脚本

```bash
pnpm test:e2e
```

该命令会先执行 `pnpm build`，再启动 Playwright。

### 默认窗口模式

- 默认：BrowserWindow `show: false` 且不主动 `show()`，配合 macOS `app.setActivationPolicy('accessory')` + `app.dock.hide()`，跑 E2E 时窗口在背后运行，不抢焦点、不进 Dock / ⌘+Tab。
- 渲染照常进行（Electron 默认 `paintWhenInitiallyHidden: true`），Playwright 通过 CDP 驱动 renderer。
- 由 `MORROW_E2E=1` 触发；真实用户启动路径完全不受影响。
- CI 禁用 `normal` 模式（会抢焦点）。
- macOS 26 上如遇到系统“Electron 意外退出”弹窗，优先确认 `electron` 版本不低于 36.9.2；Electron 35 已停止支持，且缺少 macOS Tahoe 相关 AppKit/WindowServer 修复。

### 单独跑 Playwright 时必须先构建

```bash
pnpm build
pnpm exec playwright test tests/e2e/<target>.spec.ts
```

否则可能继续使用旧的 `out/` 产物，造成"代码已改、现象未变"的假失败。

---

## 持久化与状态污染排查

### 1) 测试优先使用 seed 状态

交互回归应尽量通过测试 helper 直接 seed 持久化状态，而不是依赖多步 UI 创建流程。

这样更容易排除：

- 菜单 / 控件被遮挡
- 初始布局随机变化
- 前序步骤失败掩盖真实问题

### 2) 检查状态是否被前一个用例污染

重点确认：

- 持久化存储（localStorage / 数据库 / 文件）是否已清理或重建
- `reload` 后是否真的读到了当前种入的数据
- 数据规模与预期一致

### 3) 当 UI 与断言不一致时，直接读持久化状态

如果画面像是成功了，但断言仍失败，或反过来，**优先直接读取持久化状态确认真实结果**。

通常能快速区分：

- 是事件根本没触发
- 是 UI 更新了但没持久化
- 是持久化已更新但断言时机不对

---

## 视觉调试原则（UI 相关）

- **复杂交互先信真实鼠标事件**：拖拽、多选、缩放场景优先使用 `page.mouse.move/down/up`，不要直接信 `dragTo()`。
- **主题 / 样式 bug 必须做视觉验证**：日志与 DOM 断言不能代替像素对照。
- **窗口模式不是越"隐藏"越稳**：抓真实命中异常时临时恢复窗口可见（移除 `MORROW_E2E` 即回到正常 `show()` 路径），再做截图比对。
- **缩放 / transform 场景慎用 `locator.boundingBox()`**：优先 `locator.evaluate(el => el.getBoundingClientRect())` 读可视坐标。

---

## 跨平台排查

- Windows / macOS / Linux 表现不一致时，优先怀疑：路径分隔符、换行符、shell 差异、signal 语义、权限模型。
- 平台特有 bug 必须补对应平台的 E2E（`*.windows.spec.ts` / `*.mac.spec.ts` / `*.linux.spec.ts`），并在 CI 的对应 runner 上执行。

---

## 案例库

> 本节空着。每次真实 bug 修复完毕后，把复盘沉淀到 `docs/cases/{kebab-slug}.md` 并在此处加索引。
>
> 这是 `AGENTS.md § 1 Golden Rule #7`（每个真实 bug 留下可复用资产）的落地位置。资产化不是可选项——没有案例沉淀的 bug 修复属于**未完成**。

---

## 一句话原则

- **先确认是不是旧构建，再怀疑代码。**
- **先看 trace 和持久化状态，再猜 UI。**
- **写不出稳定回归测试，就说明结构有问题，不是测试工具的问题。**
