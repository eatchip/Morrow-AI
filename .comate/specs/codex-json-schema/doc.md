# Fix: Codex 对话无输出 · 适配 codex-cli 新版 JSONL 事件 schema

## 1. 背景与复现

用户在主界面向 **Codex** 发送 prompt 后，运行时能被正确检测到（`codex --version` 成功），但对话内容始终显示 `(no output)`，即"读取到 runtime 但通信失败"。

### 1.1 复现

在本机执行 Morrow 真实使用的命令：

```bash
$ echo "hi, say just: pong" | codex exec --json --skip-git-repo-check -
{"type":"thread.started","thread_id":"019e1f84-..."}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"pong"}}
{"type":"turn.completed","usage":{...}}
```

进程以 `exit 0` 结束。

### 1.2 根因

`src/app/main/runtime-session.ts:67 parseCodexLine` 只识别**旧**版事件：

| 旧版 schema（我们解析的） | 新版 schema（codex-cli ≥ 0.x 实际输出） |
|---|---|
| `{"msg":{"type":"agent_message_delta","delta":"..."}}` | `{"type":"item.completed","item":{"type":"agent_message","text":"..."}}` |
| `{"msg":{"type":"agent_message","message":"..."}}` | — 新版不再产出独立 `agent_message` 增量 |
| `{"msg":{"type":"error","message":"..."}}` | `{"type":"item.completed","item":{"type":"error",...}}` / 顶层 `type:"error"` |
| — | `{"type":"thread.started" \| "turn.started" \| "turn.completed", ...}` |

所有新版事件走到 `parseCodexLine` 后都落入 `return null`，因此 `startSession` 的 `rl.on('line', ...)` 分支永远不会 emit `chunk`。`child.on('close')` 正常触发 `done`，最终渲染层只收到一个空会话，UI 显示 `(no output)`。

本机 CLI 版本：`codex-cli 0.128.0`。

### 1.3 受影响范围

- 仅 Codex runtime；Claude runtime 不受影响（独立解析函数 + 不同的 CLI 协议）。
- 所有 Morrow 版本 ≥ v0.1.0（当前 `main`）。
- 用户表现：发送任何消息均 `(no output)`，中止按钮仍可用（session 生命周期正常，仅内容为空）。

## 2. 处理思路

**唯一动作**：把 `parseCodexLine` 升级为同时识别新旧两种事件 schema 的**并集**解析器。

选择合并而非替换的理由：
1. 用户可能装有不同版本 codex（尤其旧版），保留旧解析不会产生语义冲突（旧字段在新输出里不出现，反之亦然）。
2. 改动最小，风险面最低。

### 2.1 新事件识别规则

新版输出以**顶层 `type`** 为路由键：

| 顶层 `type` | 处理 |
|---|---|
| `item.completed` 且 `item.type === 'agent_message'` | 返回 `item.text`（字符串）作为完整输出块 |
| `item.completed` 且 `item.type === 'error'` | 返回 `\n[error] <item.message \|\| item.text>`（截 500 字符） |
| `thread.started` / `turn.started` / `turn.completed` / 其它 `item.completed` 子类型 | 返回 `null`（静默） |
| 顶层 `type === 'error'`（防御兜底） | 返回 `\n[error] <message>` |

旧规则保持不变（`msg.type === 'agent_message_delta'` 等），作为旧版 codex 的兼容通路。

### 2.2 关于流式体验

新版 codex 不再输出 `agent_message_delta`，一次对话只有一条 `item.completed` 全量消息。Morrow 当前不区分"流式/整块"，渲染层直接拼接 `chunk`，整块一次送达对用户体验的影响是**首字节延迟=总延迟**。

本次 **不** 处理此问题：
- 这是 codex 上游 CLI 的选择（`--json` 不再有 delta），非 Morrow 能修复的范围。
- 若未来需要真实流式，应另起 SDD 探索 `codex proto` / MCP 协议或 `--output-last-message` 组合方案。

在 `doc.md` / 代码注释里标注这一事实即可，避免后人误以为是 bug。

## 3. 影响文件

