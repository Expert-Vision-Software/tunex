interface Config {
  defaultThreads: number;
  defaultOutputDir: string;
  logFile: string | null;
}

const MAX_THREADS = 4;

export function loadConfig(): Config {
  const defaultThreads = Math.min(
    parseInt(Bun.env.DEFAULT_THREADS ?? '2', 10) || 2,
    MAX_THREADS
  );

  return {
    defaultThreads,
    defaultOutputDir: Bun.env.DEFAULT_OUTPUT_DIR ?? '.',
    logFile: Bun.env.LOG_FILE || null,
  };
}