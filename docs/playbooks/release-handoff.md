# Release Handoff Playbook

本 playbook 约束 agent 在用户明确授权合入或发布时的默认动作。目标是让“能体验”和“能下载”成为交付结果，而不是留给用户继续追问。

## 触发条件

当用户明确表达以下任一意图时，视为已授权完整发布闭环：

- “可以合入 / merge 到 main”
- “发布 / 更新到 GitHub”
- “让所有人使用 / 用户能下载最新包”
- “打包 / 更新 README / 重要更新”

agent 不需要再次询问“是否发布”。如果权限、认证或 workflow 状态使发布不可完成，才停止并说明阻塞点。

## 必做步骤

1. **文档与版本**
   - 用户可感知功能必须更新 `README.md`、`CHANGELOG.md`。
   - 需要公开安装包时更新 `package.json` version。
   - README 要能说明最新能力，而不是只记录开发者命令。

2. **验证**
   - 提交前必须先暂存目标文件，再跑 `pnpm pre-commit`。
   - 用户可见功能必须覆盖 E2E 或说明为何无法覆盖。
   - 不允许使用 `--no-verify` 绕过闸门。

3. **打包**
   - macOS 发布必须跑 `pnpm dist:mac`。
   - 确认生成 `dist/Morrow-<version>-arm64.dmg` 与 `dist/Morrow-<version>-x64.dmg`。
   - 本地打包失败时先判断是权限、签名、原生依赖还是代码问题。

4. **合入与推送**
   - 功能分支提交后切回 `main`。
   - 优先快进合并；无法快进时先处理冲突并重新验证。
   - 推送 `origin main`，并确认远端 `main` 指向目标提交。

5. **发布**
   - 创建或更新 `v<package.version>` tag 并推送。
   - GitHub Actions release workflow 必须产出非 draft Release。
   - 不得停在 draft release、只推 tag、或只生成本地 dmg。

6. **核验**
   - 用 GitHub Release 页面或 API 确认 `releases/latest` 指向新 tag。
   - 确认 dmg assets 已上传，且文件名包含当前版本号。
   - 若 GitHub CLI token 失效、Actions 失败或权限不足，最终回复必须说明具体阻塞。

## 体验路径

每次交付的最终回复必须给一行可复制命令，按当前交付状态选择。

开发体验，当前仓库：

```bash
cd /Users/songhuiyu/Morrow && pnpm dev
```

独立 worktree：

```bash
cd /Users/songhuiyu/Morrow-<slug> && pnpm dev
```

当前仓库需要先切分支：

```bash
cd /Users/songhuiyu/Morrow && git switch <branch> && pnpm dev
```

已发布给最终用户时，补充 GitHub Latest 链接和版本号。不要只说“去 Release 看”。
