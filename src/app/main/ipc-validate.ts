import {
  EFFORT_LEVELS,
  MODEL_ID_REGEX,
  type EffortLevel,
  type AcceptHandoffArgs,
  type AddRoleToChannelArgs,
  type ConfirmTeamProposalArgs,
  type CreateChannelArgs,
  type CreateRoleArgs,
  type DeleteChannelArgs,
  type DeleteRoleArgs,
  type DismissTeamProposalArgs,
  type PostChannelMessageArgs,
  type PtyAgentStartArgs,
  type PtyResizeArgs,
  type PtyWriteArgs,
  type SendPromptArgs,
  type UpdateRoleArgs,
} from '../../shared/ipc';

/**
 * 主进程对 `SendPromptArgs` 的唯一校验点。
 *
 * 独立于 `./ipc.ts`（避免测试时被 `electron` 顶层导入拖垮），便于 vitest 直接 import。
 *
 * 设计约束（见 spec `.comate/specs/agent-model-picker/doc.md` §3.4 不变量）：
 *  - `model` 通过 `MODEL_ID_REGEX` 白名单字符，防止空格/反引号/`$()`/管道被拼进 argv。
 *  - `effort` 必须在 `EFFORT_LEVELS` 枚举内，否则拒绝。
 *  - 未提供 `model`/`effort` 一律合法（走 CLI 默认值，零回退）。
 */
export function validateSendPromptArgs(x: unknown): x is SendPromptArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  const base =
    (o['runtime'] === 'claude' || o['runtime'] === 'codex') &&
    typeof o['prompt'] === 'string' &&
    (o['prompt'] as string).length > 0 &&
    typeof o['sessionId'] === 'string' &&
    (o['sessionId'] as string).length > 0;
  if (!base) return false;
  const pid = o['projectId'];
  if (pid !== undefined && pid !== null && typeof pid !== 'string') return false;
  const cid = o['conversationId'];
  if (cid !== undefined && cid !== null && typeof cid !== 'string') return false;
  const model = o['model'];
  if (model !== undefined) {
    if (typeof model !== 'string' || !MODEL_ID_REGEX.test(model)) return false;
  }
  const effort = o['effort'];
  if (effort !== undefined) {
    if (!EFFORT_LEVELS.includes(effort as EffortLevel)) return false;
  }
  return true;
}

function isModel(value: unknown): boolean {
  return typeof value === 'string' && MODEL_ID_REGEX.test(value);
}

function isEffort(value: unknown): value is EffortLevel {
  return EFFORT_LEVELS.includes(value as EffortLevel);
}

function isRuntime(value: unknown): value is 'claude' | 'codex' {
  return value === 'claude' || value === 'codex';
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateRunId(x: unknown): x is string {
  return nonEmptyString(x);
}

function optionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function optionalStringArray(value: unknown): boolean {
  return (
    value === undefined || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isTerminalSize(cols: unknown, rows: unknown): boolean {
  return (
    Number.isInteger(cols) &&
    Number.isInteger(rows) &&
    (cols as number) >= 20 &&
    (cols as number) <= 400 &&
    (rows as number) >= 5 &&
    (rows as number) <= 200
  );
}

export function validatePtyAgentStartArgs(x: unknown): x is PtyAgentStartArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  const base =
    o['runtime'] === 'codex' &&
    typeof o['prompt'] === 'string' &&
    (o['prompt'] as string).length > 0 &&
    isTerminalSize(o['cols'], o['rows']);
  if (!base) return false;
  const pid = o['projectId'];
  if (pid !== undefined && pid !== null && typeof pid !== 'string') return false;
  const model = o['model'];
  if (model !== undefined && !isModel(model)) return false;
  const effort = o['effort'];
  if (effort !== undefined && !isEffort(effort)) return false;
  return true;
}

export function validatePtyWriteArgs(x: unknown): x is PtyWriteArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o['sessionId'] !== 'string' || (o['sessionId'] as string).length === 0) return false;
  if (typeof o['data'] !== 'string') return false;
  const encoding = o['encoding'];
  if (encoding !== undefined && encoding !== 'utf8' && encoding !== 'binary') return false;
  return true;
}

export function validatePtyResizeArgs(x: unknown): x is PtyResizeArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o['sessionId'] !== 'string' || (o['sessionId'] as string).length === 0) return false;
  return isTerminalSize(o['cols'], o['rows']);
}

export function validateCreateChannelArgs(x: unknown): x is CreateChannelArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    nonEmptyString(o['name']) &&
    optionalString(o['description']) &&
    optionalString(o['folderProjectId']) &&
    optionalStringArray(o['memberRoleIds'])
  );
}

export function validateCreateRoleArgs(x: unknown): x is CreateRoleArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    nonEmptyString(o['name']) &&
    nonEmptyString(o['intro']) &&
    nonEmptyString(o['instruction']) &&
    isRuntime(o['defaultRuntime']) &&
    optionalStringArray(o['channelIds'])
  );
}

export function validateUpdateRoleArgs(x: unknown): x is UpdateRoleArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (!nonEmptyString(o['roleId'])) return false;
  if (o['name'] !== undefined && !nonEmptyString(o['name'])) return false;
  if (o['intro'] !== undefined && !nonEmptyString(o['intro'])) return false;
  if (o['instruction'] !== undefined && !nonEmptyString(o['instruction'])) return false;
  if (o['defaultRuntime'] !== undefined && !isRuntime(o['defaultRuntime'])) return false;
  return true;
}

export function validateDeleteRoleArgs(x: unknown): x is DeleteRoleArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return nonEmptyString(o['roleId']);
}

export function validateDeleteChannelArgs(x: unknown): x is DeleteChannelArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return nonEmptyString(o['channelId']);
}

export function validateAddRoleToChannelArgs(x: unknown): x is AddRoleToChannelArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return nonEmptyString(o['channelId']) && nonEmptyString(o['roleId']);
}

export function validatePostChannelMessageArgs(x: unknown): x is PostChannelMessageArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return nonEmptyString(o['channelId']) && nonEmptyString(o['text']);
}

export function validateAcceptHandoffArgs(x: unknown): x is AcceptHandoffArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return nonEmptyString(o['channelId']) && nonEmptyString(o['handoffId']);
}

export function validateConfirmTeamProposalArgs(x: unknown): x is ConfirmTeamProposalArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return nonEmptyString(o['channelId']) && nonEmptyString(o['proposalId']);
}

export function validateDismissTeamProposalArgs(x: unknown): x is DismissTeamProposalArgs {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return nonEmptyString(o['channelId']) && nonEmptyString(o['proposalId']);
}
