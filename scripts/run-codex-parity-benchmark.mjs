#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const args = new Set(process.argv.slice(2));
const real = args.has('--real');
const jsonOnly = args.has('--json');
const prompt = 'Reply with exactly OK. Do not inspect files. Do not run commands.';

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = values.slice().toSorted((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? null;
}

function metric({
  firstEvidenceMs = null,
  firstAssistantTextMs = null,
  totalMs = null,
  chunkTimes = [],
  cleanupOk = false,
} = {}) {
  const cadence = chunkTimes.slice(1).map((time, index) => time - chunkTimes[index]);
  return {
    firstEvidenceMs,
    firstAssistantTextMs,
    totalMs,
    chunkCadenceP95Ms: percentile(cadence, 95),
    cleanupOk,
  };
}

function markText(metrics, startedAt, chunkTimes, text) {
  if (typeof text !== 'string' || text.length === 0) return;
  const at = Date.now() - startedAt;
  chunkTimes.push(at);
  if (metrics.firstAssistantTextMs === null) metrics.firstAssistantTextMs = at;
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('');
}

function assistantTextFromJson(message) {
  const params = message.params ?? {};
  const msg = params.msg ?? message.msg ?? {};
  const item = message.item ?? msg.item ?? {};
  const result = message.result ?? {};
  const structured = result.structuredContent ?? {};

  const eventText = msg.delta ?? msg.message ?? item.text;
  if (
    msg.type === 'agent_message_content_delta' ||
    msg.type === 'agent_message_delta' ||
    msg.type === 'agent_message' ||
    item.type === 'agent_message' ||
    message.type === 'item.completed'
  ) {
    return typeof eventText === 'string' ? eventText : '';
  }

  return textFromContent(structured.content) || textFromContent(result.content);
}

function summarize(result) {
  const baseline = result.terminalBaseline;
  const morrow = result.morrow;
  const baselineMs = baseline?.firstAssistantTextMs ?? null;
  const parityOk =
    baselineMs === null ||
    morrow.firstAssistantTextMs === null ||
    morrow.firstAssistantTextMs <= baselineMs * 1.15 + 300;
  const pass =
    result.mode === 'synthetic'
      ? morrow.firstEvidenceMs <= 100 && morrow.cleanupOk
      : morrow.firstAssistantTextMs !== null && morrow.cleanupOk && parityOk;
  return { ...result, pass, parityOk };
}

function print(result) {
  if (jsonOnly) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`# Codex parity benchmark (${result.mode})`);
  console.log('');
  console.log(`pass: ${result.pass ? 'yes' : 'no'}`);
  console.log(`parity budget: ${result.parityOk ? 'ok' : 'miss'}`);
  console.log(`terminal first text: ${result.terminalBaseline?.firstAssistantTextMs ?? 'n/a'}ms`);
  console.log(`morrow first evidence: ${result.morrow.firstEvidenceMs ?? 'n/a'}ms`);
  console.log(`morrow first text: ${result.morrow.firstAssistantTextMs ?? 'n/a'}ms`);
  console.log(`morrow total: ${result.morrow.totalMs ?? 'n/a'}ms`);
  console.log(`morrow chunk cadence p95: ${result.morrow.chunkCadenceP95Ms ?? 'n/a'}ms`);
  if (result.notes.length > 0) {
    console.log('');
    for (const note of result.notes) console.log(`- ${note}`);
  }
  console.log('');
  console.log(JSON.stringify(result, null, 2));
}

function syntheticBenchmark() {
  return summarize({
    mode: 'synthetic',
    prompt,
    morrow: metric({
      firstEvidenceMs: 42,
      firstAssistantTextMs: 64,
      totalMs: 92,
      chunkTimes: [64, 88],
      cleanupOk: true,
    }),
    terminalBaseline: metric({
      firstEvidenceMs: 40,
      firstAssistantTextMs: 60,
      totalMs: 90,
      chunkTimes: [60, 86],
      cleanupOk: true,
    }),
    notes: ['Synthetic mode validates benchmark plumbing without real Codex credentials.'],
  });
}

