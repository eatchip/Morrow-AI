# release-v0.1.0 — MVP 公开可下载版

## 0. 目标

让任何人打开 `github.com/eatchip/Morrow` 就能：
1. 从 README 看懂 Morrow 是什么、解决什么问题、如何安装使用
2. 从 Releases 下载对应平台的安装包（macOS 优先），双击即用
3. （贡献者）从 README 一路读到 `AGENTS.md/DEVELOPMENT.md` 上手开发

## 1. 业界参考

- **Raycast / Linear / Arc 等 Electron 桌面应用**：README 首屏是产品定位 + 截图 + 下载按钮；Releases 页挂 `.dmg` / `.exe` / `.AppImage`。
- **electron-vite 官方模板**：`electron-builder.yml` 声明 `mac` / `win` / `linux` targets；`pnpm build && electron-builder` 产出 `dist/`。
- **未签名分发**：MVP 阶段不办 Apple Developer / Windows 代码签名证书，用户需右键→打开绕过 Gatekeeper（macOS）、SmartScreen 首次拦截（Windows）。在 README 明写即可，许多开源项目都这样。
- **GitHub Actions matrix build**：macos-latest / windows-latest / ubuntu-latest 三平台并行 build，tag 推送时自动 publish。

## 2. 需求与验收

### 2.1 场景
- **场景 A 普通用户**：看 README → 点 Releases → 下载 `Morrow-0.1.0-arm64.dmg` → 拖 Applications → 启动 → 能用。
- **场景 B 贡献者**：clone → `pnpm install` → `pnpm dev` → 开干。
- **场景 C 仓库访客**：README 头部 3 秒内知道：这是个统一 Claude Code / Codex CLI 前端的桌面壳，目标像 Linear。

### 2.2 验收标准
- [ ] README 覆盖：What / Why / Screenshots / Install / Usage / Requirements / Dev Setup / Status / License
- [ ] `pnpm dist` 本地能生成 `dist/Morrow-0.1.0-arm64.dmg`（或平台对应产物），双击能装、能启动、能走通 MVP smoke flow
- [ ] GitHub 有 `v0.1.0` tag 与 Release，Release 说明含 CHANGELOG 对应段，附件至少一份 macOS 安装包
- [ ]（可选）GitHub Actions workflow：`release.yml` 监听 `v*` tag，macOS/Windows/Linux 三平台并行 build 并自动 upload 到对应 Release
- [ ] `CHANGELOG.md` 从 `[Unreleased]` 切出 `[0.1.0] - 2026-05-12` 段

### 2.3 显式不做
- 代码签名 / 公证（Apple Notary / Windows EV cert）— MVP 阶段成本收益不对等
- 自动更新（electron-updater）— 独立 SDD
- Homebrew cask / winget manifest — 独立 SDD

## 2.4 敲定决策（2026-05-12）

- **Q1 打包范围**：A = macOS only（arm64 + x64 两个 arch）。Win/Linux 延后。
- **Q2 CI**：B = 配 `.github/workflows/release.yml`，tag push 自动 build & publish（当前仅 macos-latest）。
- **Q3 图标**：A = 占位图（灰底白字 `D`，512×512 PNG）。
- **Q4 License**：A = MIT。需同步改 `package.json::license` 与新增 `LICENSE` 文件。

## 3. 状态所有权与不变量

- **版本号唯一源**：`package.json::version`。tag、Release、CHANGELOG 段标题、electron-builder 产物名都从此派生。
- **产物路径**：`dist/`（加入 `.gitignore`，不提交）。
- **不变量**：
  1. `pnpm dist` 必须在 `pnpm build` 产出的 `out/` 基础上打包，不自建构建流水。
  2. 任何平台分支逻辑放 `electron-builder.yml`，不渗进应用代码。
  3. CI 只在 tag push 时触发 release，日常 push 不 build。

## 4. 受影响文件

