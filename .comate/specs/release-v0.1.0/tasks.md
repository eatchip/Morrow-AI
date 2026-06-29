# release-v0.1.0 任务计划

- [x] Task 1: 项目元数据与 License
    - 1.1: `package.json` 改 version `0.1.0`、license `MIT`、补 `description` / `author` / `repository` / `homepage`
    - 1.2: 新建 `LICENSE`（MIT 标准文本，Copyright 2026 songhuiyu）
    - 1.3: `.gitignore` 加 `dist/`

- [x] Task 2: 打包配置
    - 2.1: 生成占位 icon `build/icon.png`（512×512，灰底白字 D）
    - 2.2: 新建 `electron-builder.yml`（mac 限定，dmg，arm64 + x64）
    - 2.3: `package.json` scripts 加 `dist` / `dist:mac`

- [x] Task 3: 本地打包自验
    - 3.1: `pnpm dist:mac` 生成 `dist/Morrow-0.1.0-*.dmg`
    - 3.2: 挂载 dmg → 拖进 Applications → 启动 → 走通 MVP smoke（检测 runtime、发送、看到流）
    - 3.3: 产物体积 sanity check（<200MB）

- [x] Task 4: README 重写
    - 4.1: 顶部 What/Why + 截图占位说明
    - 4.2: Install 段（macOS dmg，Gatekeeper 右键打开说明）
    - 4.3: Requirements（需 `claude` 或 `codex` CLI）
    - 4.4: Usage 走 4 步基础流程
    - 4.5: Dev Setup 指向 CONTRIBUTING.md / AGENTS.md
    - 4.6: Status + License 尾部

- [x] Task 5: GitHub Actions Release Workflow
    - 5.1: 新建 `.github/workflows/release.yml`（macos-latest，tag `v*` 触发）
    - 5.2: 步骤：checkout → setup-node 22 → pnpm → install → dist → softprops/action-gh-release

- [x] Task 6: CHANGELOG 切版本
    - 6.1: `[Unreleased]` 切出 `[0.1.0] - 2026-05-12` 段
    - 6.2: 新开空 `[Unreleased]`

- [x] Task 7: 提交 · 打 tag · 发布
    - 7.1: `pnpm pre-commit` 全绿
    - 7.2: commit（可能拆 2 个：chore(release) + docs(readme)）
    - 7.3: push main → `git tag v0.1.0` → `git push --tags`
    - 7.4: 等 CI 打完 → 到 GitHub 上编辑 Release 说明（复制 CHANGELOG [0.1.0] 段），确认 dmg 附件已挂
