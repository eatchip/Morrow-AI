export const PTY_HOST_PROTOCOL_VERSION = 1 as const;

export type PtyWriteEncoding = 'utf8' | 'binary';

export interface PtyHostSpawnRequest {
  type: 'spawn';
  requestId: string;
  sessionId: string;
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  cols: number;
  rows: number;
}

export interface PtyHostWriteRequest {
  type: 'write';
  sessionId: string;
  data: string;
  encoding?: PtyWriteEncoding;
}

export interface PtyHostResizeRequest {
  type: 'resize';
  sessionId: string;
  cols: number;
  rows: number;
}

export interface PtyHostKillRequest {
  type: 'kill';
  sessionId: string;
}

export interface PtyHostShutdownRequest {
  type: 'shutdown';
}

export type PtyHostRequest =
  | PtyHostSpawnRequest
  | PtyHostWriteRequest
  | PtyHostResizeRequest
  | PtyHostKillRequest
  | PtyHostShutdownRequest;

export type PtyHostMessage =
  | { type: 'ready'; protocolVersion: typeof PTY_HOST_PROTOCOL_VERSION }
  | { type: 'response'; requestId: string; ok: true; result: { sessionId: string } }
  | { type: 'response'; requestId: string; ok: false; error: { name?: string; message: string } }
  | { type: 'data'; sessionId: string; data: string }
  | { type: 'exit'; sessionId: string; exitCode: number };

const REQUEST_TYPES = new Set(['spawn', 'write', 'resize', 'kill', 'shutdown']);

export function isPtyHostRequest(value: unknown): value is PtyHostRequest {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as Record<string, unknown>)['type'];
  return typeof type === 'string' && REQUEST_TYPES.has(type);
}

export function isPtyHostMessage(value: unknown): value is PtyHostMessage {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as Record<string, unknown>)['type'];
  return typeof type === 'string';
}
