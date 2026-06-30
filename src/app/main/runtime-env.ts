const STRIP_EXACT = new Set([
  'ELECTRON_RUN_AS_NODE',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL',
  'CODEX_CI',
  'CODEX_SANDBOX_NETWORK_DISABLED',
  'CODEX_SHELL',
  'CODEX_THREAD_ID',
]);

const STRIP_PREFIXES = ['CODEX_INTERNAL_', 'CODEX_REMOTE_'];

export function shouldStripRuntimeEnv(name: string): boolean {
  if (STRIP_EXACT.has(name)) return true;
  return STRIP_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export function sanitizedRuntimeEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...source };
  for (const key of Object.keys(env)) {
    if (shouldStripRuntimeEnv(key)) {
      delete env[key];
    }
  }
  return env;
}

export function mergedRuntimeEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return sanitizedRuntimeEnv({ ...process.env, ...extra });
}
