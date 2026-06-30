import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type PackageJson = {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as PackageJson;
}

function parseVersionRange(range: string): [number, number, number] | null {
  const match = /^\^?(\d+)\.(\d+)\.(\d+)$/.exec(range);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

describe('package scripts', () => {
  it('repairs node-pty spawn-helper permissions before dev and build', () => {
    const scripts = readPackageJson().scripts ?? {};
    expect(scripts['predev']).toBe('node scripts/prepare-node-pty.mjs');
    expect(scripts['prebuild']).toBe('node scripts/prepare-node-pty.mjs');
    expect(scripts['predist']).toBe('node scripts/prepare-node-pty.mjs');
    expect(scripts['predist:mac']).toBe('node scripts/prepare-node-pty.mjs');
    expect(scripts['postinstall']?.startsWith('node scripts/prepare-node-pty.mjs')).toBe(true);
  });

  it('keeps Electron on the macOS 26 compatible runtime floor', () => {
    const electronRange = readPackageJson().devDependencies?.['electron'] ?? '';
    const parsed = parseVersionRange(electronRange);
    expect(parsed).not.toBeNull();
    const [major = 0, minor = 0, patch = 0] = parsed ?? [];
    expect(major > 36 || (major === 36 && (minor > 9 || (minor === 9 && patch >= 2)))).toBe(true);
  });
});
