# release-v0.1.0 收尾

## 结果

Morrow **v0.1.0** — 首个公开 MVP 已发布。

- **Tag**：`v0.1.0` 已推到 `origin`
- **Commit**：`6387ffe chore(release): v0.1.0 · first public MVP for macOS`（在 `main` 上）
- **GitHub Actions**：`.github/workflows/release.yml` 在 tag push 时自动触发，`macos-latest` 上打 dmg 并创建 **draft Release**
- **本地自验产物**：
  - `dist/Morrow-0.1.0-arm64.dmg`（~102 MB）
  - `dist/Morrow-0.1.0-x64.dmg`（~106 MB）
  - 启动验证：`open dist/mac-arm64/Morrow.app` → 进程正常，无崩溃

## 落地文件

| 文件 | 类型 | 作用 |
|---|---|---|
| `package.json` | 改 | `version 0.1.0` / `license MIT` / metadata / `dist` + `dist:mac` scripts |
| `LICENSE` | 新 | MIT 标准文本 |
| `electron-builder.yml` | 新 | macOS dmg（arm64 + x64），`asarUnpack: out/**/*`，`identity: null` 跳签名 |
| `resources/icon.png` | 新 | 512×512 占位图（灰底白 D） |
| `.github/workflows/release.yml` | 新 | tag `v*` 触发 macos-latest 打包 + draft Release 上传 dmg |
| `README.md` | 改 | 面向终端用户重写：What / Install / Requirements / Usage / Status / Development / License |
| `CHANGELOG.md` | 改 | `[Unreleased]` → `[0.1.0] - 2026-05-12` |

## 过程中遇到的坑

1. **electron 二进制缓存损坏**：`~/Library/Caches/electron/electron-v35.7.5-darwin-arm64.zip` 早期失败重试时叠了 147MB 脏字节。清空 + 切 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 后下载通过。
2. **`asar` 不打 `out/`**：最初用 `files: - out/**` glob 不生效（electron-builder 的 glob 对 `**` 尾匹配敏感），改用 `asarUnpack: - out/**/*` 直接让 `out/` 以 unpacked 形式进入 `app.asar.unpacked/`。这同时让 electron 能直接 require `out/main/index.js`。
3. **`dmg-builder@1.2.0` 在 `cdn.npmmirror.com` 404**：因为 `ELECTRON_MIRROR` 被上游 `downloadArtifact` 继承用，但 npmmirror 没镜像这个包。解决方式：手动从 GitHub 下 `dmgbuild-bundle-{arm64,x86_64}-75c8a6c.tar.gz`，用 `CUSTOM_DMGBUILD_PATH=/tmp/dmgbuild-arm64/dmgbuild` 跳过下载。**CI 上没设 `ELECTRON_MIRROR`，默认走 GitHub，不会触发该 bug。**

## 用户后续要做的事

1. **等 CI 跑完**：到 [Actions](https://github.com/eatchip/Morrow/actions) 看 `v0.1.0` tag 触发的 Release workflow（arm64 + x64 各一档，需约 5–10 分钟）。
2. **Edit Release notes**：`draft: true`，到 [Releases](https://github.com/eatchip/Morrow/releases) 把 `v0.1.0` 的 notes 编一下（可复制 `CHANGELOG.md` `[0.1.0]` 段），`Publish release` 即可对外可见。
3. **（可选）右键打开 dmg 说明**：README 已写，首次用户因 Gatekeeper 会被拦截，右键 → 打开一次即可。

## 未完成 / 延后

- 代码签名 / 公证（Apple Developer ID + notarization）：需开发者账号，延后。
- Windows / Linux 安装包：首发 macOS only；后续看需求。
- 会话持久化（localStorage / file）：v0.2.0 候选。
- 自动更新（electron-updater）：暂不做。
- 真实 App icon：当前为占位 D 字图，后续找美术出图替换 `resources/icon.png`。
