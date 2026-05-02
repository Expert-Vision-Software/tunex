import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dir, '../package.json'), 'utf-8'));

export const APP_NAME = pkg.name as string;
export const APP_VERSION = pkg.version as string;