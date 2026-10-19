import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { APP_NAME, APP_VERSION } from './constants';

/**
 * These tests guard against the standalone-binary regression described in
 * https://github.com/Expert-Vision-Software/tunex/issues/12.
 *
 * Before the fix, `src/constants.ts` always read package.json from disk via
 * `import.meta.url + '../package.json'`. Inside `bun build --compile` the
 * `import.meta.url` resolves into `/$bunfs/...` and the fs read crashes with
 * ENOENT on every command.
 *
 * The fix bakes APP_NAME / APP_VERSION at build time via `--define`. From
 * source (`bun run src/main.ts`) the fs fallback path is used and must stay
 * in sync with package.json — these tests assert that.
 */
describe('src/constants.ts', () => {
  const pkg = JSON.parse(readFileSync(resolve(import.meta.dir, '../package.json'), 'utf-8')) as {
    name: string;
    version: string;
  };

  test('APP_NAME matches package.json name', () => {
    expect(APP_NAME).toBe(pkg.name);
  });

  test('APP_VERSION matches package.json version', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  test('APP_NAME is the tunex-cli string', () => {
    // Guard against accidental refactors that change the binary name.
    expect(APP_NAME).toBe('tunex-cli');
  });

  test('APP_VERSION is a semver-shaped string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
