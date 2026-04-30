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
  const { select, confirm, group } = await import('@clack/prompts');

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
    input: { type: 'text', label: 'Input URL(s)' },
    outputDir: { type: 'text', label: 'Output Directory', initial: './output' },
    threads: { type: 'number', label: 'Threads', initial: 4 },
  });

  const shouldRun = await confirm({
    message: `Run "${selected}" with these settings?`,
  });

  if (shouldRun) {
    const opts: CommandOptions = {
      input: input.input,
      outputDir: input.outputDir,
      threads: input.threads,
    };

    await command.execute(opts);
  }
}