function runCodexExec() {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const current = metric();
    const chunkTimes = [];
    let stderr = '';
    const child = spawn(
      'codex',
      [
        'exec',
        '--json',
        '--sandbox',
        'read-only',
        '--ephemeral',
        '--ignore-rules',
        '--skip-git-repo-check',
        '-',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );

    child.stdin.end(prompt);
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (current.firstEvidenceMs === null) current.firstEvidenceMs = Date.now() - startedAt;
      try {
        const event = JSON.parse(line);
        markText(current, startedAt, chunkTimes, assistantTextFromJson(event));
        if (event.type === 'turn.completed' || event.msg?.type === 'turn.completed') {
          current.totalMs = Date.now() - startedAt;
        }
      } catch {
        // Non-JSON output is diagnostic only.
      }
    });
    child.stderr.on('data', (buf) => {
      stderr = (stderr + buf.toString('utf8')).slice(-1000);
    });
    const hard = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref?.();
    }, 60_000);
    child.on('close', (code) => {
      clearTimeout(hard);
      resolve({
        metrics: {
          ...current,
          totalMs: current.totalMs ?? Date.now() - startedAt,
          chunkCadenceP95Ms: metric({ chunkTimes }).chunkCadenceP95Ms,
          cleanupOk: code === 0,
        },
        notes: code === 0 ? [] : [`codex exec exited ${code}: ${stderr.trim().slice(-300)}`],
      });
    });
  });
}

function runCodexMcp() {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const current = metric();
    const chunkTimes = [];
    const pending = new Map();
    let nextId = 1;
    let stderr = '';
    let callId = null;
    let finished = false;
    const child = spawn('codex', ['mcp-server'], { stdio: ['pipe', 'pipe', 'pipe'] });

    const finish = (notes = []) => {
      if (finished) return;
      finished = true;
      clearTimeout(hard);
      child.kill('SIGTERM');
      resolve({
        metrics: {
          ...current,
          totalMs: current.totalMs ?? Date.now() - startedAt,
          chunkCadenceP95Ms: metric({ chunkTimes }).chunkCadenceP95Ms,
          cleanupOk: current.firstAssistantTextMs !== null,
        },
        notes,
      });
    };

    const send = (payload) => {
      child.stdin.write(`${JSON.stringify(payload)}\n`);
    };
    const request = (method, params = {}) => {
      const id = nextId;
      nextId += 1;
      send({ jsonrpc: '2.0', id, method, params });
      return {
        id,
        promise: new Promise((resolveRequest) => pending.set(id, resolveRequest)),
      };
    };

    const hard = setTimeout(() => {
      finish([`codex mcp-server timed out: ${stderr.trim().slice(-300)}`]);
    }, 60_000);

    createInterface({ input: child.stdout }).on('line', (line) => {
      if (current.firstEvidenceMs === null) current.firstEvidenceMs = Date.now() - startedAt;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      const meta = message.params?.['_meta'];
      if (message.method === 'codex/event' && meta?.requestId === callId) {
        markText(current, startedAt, chunkTimes, assistantTextFromJson(message));
      }
      if (typeof message.id === 'number' && pending.has(message.id)) {
        if (message.id === callId) {
          markText(current, startedAt, chunkTimes, assistantTextFromJson(message));
          current.totalMs = Date.now() - startedAt;
        }
        const resolveRequest = pending.get(message.id);
        pending.delete(message.id);
        resolveRequest(message);
      }
    });

    child.stderr.on('data', (buf) => {
      stderr = (stderr + buf.toString('utf8')).slice(-1000);
    });
    child.on('close', (code) => {
      if (!finished) finish([`codex mcp-server exited ${code}: ${stderr.trim().slice(-300)}`]);
    });

    void (async () => {
      const init = request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'morrow-perf', version: '0.0.0' },
      });
      const initMessage = await init.promise;
      if (initMessage.error) return finish([`mcp initialize failed: ${initMessage.error.message}`]);
      send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

      const tools = request('tools/list');
      const toolsMessage = await tools.promise;
      const names = (toolsMessage.result?.tools ?? []).map((tool) => tool.name);
      if (!names.includes('codex')) return finish(['mcp tools/list did not expose codex']);

      const call = request('tools/call', {
        name: 'codex',
        arguments: { prompt, sandbox: 'read-only', cwd: process.cwd() },
      });
      callId = call.id;
      const callMessage = await call.promise;
      if (callMessage.error) return finish([`mcp tools/call failed: ${callMessage.error.message}`]);
      finish([]);
    })().catch((error) => finish([`mcp probe failed: ${error.message}`]));
  });
}

async function realBenchmark() {
  const notes = ['Real mode compares Codex exec baseline with Morrow MCP friendly-lane protocol.'];
  const baseline = await runCodexExec();
  const morrow = await runCodexMcp();
  return summarize({
    mode: 'real',
    prompt,
    morrow: morrow.metrics,
    terminalBaseline: baseline.metrics,
    notes: [...notes, ...baseline.notes, ...morrow.notes],
  });
}

const result = real ? await realBenchmark() : syntheticBenchmark();
print(result);
process.exitCode = result.pass ? 0 : 1;
