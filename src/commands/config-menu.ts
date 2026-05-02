import { select, text, confirm, isCancel } from '@clack/prompts';
import { loadConfig, saveConfigFile } from '../core/config.js';
import type { Config } from '../core/config.js';

export async function configMenu(): Promise<void> {
  console.log('\nmusic-helper - Config Management\n');

  let config = loadConfig();
  let edited = false;

  const action = await select({
    message: 'Select config action:',
    options: [
      { value: 'view', label: 'View Current Config' },
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
      config = { defaultThreads: 2, defaultOutputDir: '.', logFile: null };
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