# Morrow

> A local AI workspace for personal chats, group channels, and Claude Code / Codex teammates.

Morrow 是一个运行在你本地电脑上的桌面工作空间。它把 `claude` 与 `codex`
两种命令行 Agent 包进一个统一的图形界面，让你既可以保持一对一对话，也可以把多个 AI
队友拉进同一个群聊里讨论当前文件夹里的工作。

- **个人对话** — 像普通 AI Chat 一样快速提问、追问、绑定本地项目文件夹
- **群聊频道** — 为一个本地文件夹创建频道，在群里 `@` 不同 AI 队友一起讨论
- **AI 队友** — 自定义角色的名称、模型、简介和「指示」prompt，随时查看和修改
- **本地上下文** — 频道只绑定本机文件夹，渲染层只传 `projectId`，实际路径由主进程解析

当前版本 **v0.3.7** 修复从上层 agent shell 启动时的 Claude/Codex 环境污染问题，并保留 Morrow 全量改名、Codex 对话稳定性与长群聊频道渲染性能优化，仅支持 **macOS（Apple Silicon + Intel）**。

---

## Install

### macOS

方式一：复制下面这一整行到终端，按 Enter。它会自动下载、安装并打开 Morrow。

```bash
ARCH="$(uname -m)"; [ "$ARCH" = "arm64" ] || ARCH="x64"; URL="$(curl -fsSL https://api.github.com/repos/eatchip/Morrow/releases/latest | sed -nE "s/.*\"browser_download_url\": \"([^\"]*Morrow-[^\"]*-$ARCH\.dmg)\".*/\1/p" | head -n 1)"; DMG="$TMPDIR/Morrow.dmg"; test -n "$URL" && curl -fL "$URL" -o "$DMG" && VOL="$(hdiutil attach "$DMG" -nobrowse | awk '/\/Volumes\//{print substr($0,index($0,"/Volumes/")); exit}')" && ditto "$VOL/Morrow.app" /Applications/Morrow.app && xattr -cr /Applications/Morrow.app && open /Applications/Morrow.app && hdiutil detach "$VOL" -quiet
```

方式二：也可以到 [Releases](https://github.com/eatchip/Morrow/releases/latest) 下载 dmg，打开后把 `Morrow.app` 拖进"应用程序"。如果首次打开提示"已损坏，无法打开"，只需要复制下面这一整行到终端，按 Enter：

```bash
xattr -cr /Applications/Morrow.app && open /Applications/Morrow.app
```

### Requirements

Morrow 自身不包含 Agent 能力，需要本机已安装以下至少一个 CLI：

- [Claude Code CLI](https://docs.claude.com/claude-code) — `claude` 在 `PATH` 中可用
- [OpenAI Codex CLI](https://github.com/openai/codex) — `codex` 在 `PATH` 中可用

Morrow 启动后会自动探测。如果两个都没装，Home 页会显示未检测到 runtime。

---

## Usage

### 个人对话

1. 启动 Morrow → Home 页看到已检测到的 runtime 徽标
2. 在左侧边栏点 **新建对话**，或切换到已有会话
3. 可选：在输入框上方选择一个本地项目文件夹
4. 输入框里打字 → **Enter 发送**（Shift+Enter 换行）→ 看到流式输出

### 群聊频道

1. 在左侧边栏点 **# 新建群聊**
2. 输入频道名称，可选择绑定一个本地文件夹
3. 选择初始 AI 队友，创建频道
4. 在频道输入框里输入 `@`，选择当前频道里的角色，再发送问题
5. 频道成员面板默认收起，需要查看成员时再展开
6. 不再需要的群聊可从侧边栏执行 **解散群聊**，频道历史会一并移除，AI 队友本身保留

### AI 队友

1. 在左侧边栏 **AI 队友** 区域点 `+`
2. 填写名称、模型（Claude Code / Codex）、简介和「指示」
3. 「指示」是这个角色最重要的 prompt，可在角色详情 Settings 中随时修改
4. 不需要先有频道，也可以先创建角色；之后再把它加入频道

关于窗口：采用 **frameless chrome**，标题栏集成系统红绿灯（macOS），拖拽整条顶栏即可移动窗口。

---

## Status

**v0.3.7 (2026-06-29)** — Runtime 环境隔离：

- ✅ macOS arm64 / x64 dmg
- ✅ 隔离 Claude/Codex 子进程环境，避免继承上层 agent shell 的 Anthropic/Codex token、base URL、sandbox 与 thread 控制变量
- ✅ 产品名、包名、App ID、DMG、preload bridge、E2E 开关、存储 key、默认角色 prompt、文档和 SDD 档案已切换为 Morrow
- ✅ 新增品牌检查，防止旧品牌拼写重新进入当前源码、文档、测试、脚本和 SDD 内容
- ✅ 个人对话 + 群聊频道
- ✅ Codex run 生命周期由主进程统一监督，超时/取消/失败会清理并结算
- ✅ 卡死的后台对话不会阻塞新对话继续发送
- ✅ 慢响应/超时状态提供取消、重试、重启 runtime 与诊断入口
- ✅ 新增 Codex 性能门禁命令，防止后续更新引入明显速度回退
- ✅ 个人对话草稿按会话恢复，不同会话可并行发送
- ✅ 频道绑定本地文件夹
- ✅ 自定义 AI 队友：模型 / 简介 / 指示 prompt
- ✅ 频道内 `@角色` 触发回复
- ✅ 群聊频道支持解散，解散时清理消息、交接记录和运行记录
- ✅ 角色详情 Settings，可编辑指示、删除角色
- ✅ 受控 handoff：角色可以建议 `@` 其他角色，由用户确认后继续
- ✅ 多会话可并行发送；未发送的新对话草稿切走后可恢复
- ✅ 长群聊历史下输入框保持可见，消息区独立滚动
- ✅ 长群聊历史采用选择性投影，减少频道渲染中的重复查找
- ✅ 老版本频道/角色数据自动修复，不让旧 running 卡在“正在思考”
- ✅ 逐 token 流式（codex MCP） / 项目绑定 / 无项目 cwd 隔离
- ✅ Codex 主对话回到结构化 provider event，TUI 噪声收进终端日志
- ✅ approval/permission prompt 改为 Composer 上方确认条
- ✅ Electron 升级到 36.9.2，避开 macOS 26 上旧 runtime 的崩溃弹窗
- ❌ 会话持久化（下一版）
- ❌ Windows / Linux 安装包（看需求再决定）
- ❌ 代码签名 / 公证（依赖开发者账号）

版本历史见 [`CHANGELOG.md`](./CHANGELOG.md)。

---

## Development

项目使用 Electron + React + TypeScript + electron-vite + pnpm。

```bash
pnpm install
pnpm dev          # 开发模式（自动 reload）
pnpm test         # Vitest 单测
pnpm test:e2e     # Playwright E2E
pnpm pre-commit   # 提交前全闸门检查
pnpm perf:codex   # Codex 性能门禁（无需真实账号）
pnpm dist:mac     # 本地打包 macOS dmg
```

需要 **Node >= 22.12.0** 与 **pnpm 9+**。

贡献者请读：

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — 人类贡献流程
- [`AGENTS.md`](./AGENTS.md) — AI coding agent 的统一指令
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — 方法论、架构、命令、闸门
- [`docs/decisions/`](./docs/decisions/) — ADR
- [`docs/playbooks/`](./docs/playbooks/) — 任务 step-by-step

---

## License

MIT — see [`LICENSE`](./LICENSE).
