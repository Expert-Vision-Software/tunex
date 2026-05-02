import { select, text, confirm, isCancel } from '@clack/prompts';
import { loadConfig, saveConfigFile, DEFAULT_CONFIG, loadConfigFile } from '../core/config.js';
import { parse } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import type { Config } from '../core/config.js';

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

export async function configMenu(): Promise<void> {
  console.log('\nmusic-helper - Config Management\n');

  let config = loadConfig();
  let edited = false;

  const action = await select({
    message: 'Select config action:',
    options: [
      { value: 'view', label: 'View Current Config' },
      { value: 'resolved', label: 'View Resolved Config' },
      { value: 'set-defaultOutputDir', label: 'Set Default Output Directory' },
      { value: 'set-defaultThreads', label: 'Set Default Threads' },
      { value: 'set-logFile', label: 'Set Log File Path' },
      { value: 'reset', label: 'Reset to Defaults' },
      { value: 'exit', label: 'Exit' },
    ],
  });

  if (isCancel(action) || action === 'exit') {
    console.log('Exiting config menu.');
    return;
  }

  switch (action) {
    case 'view':
      console.log('\nCurrent Config:');
      console.log(`  defaultOutputDir: ${config.defaultOutputDir}`);
      console.log(`  defaultThreads: ${config.defaultThreads}`);
      console.log(`  logFile: ${config.logFile ?? '(none)'}`);
      break;

    case 'resolved': {
      const fileConfig = loadConfigFile() || {};
      const envConfig = loadEnvFiles();
      console.log('\nResolved Config (with override precedence):');
      console.log('');
      console.log('  Sources (highest to lowest precedence):');
      console.log('    1. CLI flags (passed at runtime)');
      console.log('    2. Environment variables (.env.local > .env)');
      console.log('    3. Config file (~/.music-helper/config.json)');
      console.log('    4. Factory defaults (DEFAULT_CONFIG)');
      console.log('');
      console.log('  Current Values:');
      console.log(`    defaultOutputDir: ${config.defaultOutputDir}`);
      if (envConfig.DEFAULT_OUTPUT_DIR) {
        console.log(`      └── overridden by env: DEFAULT_OUTPUT_DIR="${envConfig.DEFAULT_OUTPUT_DIR}"`);
      }
      console.log(`    defaultThreads: ${config.defaultThreads}`);
      if (envConfig.DEFAULT_THREADS) {
        console.log(`      └── overridden by env: DEFAULT_THREADS="${envConfig.DEFAULT_THREADS}"`);
      }
      console.log(`    logFile: ${config.logFile ?? '(none)'}`);
      if (envConfig.LOG_FILE) {
        console.log(`      └── overridden by env: LOG_FILE="${envConfig.LOG_FILE}"`);
      }
      console.log('');
      console.log('  Config File Contents:');
      console.log(`    ${JSON.stringify(fileConfig, null, 2).replace(/\n/g, '\n    ')}`);
      console.log('');
      console.log('  Factory Defaults (DEFAULT_CONFIG):');
      console.log(`    defaultThreads: ${DEFAULT_CONFIG.defaultThreads}`);
      console.log(`    defaultOutputDir: ${DEFAULT_CONFIG.defaultOutputDir}`);
      console.log(`    logFile: ${DEFAULT_CONFIG.logFile ?? '(none)'}`);
      break;
    }

    case 'set-defaultOutputDir': {
      const newValue = await text({
        message: 'Enter default output directory:',
        defaultValue: config.defaultOutputDir,
      });
      if (!isCancel(newValue) && newValue) {
        config.defaultOutputDir = newValue;
        edited = true;
        console.log(`Updated defaultOutputDir to: ${newValue}`);
      }
      break;
    }

    case 'set-defaultThreads': {
      const newValue = await text({
        message: 'Enter default thread count (1-4):',
        defaultValue: String(config.defaultThreads),
      });
      if (!isCancel(newValue) && newValue) {
        const threads = Math.min(Math.max(parseInt(newValue, 10) || 2, 1), 4);
        config.defaultThreads = threads;
        edited = true;
        console.log(`Updated defaultThreads to: ${threads}`);
      }
      break;
    }

    case 'set-logFile': {
      const newValue = await text({
        message: 'Enter log file path (leave empty to disable):',
        defaultValue: config.logFile ?? '',
      });
      if (!isCancel(newValue)) {
        config.logFile = newValue || null;
        edited = true;
        console.log(`Updated logFile to: ${newValue || '(none)'}`);
      }
      break;
    }

    case 'reset':
      config = { ...DEFAULT_CONFIG };
      edited = true;
      console.log('Config reset to defaults.');
      break;
  }

  if (edited) {
    const save = await confirm({
      message: 'Save changes to config file?',
    });
    if (!isCancel(save) && save) {
      saveConfigFile(config);
      console.log('Config saved.');
    } else {
      console.log('Changes not saved.');
    }
  }
}