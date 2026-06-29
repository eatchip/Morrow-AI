import type {
  AcceptHandoffArgs,
  ChannelSnapshot,
  DeleteChannelArgs,
  PostChannelMessageArgs,
  RoleRun,
} from '../../../shared/channel-ipc';
import type { RuntimeId } from '../../../shared/ipc';
import { MORROW_ROLE_ID } from '../infrastructure/channels-file';
import { buildRoleContextEnvelope } from './role-context-envelope';
import type {
  ChannelEventSink,
  ChannelFolderResolver,
  ChannelStorePort,
  RoleRuntimePort,
} from './channel-ports';

interface Deps {
  store: ChannelStorePort;
  folders: ChannelFolderResolver;
  runtime: RoleRuntimePort;
  emit: ChannelEventSink;
}

const ROLE_RUN_TIMEOUT_MS = 180_000;

export class ChannelOrchestrator {
  constructor(private readonly deps: Deps) {}

  async getSnapshot(): Promise<ChannelSnapshot> {
    return this.deps.store.getSnapshot();
  }

  async postMessage(args: PostChannelMessageArgs): Promise<ChannelSnapshot> {
    const patch = await this.deps.store.postUserMessage(args);
    this.deps.emit({ kind: 'snapshot', snapshot: patch.snapshot });
    for (const run of patch.runsToStart) this.startRun(run, patch.snapshot);
    return patch.snapshot;
  }

  async acceptHandoff(args: AcceptHandoffArgs): Promise<ChannelSnapshot> {
    const patch = await this.deps.store.acceptHandoff(args);
    this.deps.emit({ kind: 'snapshot', snapshot: patch.snapshot });
    for (const run of patch.runsToStart) this.startRun(run, patch.snapshot);
    return patch.snapshot;
  }

  async deleteChannel(args: DeleteChannelArgs): Promise<ChannelSnapshot> {
    const patch = await this.deps.store.deleteChannel(args);
    for (const runId of patch.runIdsToAbort) this.deps.runtime.abort(runId);
    this.deps.emit({ kind: 'snapshot', snapshot: patch.snapshot });
    return patch.snapshot;
  }

  private startRun(run: RoleRun, baseSnapshot: ChannelSnapshot): void {
    void this.startRunAsync(run, baseSnapshot);
  }

  private async startRunAsync(run: RoleRun, baseSnapshot: ChannelSnapshot): Promise<void> {
    let settled = false;
    let timeout: NodeJS.Timeout | null = null;
    const finish = async (kind: 'done' | 'error', message: string): Promise<void> => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      const snapshot =
        kind === 'done'
          ? await this.deps.store.completeRoleRun(run.id, message)
          : await this.deps.store.failRoleRun(run.id, message);
      this.deps.emit({ kind: 'snapshot', snapshot });
      if (kind === 'done' && run.roleId === MORROW_ROLE_ID) {
        await this.handleMorrowOutput(run, message);
      }
    };

    try {
      const channel = baseSnapshot.channels.find((item) => item.id === run.channelId);
      if (!channel) return;
      const cwd = await this.deps.folders.resolve(channel.folderProjectId);
      if (!cwd) {
        await finish('error', '频道绑定文件夹不可访问。');
        return;
      }
      const liveSnapshot = this.deps.store.getSnapshot();
      const liveRun = liveSnapshot.runs.find((item) => item.id === run.id);
      const liveChannel = liveSnapshot.channels.find((item) => item.id === run.channelId);
      if (!liveRun || liveRun.status !== 'running' || !liveChannel) return;
      const prompt = buildRoleContextEnvelope({ snapshot: liveSnapshot, run: liveRun, cwd });
      let buffer = '';
      timeout = setTimeout(() => {
        void finish('error', '角色运行超时，已停止等待。请稍后重试，或切换这个角色的模型。');
      }, ROLE_RUN_TIMEOUT_MS);
      timeout.unref?.();
      this.deps.runtime.start(
        {
          runtime: liveRun.runtime,
          prompt,
          sessionId: liveRun.id,
          cwd,
          conversationId: `${liveRun.channelId}:${liveRun.roleId}`,
        },
        (event) => {
          if (settled) return;
          if (event.kind === 'chunk') {
            buffer += event.text;
            this.deps.emit({
              kind: 'run-chunk',
              channelId: run.channelId,
              roleId: run.roleId,
              runId: run.id,
              text: event.text,
            });
            return;
          }
          if (event.kind === 'done') {
            void finish('done', buffer);
            return;
          }
          void finish('error', event.message);
        },
      );
    } catch (error) {
      await finish('error', `角色运行失败：${(error as Error).message}`);
    }
  }

  private async handleMorrowOutput(run: RoleRun, text: string): Promise<void> {
    const parsed = this.parseMorrowJson(text);
    if (!parsed) return;
    const snapshot = await this.deps.store.createTeamProposal(run.channelId, run.id, parsed);
    this.deps.emit({ kind: 'snapshot', snapshot });
  }

  private parseMorrowJson(
    text: string,
  ): { name: string; intro: string; instruction: string; defaultRuntime: RuntimeId } | null {
    // Extract JSON from ```json ... ``` or raw JSON
    let jsonStr = text;
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) jsonStr = fenced[1]!;
    try {
      const obj = JSON.parse(jsonStr.trim()) as Record<string, unknown>;
      const name = typeof obj['name'] === 'string' ? obj['name'].trim() : '';
      if (!name) return null;
      const intro = typeof obj['intro'] === 'string' ? obj['intro'].trim() : `${name} 角色`;
      const instruction =
        typeof obj['instruction'] === 'string' ? obj['instruction'].trim() : `你是 ${name}。`;
      const rt = obj['defaultRuntime'];
      const defaultRuntime: RuntimeId = rt === 'claude' ? 'claude' : 'codex';
      return { name, intro, instruction, defaultRuntime };
    } catch {
      return null;
    }
  }
}
