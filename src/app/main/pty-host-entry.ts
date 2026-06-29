import type { IPty } from 'node-pty';
import { spawn } from 'node-pty';
import { chmodSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  isPtyHostRequest,
  PTY_HOST_PROTOCOL_VERSION,
  type PtyHostMessage,
  type PtyHostRequest,
  type PtyHostSpawnRequest,
} from './pty-host-protocol';

const require = createRequire(import.meta.url);

type ParentPort = {
  on: (event: 'message', listener: (messageEvent: { data: unknown } | unknown) => void) => void;
  postMessage: (message: unknown) => void;
  start?: () => void;
};

function resolveParentPort(): ParentPort {
  const maybeProcessPort = (process as unknown as { parentPort?: ParentPort }).parentPort;
  if (maybeProcessPort) return maybeProcessPort;
  const childProcessPort = process as unknown as {
    on: (event: 'message', listener: (message: unknown) => void) => void;
    send?: (message: unknown) => void;
  };
  if (typeof childProcessPort.send !== 'function') {
    throw new Error('[pty-host] missing parent port');
  }
  return {
    on: (_event, listener) => childProcessPort.on('message', (message) => listener(message)),
    postMessage: (message) => childProcessPort.send?.(message),
  };
}

const parentPort = resolveParentPort();
parentPort.start?.();

const sessions = new Map<string, IPty>();

function ensureNodePtySpawnHelperExecutable(): void {
  if (process.platform === 'win32') return;
  const packagePath = require.resolve('node-pty/package.json');
  const root = dirname(packagePath);
  const helperPaths = [
    join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
    join(root, 'build', 'Release', 'spawn-helper'),
  ];
  for (const helperPath of helperPaths) {
    try {
      const info = statSync(helperPath);
      if (info.isFile() && (info.mode & 0o111) === 0) {
        chmodSync(helperPath, info.mode | 0o111);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

function send(message: PtyHostMessage): void {
  try {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Electron process port, not Window.postMessage.
    parentPort.postMessage(message);
  } catch {
    // parent is already gone
  }
}

function respondError(requestId: string, error: unknown): void {
  send({
    type: 'response',
    requestId,
    ok: false,
    error: {
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
    },
  });
}

function cleanup(): void {
  for (const [, pty] of sessions) {
    try {
      pty.kill();
    } catch {
      // ignore
    }
  }
  sessions.clear();
}

process.once('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.once('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.once('disconnect', () => {
  cleanup();
  process.exit(0);
});
process.once('exit', cleanup);

function spawnSession(request: PtyHostSpawnRequest): void {
  ensureNodePtySpawnHelperExecutable();
  const pty = spawn(request.command, request.args, {
    cwd: request.cwd,
    env: request.env,
    cols: request.cols,
    rows: request.rows,
    name: 'xterm-256color',
  });

  const sessionId = request.sessionId;
  sessions.set(sessionId, pty);
  pty.onData((data) => send({ type: 'data', sessionId, data }));
  pty.onExit((event) => {
    sessions.delete(sessionId);
    send({ type: 'exit', sessionId, exitCode: event.exitCode });
  });
  send({ type: 'response', requestId: request.requestId, ok: true, result: { sessionId } });
}

function handleRequest(request: PtyHostRequest): void {
  if (request.type === 'spawn') {
    try {
      spawnSession(request);
    } catch (error) {
      respondError(request.requestId, error);
    }
    return;
  }

  if (request.type === 'write') {
    const pty = sessions.get(request.sessionId);
    if (!pty) return;
    pty.write(request.data);
    return;
  }

  if (request.type === 'resize') {
    sessions.get(request.sessionId)?.resize(request.cols, request.rows);
    return;
  }

  if (request.type === 'kill') {
    const pty = sessions.get(request.sessionId);
    sessions.delete(request.sessionId);
    pty?.kill();
    return;
  }

  if (request.type === 'shutdown') {
    cleanup();
    process.exit(0);
  }
}

parentPort.on('message', (messageEvent) => {
  const raw =
    typeof messageEvent === 'object' && messageEvent !== null && 'data' in messageEvent
      ? (messageEvent as { data: unknown }).data
      : messageEvent;
  if (!isPtyHostRequest(raw)) return;
  handleRequest(raw);
});

send({ type: 'ready', protocolVersion: PTY_HOST_PROTOCOL_VERSION });
