# Morrow

> 群聊式 AI 多角色协作引擎 — 群聊即工作流

Morrow 是一个运行在你本地电脑上的桌面应用。把多个 AI 角色拉进同一个群聊频道，通过 `@mention` 触发任务，所有角色共享完整上下文，通过 Handoff 机制确定性接力——用群聊取代复杂的工作流编排。

- **群聊频道** — 创建频道，在群里 `@` 不同 AI 角色一起协作
- **自动组建团队** — `@Morrow` + 自然语言描述，自动生成角色配置并一键创建
- **Handoff 接力** — 角色间确定性工作流，不会随机漂移
- **本地优先** — 数据完全本地存储，无服务器依赖，隐私安全

---

## Install

### macOS

方式一：复制下面这一整行到终端，按 Enter。它会自动下载、安装并打开 Morrow。

```bash
ARCH="$(uname -m)"; [ "$ARCH" = "arm64" ] || ARCH="x64"; URL="$(curl -fsSL https://api.github.com/repos/eatchip/Morrow-AI/releases/latest | sed -nE "s/.*\"browser_download_url\": \"([^\"]*Morrow-[^\"]*-$ARCH\.dmg)\".*/\1/p" | head -n 1)"; DMG="$TMPDIR/Morrow.dmg"; test -n "$URL" && curl -fL "$URL" -o "$DMG" && VOL="$(hdiutil attach "$DMG" -nobrowse | awk '/\/Volumes\//{print substr($0,index($0,"/Volumes/")); exit}')" && ditto "$VOL/Morrow.app" /Applications/Morrow.app && xattr -cr /Applications/Morrow.app && open /Applications/Morrow.app && hdiutil detach "$VOL" -quiet
```

方式二：到 [Releases](https://github.com/eatchip/Morrow-AI/releases/latest) 下载 dmg，打开后把 `Morrow.app` 拖进"应用程序"。如果首次打开提示"已损坏，无法打开"，复制下面这一整行到终端，按 Enter：

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

### 快速开始

1. 安装并打开 Morrow
2. 新建频道（左侧边栏 **# 新建群聊**）
3. 输入 `@Morrow 帮我组建一个 AI 团队：后端架构师 + 前端工程师`
4. 点击「确认创建」，角色自动加入频道
5. `@后端架构师 帮我设计用户认证模块` → 完成后自动 Handoff 给下一个角色

### AI 队友

1. 左侧边栏 **AI 队友** 区域点 `+`
2. 填写名称、模型（Claude Code / Codex）、简介和「指示」prompt
3. 把角色加入频道后即可 `@` 使用

---

## Features

- ✅ 群聊式多角色协作，`@mention` 触发任务
- ✅ 自动团队组建：`@Morrow` 一句话生成角色配置，内联确认卡片
- ✅ Handoff 接力：角色间确定性工作流
- ✅ 共享上下文：频道内所有角色看到完整对话历史
- ✅ 个人对话 + 群聊频道双模式
- ✅ 逐 token 流式输出（Codex MCP）
- ✅ 本地优先，数据完全本地存储
- ✅ macOS arm64 / x64 支持

---

## Development

```bash
pnpm install
pnpm dev          # 开发模式
pnpm test         # 单元测试
pnpm test:e2e     # E2E 测试
pnpm dist:mac     # 打包 macOS dmg
```

需要 **Node >= 22.12.0** 与 **pnpm 9+**。

---

## License

MIT — see [`LICENSE`](./LICENSE).
