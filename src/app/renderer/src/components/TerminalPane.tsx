import { useEffect, useRef } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import type { PtyDataEvent } from '../../../../shared/ipc';

interface Props {
  sessionId: string;
  readOnly?: boolean;
}

function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function TerminalPane({ sessionId, readOnly = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      disableStdin: readOnly,
      fontFamily: token('--mono', 'ui-monospace, Menlo, monospace'),
      fontSize: 13,
      lineHeight: 1.35,
      theme: {
        background: token('--bg', '#0b0b0d'),
        foreground: token('--text', '#e6e6e6'),
        cursor: token('--accent', '#a3e635'),
        selectionBackground: token('--line-strong', '#2a2a30'),
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(root);
    if (readOnly) {
      root.setAttribute('tabindex', '-1');
      root.setAttribute('aria-hidden', 'true');
      for (const node of root.querySelectorAll<HTMLElement>('textarea, [tabindex]')) {
        node.setAttribute('tabindex', '-1');
      }
      term.blur();
    }

    let lastSeq = 0;
    let hydrated = false;
    const pending: PtyDataEvent[] = [];

    const writeEvent = (event: PtyDataEvent): void => {
      if (event.sessionId !== sessionId || event.seq <= lastSeq) return;
      term.write(event.data);
      lastSeq = event.seq;
    };

    const offData = window.morrowApi.pty.onData((event) => {
      if (event.sessionId !== sessionId) return;
      if (!hydrated) {
        pending.push(event);
        return;
      }
      writeEvent(event);
    });
    const input = readOnly
      ? null
      : term.onData((data) => {
          void window.morrowApi.pty.write({ sessionId, data });
        });

    const fit = (): void => {
      try {
        fitAddon.fit();
        void window.morrowApi.pty.resize({
          sessionId,
          cols: term.cols,
          rows: term.rows,
        });
      } catch {
        // The fit addon can throw while the container is detached during teardown.
      }
    };

    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;
    resizeObserver?.observe(root);
    setTimeout(fit, 0);

    void window.morrowApi.pty
      .snapshot(sessionId)
      .then((snapshot) => {
        term.write(snapshot.data);
        lastSeq = snapshot.seq;
        hydrated = true;
        for (const event of pending) writeEvent(event);
        pending.length = 0;
      })
      .catch((error) => {
        hydrated = true;
        term.write(`\r\n[pty error] ${String((error as Error).message ?? error)}\r\n`);
      });

    return () => {
      resizeObserver?.disconnect();
      input?.dispose();
      offData();
      term.dispose();
    };
  }, [sessionId, readOnly]);

  return (
    <div
      className={`terminal-pane${readOnly ? ' read-only' : ''}`}
      data-testid="terminal-pane"
      ref={rootRef}
    />
  );
}
