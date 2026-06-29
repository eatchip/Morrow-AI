import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Project } from '../../shared/ipc';

/**
 * Project 持久化层。
 *  - 文件：<userData>/projects.json
 *  - 原子写：写入 tmp → rename
 *  - 损坏兜底：读失败 → 备份为 projects.json.bak-<ts> 并返回空数组
 *  - renderer 永远不接触 path；只以 id 为入参通过 getProjectPath 反查
 */

interface Schema {
  version: 1;
  projects: Project[];
}

interface Deps {
  /** 注入点用于测试；生产由 ipc 层传入 app.getPath('userData') */
  userDataDir: string;
}

const SCHEMA_VERSION = 1 as const;

function filename(dir: string): string {
  return path.join(dir, 'projects.json');
}

function isSchema(x: unknown): x is Schema {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (o['version'] !== SCHEMA_VERSION) return false;
  if (!Array.isArray(o['projects'])) return false;
  return o['projects'].every(
    (p) =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as Project).id === 'string' &&
      typeof (p as Project).name === 'string' &&
      typeof (p as Project).path === 'string' &&
      typeof (p as Project).createdAt === 'number' &&
      typeof (p as Project).lastUsedAt === 'number',
  );
}

export class ProjectsStore {
  private projects: Project[] = [];
  private loaded = false;

  constructor(private readonly deps: Deps) {}

  async load(): Promise<void> {
    const file = filename(this.deps.userDataDir);
    try {
      const raw = await readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!isSchema(parsed)) throw new Error('schema mismatch');
      this.projects = parsed.projects;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        this.projects = [];
      } else {
        // 损坏：备份并重置
        const bak = `${file}.bak-${Date.now()}`;
        try {
          await rename(file, bak);
        } catch {
          /* 无法备份也不阻塞启动 */
        }
        this.projects = [];
      }
    }
    this.loaded = true;
  }

  list(): Project[] {
    this.assertLoaded();
    // 不可变副本
    return this.projects.map((p) => ({ ...p }));
  }

  async add(rawPath: string): Promise<Project> {
    this.assertLoaded();
    const normalized = path.resolve(rawPath);
    await access(normalized, fsConstants.R_OK);
    // 去重：相同绝对路径视为同一项目，更新 lastUsedAt 后返回
    const existing = this.projects.find((p) => p.path === normalized);
    if (existing) {
      existing.lastUsedAt = Date.now();
      existing.invalid = false;
      await this.persist();
      return { ...existing };
    }
    const now = Date.now();
    const project: Project = {
      id: `p-${randomUUID()}`,
      name: path.basename(normalized) || normalized,
      path: normalized,
      createdAt: now,
      lastUsedAt: now,
    };
    this.projects.push(project);
    await this.persist();
    return { ...project };
  }

  async remove(id: string): Promise<void> {
    this.assertLoaded();
    const before = this.projects.length;
    this.projects = this.projects.filter((p) => p.id !== id);
    if (this.projects.length !== before) {
      await this.persist();
    }
  }

  /**
   * 供 sendPrompt 用：根据 id 解析绝对路径并校验可访问。
   * 不可用时回标 invalid=true，返回 null。
   */
  async getAccessiblePath(id: string): Promise<string | null> {
    this.assertLoaded();
    const p = this.projects.find((x) => x.id === id);
    if (!p) return null;
    try {
      await access(p.path, fsConstants.R_OK);
      if (p.invalid) {
        p.invalid = false;
        await this.persist();
      }
      p.lastUsedAt = Date.now();
      return p.path;
    } catch {
      if (!p.invalid) {
        p.invalid = true;
        await this.persist();
      }
      return null;
    }
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error('ProjectsStore.load() must be called first');
  }

  private async persist(): Promise<void> {
    const file = filename(this.deps.userDataDir);
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    const body = JSON.stringify(
      { version: SCHEMA_VERSION, projects: this.projects } satisfies Schema,
      null,
      2,
    );
    await mkdir(this.deps.userDataDir, { recursive: true });
    await writeFile(tmp, body, 'utf8');
    await rename(tmp, file);
  }
}
