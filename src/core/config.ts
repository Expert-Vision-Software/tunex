import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { parse } from 'dotenv';
import { APP_NAME } from '../constants.js';

interface Config {
  defaultThreads: number;
  defaultOutputDir: string;
  logFile: string | null;
}

const MAX_THREADS = 4;

export const DEFAULT_CONFIG: Config = {
  defaultThreads: 2,
  defaultOutputDir: '.',
  logFile: null,
};

export function getConfigPath(): string {
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), APP_NAME, 'config.json');
  }
  return join(homedir(), '.' + APP_NAME, 'config.json');
}

export function ensureConfigDir(): void {
  const dir = dirname(getConfigPath());
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(getConfigPath())) {
    saveConfigFile(DEFAULT_CONFIG);
  }
}

export function loadConfigFile(): Partial<Config> | null {
  const path = getConfigPath();
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch { }
  }
  
  return null;
}

export function saveConfigFile(config: Config): void {
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
    parseInt(envConfig.DEFAULT_THREADS ?? fileConfig.defaultThreads?.toString(), 10) || DEFAULT_CONFIG.defaultThreads,
    MAX_THREADS
  );

  return {
    defaultThreads,
    defaultOutputDir: envConfig.DEFAULT_OUTPUT_DIR ?? fileConfig.defaultOutputDir ?? DEFAULT_CONFIG.defaultOutputDir,
    logFile: envConfig.LOG_FILE ?? fileConfig.logFile ?? DEFAULT_CONFIG.logFile,
  };
}