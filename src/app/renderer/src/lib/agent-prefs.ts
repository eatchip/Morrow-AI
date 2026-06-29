/**
 * 渲染进程侧的 agent 模型 / effort 偏好持久化。
 *
 * 所有常量来自 `shared/ipc.ts`（唯一事实来源），本文件只负责：
 * - 定义默认值
 * - 从 localStorage 读取 / 写入
 * - 对读入的未知结构做 sanitize，非法字段静默回退到默认值（不抛）
 *
 * 校验兜底仍在主进程（IPC 边界），此处只是 UX 层的防错。
 */

import {
  CLAUDE_MODELS,
  CODEX_MODELS,
  EFFORT_LEVELS,
  type ClaudeModel,
  type CodexModel,
  type EffortLevel,
  type RuntimeId,
} from '../../../../shared/ipc';

export const AGENT_PREFS_STORAGE_KEY = 'morrow:agent-prefs:v1';

export interface CodexPrefs {
  model: CodexModel;
  effort: EffortLevel;
}

export interface ClaudePrefs {
  model: ClaudeModel;
}

export interface AgentPrefs {
  codex: CodexPrefs;
  claude: ClaudePrefs;
}

/**
 * 默认偏好：
 * - codex：`gpt-5.5` + `medium`（ChatGPT 账号下 TUI 的默认 current）
 * - claude：`sonnet`（速度/质量平衡的缺省档）
 */
export const DEFAULT_AGENT_PREFS: AgentPrefs = {
  codex: { model: 'gpt-5.5', effort: 'medium' },
  claude: { model: 'sonnet' },
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function pickCodexModel(v: unknown): CodexModel {
  return (CODEX_MODELS as readonly string[]).includes(v as string)
    ? (v as CodexModel)
    : DEFAULT_AGENT_PREFS.codex.model;
}

function pickClaudeModel(v: unknown): ClaudeModel {
  return (CLAUDE_MODELS as readonly string[]).includes(v as string)
    ? (v as ClaudeModel)
    : DEFAULT_AGENT_PREFS.claude.model;
}

function pickEffort(v: unknown): EffortLevel {
  return (EFFORT_LEVELS as readonly string[]).includes(v as string)
    ? (v as EffortLevel)
    : DEFAULT_AGENT_PREFS.codex.effort;
}

/**
 * 从任意未知输入规范化出 AgentPrefs。非法 / 缺失字段一律回退默认；绝不抛。
 * 纯函数，便于单测。
 */
export function sanitizePrefs(raw: unknown): AgentPrefs {
  if (!isRecord(raw)) return DEFAULT_AGENT_PREFS;
  const codexRaw = isRecord(raw.codex) ? raw.codex : {};
  const claudeRaw = isRecord(raw.claude) ? raw.claude : {};
  return {
    codex: {
      model: pickCodexModel(codexRaw.model),
      effort: pickEffort(codexRaw.effort),
    },
    claude: {
      model: pickClaudeModel(claudeRaw.model),
    },
  };
}

/**
 * 读取偏好；localStorage 不可用 / JSON 非法一律回退默认。
 */
export function loadPrefs(): AgentPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(AGENT_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT_PREFS;
    return sanitizePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_AGENT_PREFS;
  }
}

/**
 * 写入偏好；localStorage 不可用时静默失败（例如隐私模式）。
 */
export function savePrefs(prefs: AgentPrefs): void {
  try {
    globalThis.localStorage?.setItem(AGENT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // noop
  }
}

/**
 * 从 AgentPrefs 中派生出给 sendPrompt 的字段。
 * claude runtime 不带 effort（即便 prefs 里记录了 codex 的 effort）。
 */
export function prefsForRuntime(
  prefs: AgentPrefs,
  runtime: RuntimeId,
): { model: string; effort?: EffortLevel } {
  if (runtime === 'codex') {
    return { model: prefs.codex.model, effort: prefs.codex.effort };
  }
  return { model: prefs.claude.model };
}
