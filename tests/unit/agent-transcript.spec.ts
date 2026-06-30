import { describe, expect, it } from 'vitest';
import {
  detectApprovalPrompt,
  parseAgentTranscript,
  stripTerminalControl,
} from '../../src/app/renderer/src/lib/agent-transcript';

describe('agent terminal diagnostics adapter', () => {
  it('strips ANSI and terminal control bytes for diagnostics', () => {
    expect(stripTerminalControl('\u001b[32mhello\u001b[0m\r\nworld')).toBe('hello\nworld');
  });

  it('keeps PTY text out of structured chat projections', () => {
    const parsed = parseAgentTranscript(`
\u001b]0;~/Library/Application Support/morrow/no-project-cwd\u0007
> 我有点疲倦了
✨ Update available! 0.130.0 -> 0.131.0
• 那就先停一下。 ›Run /review on my current changesgpt-5.5 medium · ~/Library/Application Support/morrow/no-project-cwd q q q
`);

    expect(parsed.rawText).toContain('> 我有点疲倦了');
    expect(parsed.rawText).toContain('Update available');
    expect(parsed.rawText).toContain('q q q');
    expect(parsed.approval).toBeNull();
    expect('items' in parsed).toBe(false);
    expect('turns' in parsed).toBe(false);
  });

  it('detects unresolved approval prompts and extracts command text', () => {
    const source = `
Approval required to run command: networkQuality -v
Press Enter to approve, Esc to reject
`;
    const approval = detectApprovalPrompt(source);
    expect(approval).toMatchObject({
      title: 'Codex 请求执行操作',
      command: 'networkQuality -v',
    });
    expect(parseAgentTranscript(source).approval).toEqual(approval);
  });

  it('does not keep approval prompt after it is resolved', () => {
    expect(
      detectApprovalPrompt(`
Approval required to run command: networkQuality -v
✓ You approved codex to run networkQuality -v this time
`),
    ).toBeNull();
  });
});
