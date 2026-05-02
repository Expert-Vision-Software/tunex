import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { parse } from 'dotenv';

interface Config {
  defaultThreads: number;
  defaultOutputDir: string;
  logFile: string | null;
}

const MAX_THREADS = 4;

function getAppName(): string {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
  return pkg.name;
}

function getConfigPath(): string {
  const appName = getAppName();
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), appName, 'config.json');
  }
  return join(homedir(), '.' + appName, 'config.json');
}

function ensureConfigDir(): void {
  const dir = dirname(getConfigPath());
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadConfigFile(): Partial<Config> | null {
  const path = getConfigPath();
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch { }
  }
  return null;
}

export function saveConfigFile(config: Config): void {
  ensureConfigDir();
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

function loadEnvFiles(): Record<string, string> {
  const result: Record<string, string> = {};
  if (existsSync('.env')) {
    const parsed = parse(readFileSync('.env', 'utf-8'));
    Object.assign(result, parsed);
  }
  if (existsSync('.env.local')) {
    const parsed = parse(readFileSync('.env.local', 'utf-8'));
    Object.assign(result, parsed);
  }
  return result;
}

export function loadConfig(): Config {
  const fileConfig = loadConfigFile() || {};
  const envConfig = loadEnvFiles();

  const defaultThreads = Math.min(
    parseInt(envConfig.DEFAULT_THREADS ?? fileConfig.defaultThreads?.toString() ?? '2', 10) || 2,
    MAX_THREADS
  );

  return {
    defaultThreads,
    defaultOutputDir: envConfig.DEFAULT_OUTPUT_DIR ?? fileConfig.defaultOutputDir ?? '.',
    logFile: envConfig.LOG_FILE ?? fileConfig.logFile ?? null,
  };
}