| 文件 | 修改类型 | 说明 |
|---|---|---|
| `/Users/songhuiyu/Morrow/src/app/main/runtime-session.ts` | 修改 `parseCodexLine` | 新增顶层 `type` 分发；在文件头部注释里记录兼容的两个 schema |
| `/Users/songhuiyu/Morrow/tests/contract/runtime-parse.spec.ts` | 追加 4 个用例 | 覆盖 `item.completed agent_message` / `item.completed error` / `thread.started` 静默 / 顶层 `error` |
| `/Users/songhuiyu/Morrow/CHANGELOG.md` | `[Unreleased]` 新增 fix 条目 | 用户可感知变更（恢复 Codex 对话） |

`runtime-detect.ts`、`ipc.ts`、renderer 均**不动**：IPC 契约未变，detect 逻辑未变，只是解析层字段映射。

## 4. 关键代码片段（落地草案）

```ts
// runtime-session.ts
export function parseCodexLine(line: string): string | null {
  let e: unknown;
  try { e = JSON.parse(line); } catch { return line; }
  if (typeof e !== 'object' || e === null) return null;
  const obj = e as Record<string, unknown>;

  // 新版 schema (codex-cli 0.128+): 顶层 type
  const topType = typeof obj['type'] === 'string' ? (obj['type'] as string) : undefined;
  if (topType === 'item.completed') {
    const item = obj['item'] as Record<string, unknown> | undefined;
    const itemType = item && typeof item['type'] === 'string' ? item['type'] : undefined;
    if (itemType === 'agent_message') {
      return typeof item!['text'] === 'string' ? (item!['text'] as string) : '';
    }
    if (itemType === 'error') {
      const msg = (item!['message'] ?? item!['text'] ?? '') as string;
      return `\n[error] ${String(msg).slice(0, 500)}`;
    }
    return null;
  }
  if (topType === 'thread.started' || topType === 'turn.started' || topType === 'turn.completed') {
    return null;
  }
  if (topType === 'error') {
    return `\n[error] ${String(obj['message'] ?? '').slice(0, 500)}`;
  }

  // 旧版 schema 兼容 (msg.type)
  const msg = obj['msg'] as Record<string, unknown> | undefined;
  const mType = msg && typeof msg['type'] === 'string' ? msg['type'] : topType;
  if (mType === 'agent_message_delta') {
    return String(msg?.['delta'] ?? obj['delta'] ?? '');
  }
  if (mType === 'agent_message') return '';
  if (mType === 'error') {
    return `\n[error] ${String(msg?.['message'] ?? obj['message'] ?? '').slice(0, 500)}`;
  }
  return null;
}
```

（最终实现以代码提交为准，此处仅示意。）

## 5. 边界与异常

- **空 text**：`item.completed.agent_message` 带空 `text` → 返回 `''`，上层 `text.length > 0` 过滤，不 emit，不产生空气泡。
- **非 JSON 行**：保持原有 `catch → return line` 行为（裸文本透出），避免 CLI 偶发 warning 吃掉。
- **未识别的顶层 type**（未来再改 schema）：`return null` 静默，进程仍以退出码判定成功/失败，不会假崩。
- **exit=0 但 0 条 chunk**（新版 CLI 未产出 `agent_message`）：保持现状（`done`），渲染层应展示"对话已结束"（当前 UI 已如此）。

## 6. 数据流

```
codex exec --json -
  └─ stdout (JSONL)
       └─ readline (runtime-session.ts)
            └─ parseCodexLine(line) ─┐
                 新版 item.completed.agent_message.text
                 旧版 msg.agent_message_delta.delta
                                       │
                                       ▼
                 emit({ kind:'chunk', text })
                      │
                      ▼
              ipc.ts → webContents.send('runtime:stream', ev)
                      │
                      ▼
              preload → renderer onStream → Chat UI 追加
```

## 7. 预期结果

- `pnpm vitest tests/contract/runtime-parse.spec.ts` 全绿，新增用例覆盖新版 schema 的 3 种路径。
- `pnpm dev` 打开应用，选中 Codex，发送 "ping" → 气泡显示 codex 返回的正文。
- `pnpm pre-commit` 闸门全部通过。
- `CHANGELOG.md [Unreleased]` 增加一条 `### Fixed`。

## 8. 非目标 / 未解决

- 不实现真流式打字效果（CLI 侧不再提供 delta）。
- 不为 Claude runtime 做兼容性改动。
- 不升级 `codex` CLI 依赖（它是外部全局二进制，Morrow 不管理）。
