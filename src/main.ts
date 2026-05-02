interface CliFlags {
  input?: string;
  outputDir?: string;
  threads?: number;
  flatten?: boolean;
  stopOnError?: boolean;
  logFile?: string;
  command?: string;
}

function parseCliFlags(): CliFlags {
  const args = Bun.argv.slice(2);
  const flags: CliFlags = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' || arg === '-i') {
      flags.input = args[++i];
    } else if (arg === '--output-dir' || arg === '-o') {
      flags.outputDir = args[++i];
} else if (arg === '--threads' || arg === '-t') {
      flags.threads = parseInt(args[++i], 10);
    } else if (arg === '--flatten') {
      flags.flatten = true;
    } else if (arg === '--stop-on-error') {
      flags.stopOnError = true;
    } else if (arg === '--log-file') {
      flags.logFile = args[++i];
    } else if (!arg.startsWith('-')) {
      flags.command = arg;
    }
  }
  
  return flags;
}

async function runInteractive() {
  const { mainMenu } = await import('./commands/index.js');
  await mainMenu();
}

async function runDirect(flags: CliFlags) {
  const { getCommand, printCLIRecommendation } = await import('./commands/index.js');
  const { loadConfig } = await import('./core/config.js');
  const { createLogger } = await import('./utils/logger.js');

  const config = loadConfig();

  const command = getCommand(flags.command!);
  if (!command) {
    console.error('Unknown command: ' + flags.command);
    console.error('Run without arguments for interactive mode.');
    process.exit(1);
  }

  if (!flags.input) {
    console.error('Error: --input flag is required');
    console.error('Usage: bun run ytube-utils <command> -i <input> [-o <output-dir>] [-t <threads>]');
    process.exit(1);
  }

  const logger = createLogger({ logFile: flags.logFile ?? config.logFile });

  const opts = {
    input: flags.input,
    outputDir: flags.outputDir ?? config.defaultOutputDir,
    threads: Math.min(flags.threads ?? config.defaultThreads, 4),
    continueOnError: !flags.stopOnError,
    flatten: flags.flatten,
  };

  let success = true;
  try {
    logger.info('Executing command: ' + command.name);
    logger.info('Input: ' + opts.input);
    logger.info('Output dir: ' + opts.outputDir);
    logger.info('Threads: ' + opts.threads);
    await command.execute(opts);
    logger.info('Command completed successfully.');
  } catch (err) {
    success = false;
    logger.error('Command failed: ' + (err instanceof Error ? err.message : String(err)));
    console.error('Command failed. Check logs for details.');
    process.exit(1);
  }

  if (success) {
    logger.info('=== Summary ===');
    logger.info('All tasks completed.');
    printCLIRecommendation(command.name, opts);
  }
}

const flags = parseCliFlags();

if (flags.command) {
  runDirect(flags);
} else {
  runInteractive();
}
