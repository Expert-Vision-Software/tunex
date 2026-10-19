import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dir, '../package.json'), 'utf-8'));

export const APP_NAME = pkg.name as string;
export const APP_VERSION = pkg.version as string;

/**
 * The Docker image used to run yt-dlp. The publisher (jauderho) rebuilds the
 * `:latest` tag within an hour of every yt-dlp upstream release and at least
 * once a week, so a dynamic pull before each run keeps the bundled yt-dlp
 * version current and avoids the "older than 90 days" warning.
 */
export const YT_DLP_DOCKER_IMAGE = 'jauderho/yt-dlp:latest';