| 文件 | 动作 | 理由 |
|---|---|---|
| `electron-builder.yml` | 新建 | 三平台 target + appId + productName + output |
| `.gitignore` | 修改 | 加 `dist/` |
| `package.json` | 修改 | `version: 0.1.0`、新增 `dist` / `dist:mac` 脚本、`description` 完善、`author`、`repository`、`homepage` |
| `README.md` | 重写 | What / Install / Usage / Dev / Status |
| `CHANGELOG.md` | 修改 | `[Unreleased]` → `[0.1.0] - 2026-05-12` |
| `.github/workflows/release.yml` | 新建（可选） | tag 触发多平台 build & publish |
| `resources/icon.png` 或 `build/icon.png` | 新建 | electron-builder 需要 icon；初版用纯色占位也行 |

## 5. 实现要点

### 5.1 electron-builder.yml（最小可用）
```yaml
appId: dev.morrow
productName: Morrow
directories:
  output: dist
  buildResources: build
files:
  - out/**
  - package.json
  - '!**/*.map'
mac:
  target:
    - target: dmg
      arch: [arm64, x64]
  category: public.app-category.developer-tools
  icon: build/icon.png
win:
  target: nsis
  icon: build/icon.png
linux:
  target: AppImage
  category: Development
  icon: build/icon.png
```

### 5.2 package.json scripts
```json
"dist": "electron-vite build && electron-builder",
"dist:mac": "electron-vite build && electron-builder --mac",
```

### 5.3 README 骨架（中英混排，首屏英语给国际访客）
```
# Morrow
One desktop shell for Claude Code & Codex CLI.

[screenshot]

## Install
macOS (Apple Silicon / Intel): Releases → .dmg → drag to Applications
第一次打开被 Gatekeeper 拦截 → 右键 → 打开

## Requirements
macOS 12+ / Windows 10+ / Linux (x64 AppImage)
且本机已安装 `claude` 或 `codex` CLI 之一（否则 Morrow 会提示缺失）

## Usage
1. 启动 Morrow → 自动检测 runtime
2. Home → 输入你要做的事 → Enter 发送
3. Chat 页看流式输出，Esc 返回首页
4. 左侧栏可新建 / 切换多个会话

## Dev
pnpm install / pnpm dev / pnpm build / pnpm dist
详见 CONTRIBUTING.md

## Status
v0.1.0 MVP — early, single-user, no persistence.

## License
UNLICENSED (TBD)
```

### 5.4 GitHub Actions（release.yml，可选，推荐）
```yaml
name: release
on:
  push:
    tags: ['v*']
jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm dist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: softprops/action-gh-release@v2
        with:
          files: dist/*.(dmg|exe|AppImage|zip)
```

## 6. 风险与边界

- **icon 缺失**：electron-builder 不给 icon 会用默认 Electron 图标 → 初版放一个 512×512 PNG（灰底 `D` 字），后面独立 SDD 做品牌设计。
- **GitHub Actions 用量**：公开仓库免费额度够用；只在 tag push 时跑。
- **未签名分发的用户摩擦**：macOS 首次打开报"来自身份不明的开发者" → README 明写右键打开的 workaround。
- **Linux AppImage 依赖**：不同发行版 glibc 差异可能导致启动问题 → MVP 接受，issue 报上来再处理。
- **CI 与本地打包不一致**：electron-builder 对本机环境敏感 → 优先走 CI，本地 `pnpm dist:mac` 仅作 smoke。
- **并发提交**：AGENTS.md §5 新增"并发写保护"，本次所有 git 动作由同一会话连续执行，无并发风险。

## 7. 预期验证

- 本地：`pnpm dist:mac` 生成 `dist/Morrow-0.1.0-arm64.dmg`；双击安装；启动走一遍 MVP smoke（自动探测 runtime → 发送 → 看到流）。
- README：`pnpm format-check` 通过；内部链接可点。
- Tag & Release：`git tag v0.1.0 && git push --tags` → GitHub 上出现 Release；若配了 CI，artifact 自动上传。
- `pnpm pre-commit` 全绿。
