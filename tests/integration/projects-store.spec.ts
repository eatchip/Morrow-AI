import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectsStore } from '../../src/app/main/projects-store';

function mkTmp(): string {
  return mkdtempSync(path.join(tmpdir(), 'morrow-projects-'));
}

describe('ProjectsStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkTmp();
  });

  it('load on missing file → empty list', async () => {
    const s = new ProjectsStore({ userDataDir: dir });
    await s.load();
    expect(s.list()).toEqual([]);
  });

  it('add → list 幂等（相同 path 去重、刷新 lastUsedAt）', async () => {
    const targetDir = mkTmp();
    const s = new ProjectsStore({ userDataDir: dir });
    await s.load();
    const a = await s.add(targetDir);
    const b = await s.add(targetDir);
    expect(a.id).toBe(b.id);
    expect(s.list()).toHaveLength(1);
    rmSync(targetDir, { recursive: true, force: true });
  });

  it('add 不存在路径 → 抛错', async () => {
    const s = new ProjectsStore({ userDataDir: dir });
    await s.load();
    await expect(s.add(path.join(dir, 'no-such'))).rejects.toBeTruthy();
  });

  it('remove → 列表更新并持久化', async () => {
    const targetDir = mkTmp();
    const s = new ProjectsStore({ userDataDir: dir });
    await s.load();
    const p = await s.add(targetDir);
    await s.remove(p.id);
    expect(s.list()).toEqual([]);
    const s2 = new ProjectsStore({ userDataDir: dir });
    await s2.load();
    expect(s2.list()).toEqual([]);
    rmSync(targetDir, { recursive: true, force: true });
  });

  it('损坏 JSON → 备份为 .bak-<ts> 并回退空', async () => {
    writeFileSync(path.join(dir, 'projects.json'), '{ not json');
    const s = new ProjectsStore({ userDataDir: dir });
    await s.load();
    expect(s.list()).toEqual([]);
    const files = readdirSync(dir);
    expect(files.some((f) => f.startsWith('projects.json.bak-'))).toBe(true);
  });

  it('getAccessiblePath：有效路径返回 path，失效路径返回 null 并标记 invalid', async () => {
    const targetDir = mkTmp();
    const s = new ProjectsStore({ userDataDir: dir });
    await s.load();
    const p = await s.add(targetDir);
    expect(await s.getAccessiblePath(p.id)).toBe(path.resolve(targetDir));
    rmSync(targetDir, { recursive: true, force: true });
    expect(await s.getAccessiblePath(p.id)).toBeNull();
    expect(s.list()[0]!.invalid).toBe(true);
  });

  it('持久化为 schema v1', async () => {
    const targetDir = mkTmp();
    const s = new ProjectsStore({ userDataDir: dir });
    await s.load();
    await s.add(targetDir);
    const raw = readFileSync(path.join(dir, 'projects.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version: number; projects: unknown[] };
    expect(parsed.version).toBe(1);
    expect(parsed.projects).toHaveLength(1);
    expect(existsSync(path.join(dir, 'projects.json'))).toBe(true);
    rmSync(targetDir, { recursive: true, force: true });
  });
});
