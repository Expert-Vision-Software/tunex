#!/usr/bin/env bun
/**
 * Build a standalone `tunex` binary.
 *
 * Why this wrapper exists:
 *   `src/constants.ts` reads APP_NAME / APP_VERSION from package.json, but in
 *   a `bun build --compile` binary the file no longer lives next to the
 *   entry — `import.meta.url` resolves to `/$bunfs/...` and the fs read
 *   crashes with ENOENT on every command.
 *
 *   The fix is to bake the values at compile time via `--define`. This
 *   script reads package.json once and invokes `bun build --compile` with
 *   the appropriate flags, so source-of-truth stays package.json.
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { platform } from 'os';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  name: string;
  version: string;
};

const bunTarget =
  platform() === 'win32' ? 'bun-windows' : platform() === 'darwin' ? 'bun-macos' : 'bun-linux';

console.log(`[build] package: ${pkg.name}@${pkg.version}`);
console.log(`[build] target: ${bunTarget}`);

const result = spawnSync(
  'bun',
  [
    'build',
    '--compile',
    `--target=${bunTarget}`,
    '--define',
    `process.env.TUNEX_NAME=${JSON.stringify(pkg.name)}`,
    '--define',
    `process.env.TUNEX_VERSION=${JSON.stringify(pkg.version)}`,
    './src/main.ts',
    '--outfile=dist/tunex.exe',
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error('[build] failed to spawn bun:', result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
