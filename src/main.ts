import { ensureConfigDir, loadConfig } from './core/config.js';
import { APP_NAME, APP_VERSION } from './constants.js';

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
    if (arg === '--help' || arg === '-h' || arg === 'help') {
      flags.command = 'help';
    } else if (arg === '--version' || arg === '-v' || arg === 'version') {
      flags.command = 'version';
    } else if (arg === '--input' || arg === '-i') {
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
    if (flags.command === 'help' || flags.command === 'version') {
      handleMetaCommand(flags.command);
      return;
    }
    console.error('Unknown command: ' + flags.command);
    console.error('Run without arguments for interactive mode.');
    process.exit(1);
  }

  if (!flags.input) {
    console.error('Error: --input flag is required');
    console.error('Usage: bun run ' + APP_NAME + ' <command> -i <input> [-o <output-dir>] [-t <threads>]');
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

function printHelp(): void {
  console.log(`${APP_NAME} v${APP_VERSION} - Media Utility Suite\n`);
  console.log('Usage:');
  console.log('  bunx tunex              Start interactive mode');
  console.log('  bunx tunex help        Show this help message');
  console.log('  bunx tunex version     Show version information');
  console.log('  bunx tunex config      Open configuration menu');
  console.log('  bunx tunex run <cmd>   Run a command directly\n');
  console.log('Commands:');
  console.log('  bulk-audio-extract     Extract audio from local video files');
  console.log('  yt-audio-only          Download YouTube audio as MP3');
  console.log('  yt-video-mp4           Download YouTube video as MP4\n');
  console.log('Options:');
  console.log('  -i, --input <path>     Input URL or local path');
  console.log('  -o, --output-dir <dir> Output directory');
  console.log('  -t, --threads <n>       Number of threads (max 4)');
  console.log('  --flatten              Flatten output directory structure');
  console.log('  --stop-on-error        Stop on first error');
  console.log('  --log-file <path>      Log file path');
  console.log('\nExamples:');
  console.log('  bunx tunex                                          # Interactive mode');
  console.log('  bunx tunex run bulk-audio-extract -i ./videos       # Direct command');
  console.log('  bunx tunex config                                    # Config menu');
}

function handleMetaCommand(command: string): void {
  if (command === 'help') {
    printHelp();
  } else if (command === 'version') {
    console.log(`${APP_NAME} v${APP_VERSION}`);
  }
}

ensureConfigDir();

const flags = parseCliFlags();

if (flags.command === 'help' || flags.command === 'version') {
  handleMetaCommand(flags.command);
} else if (flags.command === 'config') {
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
