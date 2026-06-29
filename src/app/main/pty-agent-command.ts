import type { EffortLevel } from '../../shared/ipc';

export interface CodexPtyCommandOptions {
  cwd: string;
  prompt: string;
  model?: string;
  effort?: EffortLevel;
}

export interface PtyCommand {
  command: string;
  args: string[];
}

/**
 * Build the interactive Codex command used by the PTY path.
 *
 * This intentionally launches `codex [PROMPT]` rather than `codex exec`.
 * The goal is terminal parity: Morrow should render the same interactive TUI
 * the user gets from Terminal, while still injecting model / effort / cwd as
 * separate argv elements.
 */
export function buildCodexPtyCommand(options: CodexPtyCommandOptions): PtyCommand {
  const args: string[] = ['-C', options.cwd];
  if (options.model) args.push('--model', options.model);
  if (options.effort) args.push('-c', `model_reasoning_effort=${options.effort}`);
  if (options.prompt.startsWith('-')) args.push('--');
  args.push(options.prompt);
  return { command: 'codex', args };
}

export function encodeCodexFollowupInput(text: string): string {
  if (text.includes('\n')) {
    return `\x1b[200~${text}\x1b[201~\r`;
  }
  return `${text}\r`;
}
