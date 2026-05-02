import { ensureConfigDir, loadConfig } from './core/config.js';

interface CliFlags {
  input?: string;
  outputDir?: string;
  threads?: number;
  flatten?: boolean;
  stopOnError?: boolean;
  logFile?: string;
  command?: string;
  subcommand?: string;
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
    } else if (arg === 'run' || arg === 'start' || arg === 'config') {
      flags.command = arg;
    } else if (!arg.startsWith('-') && !flags.command) {
      flags.command = arg;
    } else if (!arg.startsWith('-') && flags.command === 'run') {
      flags.subcommand = arg;
    }
  }
  
  return flags;
}

async function runInteractive() {
  const { mainMenu } = await import('./commands/index.js');
  const { getPlatformInfo } = await import('./core/platform.js');
  const { createLogger } = await import('./utils/logger.js');

  const config = loadConfig();
  const platform = getPlatformInfo();
  const logger = createLogger({ logFile: config.logFile });
  logger.info('Platform: ' + platform.platform + ' | Shell: ' + platform.shell + ' | Docker: ' + (platform.hasDocker ? 'available' : 'not found'));

  await mainMenu();
}

async function runDirect(flags: CliFlags) {
  const { getCommand, printCLIRecommendation } = await import('./commands/index.js');
  const { loadConfig } = await import('./core/config.js');
  const { createLogger } = await import('./utils/logger.js');
  const { getPlatformInfo } = await import('./core/platform.js');

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

  const platform = getPlatformInfo();
  logger.info('Platform: ' + platform.platform + ' | Shell: ' + platform.shell + ' | Docker: ' + (platform.hasDocker ? 'available' : 'not found'));
  if (platform.isWSL) {
    logger.info('WSL detected with Docker context: ' + platform.dockerContext);
  }

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

ensureConfigDir();

const flags = parseCliFlags();

if (flags.command === 'config') {
  runConfig();
} else if (flags.command === 'run' && flags.subcommand) {
  runDirect({ ...flags, command: flags.subcommand });
} else if (flags.command === 'start' || flags.command === 'run') {
  runInteractive();
} else if (flags.command) {
  runDirect(flags);
} else {
  runInteractive();
}

async function runConfig() {
  const { configMenu } = await import('./commands/config-menu.js');
  await configMenu();
}
