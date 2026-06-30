import { chmod, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

async function chmodIfPresent(file) {
  try {
    const info = await stat(file);
    if (!info.isFile()) return;
    if ((info.mode & 0o111) !== 0) return;
    await chmod(file, info.mode | 0o111);
    console.log(`[prepare-node-pty] chmod +x ${file}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (process.platform !== 'win32') {
  const packagePath = require.resolve('node-pty/package.json');
  const root = dirname(packagePath);
  await chmodIfPresent(
    join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
  );
  await chmodIfPresent(join(root, 'build', 'Release', 'spawn-helper'));
}
