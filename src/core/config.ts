interface Config {
  defaultThreads: number;
  defaultOutputDir: string;
  logFile: string | null;
}

const MAX_THREADS = 4;

function parseEnvFile(envPath: string): Record<string, string> {
  const result: Record<string, string> = {};
  let content: string | null;
  try {
    content = Bun.readFile(envPath);
  } catch {
    return result;
  }
  if (!content) {
    return result;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}

export function loadConfig(configPath?: string): Config {
  const envPath = configPath ?? '.env';
  const envVars = parseEnvFile(envPath);

  const defaultThreads = Math.min(
    parseInt(envVars.DEFAULT_THREADS ?? '4', 10) || 4,
    MAX_THREADS
  );

  return {
    defaultThreads,
    defaultOutputDir: envVars.DEFAULT_OUTPUT_DIR ?? '.',
    logFile: envVars.LOG_FILE || null,
  };
}