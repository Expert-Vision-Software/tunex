import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * APP_NAME and APP_VERSION are read from package.json so they stay in sync
 * with the published version, but the fs read fails inside a compiled
 * `bun build --compile` binary: there `import.meta.url` resolves to bun's
 * virtual filesystem (`/$bunfs/root/tunex.exe`) where package.json is not
 * bundled.
 *
 * The build script (`scripts/build.ts`) solves this by passing
 * `process.env.TUNEX_NAME` / `process.env.TUNEX_VERSION` as `--define` flags,
 * which inline the values at compile time. The fs read below only runs when
 * the env vars are unset — i.e. when executing from source via `bun run`.
 */
let APP_NAME: string;
let APP_VERSION: string;

const envName = process.env.TUNEX_NAME;
const envVersion = process.env.TUNEX_VERSION;

if (envName !== undefined && envVersion !== undefined) {
  APP_NAME = envName;
  APP_VERSION = envVersion;
} else {
  const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(
      `tunex: cannot read APP_NAME/APP_VERSION — package.json not found at ` +
        `${pkgPath} and TUNEX_NAME/TUNEX_VERSION env vars are not set. ` +
        `Run via \`bun run\` (dev) or rebuild with \`bun run build\` (release).`,
    );
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name: string; version: string };
  APP_NAME = pkg.name;
  APP_VERSION = pkg.version;
}

export { APP_NAME, APP_VERSION };

/**
 * The Docker image used to run yt-dlp. The publisher (jauderho) rebuilds the
 * `:latest` tag within an hour of every yt-dlp upstream release and at least
 * once a week, so a dynamic pull before each run keeps the bundled yt-dlp
 * version current and avoids the "older than 90 days" warning.
 */
export const YT_DLP_DOCKER_IMAGE = 'jauderho/yt-dlp:latest';
