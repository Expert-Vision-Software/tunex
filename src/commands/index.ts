import type { YtubeCommand, CommandOptions } from './types.js';
import { bulkAudioExtract } from './bulk-audio-extract.js';
import { ytAudioOnly } from './yt-audio-only.js';
import { ytVideoMp4 } from './yt-video-mp4.js';

export type { YtubeCommand, CommandOptions };

export const commands: YtubeCommand[] = [
  bulkAudioExtract,
  ytAudioOnly,
  ytVideoMp4,
];

export function getCommand(name: string): YtubeCommand | undefined {
  return commands.find((c) => c.name === name);
}

export async function mainMenu(): Promise<void> {
  const { select, confirm, group, text } = await import('@clack/prompts');

  console.log('music-helper - Media Utility Suite\n');

  const selected = await select({
    message: 'Select a command:',
    options: commands.map((cmd) => ({
      value: cmd.name,
      label: cmd.name,
      hint: cmd.description,
    })),
  });

  if (!selected) {
    console.log('No command selected. Exiting.');
    return;
  }

  const command = getCommand(selected);
  if (!command) {
    console.log(`Command "${selected}" not found. Exiting.`);
    return;
  }

  const input = await group({
    input: () => text({ message: 'Input URL(s)' }),
    outputDir: () => text({ message: 'Output Directory', defaultValue: './output', placeholder: 'Optional, defaults to ./output' }),
    threads: () => text({ message: 'Threads', defaultValue: '4', placeholder: 'Optional, defaults to 4' }),
  });

  const threads = parseInt(input.threads as string, 10) || 4;

  const shouldRun = await confirm({
    message: `Run "${selected}" with these settings?`,
  });

  if (shouldRun) {
    const opts: CommandOptions = {
      input: input.input,
      outputDir: input.outputDir,
      threads,
    };

    await command.execute(opts);
    printCLIRecommendation(selected, opts);
  }
}

export function printCLIRecommendation(commandName: string, opts: CommandOptions): void {
  const flags: string[] = ['-i', `"${opts.input}"`];
  if (opts.outputDir) {
    flags.push('-o', `"${opts.outputDir}"`);
  }
  if (opts.threads && opts.threads !== 4) {
    flags.push('-t', String(opts.threads));
  }
  const cmd = `bun run src/main.ts ${commandName} ${flags.join(' ')}`;
  console.log('\n[INFO] Re-run this command non-interactively:');
  console.log('     ' + cmd);
}