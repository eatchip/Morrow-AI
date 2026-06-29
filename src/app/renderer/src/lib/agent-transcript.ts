import { useEffect, useMemo, useRef, useState } from 'react';
import type { PtyDataEvent } from '../../../../shared/ipc';

export interface AgentApprovalPrompt {
  id: string;
  title: string;
  command: string | null;
  raw: string;
}

export interface AgentTranscript {
  rawText: string;
  approval: AgentApprovalPrompt | null;
}

const OSC_RE =
  // eslint-disable-next-line no-control-regex
  /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
const STRING_CONTROL_RE =
  // eslint-disable-next-line no-control-regex
  /\u001b[PX^_][\s\S]*?\u001b\\/g;
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function stripTerminalControl(input: string): string {
  const withoutAnsi = input
    .replace(OSC_RE, '')
    .replace(STRING_CONTROL_RE, '')
    .replace(ANSI_RE, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+$/gm, '');
  let clean = '';
  for (const ch of withoutAnsi) {
    const code = ch.charCodeAt(0);
    if ((code < 32 && ch !== '\n') || code === 127) continue;
    clean += ch;
  }
  return clean;
}

export function parseAgentTranscript(raw: string): AgentTranscript {
  const rawText = stripTerminalControl(raw);
  return {
    rawText,
    approval: detectApprovalPrompt(rawText),
  };
}

export function detectApprovalPrompt(rawText: string): AgentApprovalPrompt | null {
  const lower = rawText.toLowerCase();
  const requestIndex = Math.max(
    lower.lastIndexOf('approval required'),
    lower.lastIndexOf('requires permission'),
    lower.lastIndexOf('allow codex'),
    lower.lastIndexOf('allow command'),
    lower.lastIndexOf('需要批准'),
    lower.lastIndexOf('允许执行'),
  );
  if (requestIndex < 0) return null;
  const resolvedIndex = Math.max(
    lower.lastIndexOf('you approved'),
    lower.lastIndexOf('approved codex'),
    lower.lastIndexOf('rejected'),
    lower.lastIndexOf('denied'),
  );
  if (resolvedIndex > requestIndex) return null;

  const tail = rawText.slice(Math.max(0, requestIndex - 400));
  if (!/(approve|approval|allow|permission|允许|批准)/i.test(tail)) return null;
  const command =
    /run command[:：]?\s+([^\n]+)/i.exec(tail)?.[1]?.trim() ??
    /(?:run|running|command|执行命令|运行命令)[:：]?\s+([^\n]+)/i.exec(tail)?.[1]?.trim() ??
    null;
  return {
    id: `approval-${requestIndex}`,
    title: 'Codex 请求执行操作',
    command,
    raw: tail.trim(),
  };
}

export function useAgentTerminalSession(sessionId: string | null): {
  transcript: AgentTranscript;
  approve: () => void;
  reject: () => void;
} {
  const [raw, setRaw] = useState('');
  const [hiddenApprovalId, setHiddenApprovalId] = useState<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    setRaw('');
    setHiddenApprovalId(null);
    seqRef.current = 0;
    if (!sessionId) return;

    let hydrated = false;
    const pending: PtyDataEvent[] = [];
    const writeEvent = (event: PtyDataEvent): void => {
      if (event.sessionId !== sessionId || event.seq <= seqRef.current) return;
      seqRef.current = event.seq;
      setRaw((prev) => prev + event.data);
    };
    const off = window.morrowApi.pty.onData((event) => {
      if (event.sessionId !== sessionId) return;
      if (!hydrated) {
        pending.push(event);
        return;
      }
      writeEvent(event);
    });
    void window.morrowApi.pty
      .snapshot(sessionId)
      .then((snapshot) => {
        seqRef.current = snapshot.seq;
        setRaw(snapshot.data);
        hydrated = true;
        for (const event of pending) writeEvent(event);
        pending.length = 0;
      })
      .catch((error) => {
        hydrated = true;
        setRaw(`\n[pty error] ${String((error as Error).message ?? error)}\n`);
      });
    return () => off();
  }, [sessionId]);

  const parsed = useMemo(() => parseAgentTranscript(raw), [raw]);
  const approval = parsed.approval?.id === hiddenApprovalId ? null : parsed.approval;
  const transcript = useMemo(() => ({ ...parsed, approval }), [approval, parsed]);

  const respond = (data: string): void => {
    if (!sessionId || !approval) return;
    setHiddenApprovalId(approval.id);
    void window.morrowApi.pty.write({ sessionId, data });
  };
  return {
    transcript,
    approve: () => respond('\r'),
    reject: () => respond('\x1b'),
  };
}
