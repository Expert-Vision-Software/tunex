import type { YtubeCommand, CommandOptions } from './types.js';
import { bulkAudioExtract } from './bulk-audio-extract.js';
import { ytAudioOnly } from './yt-audio-only.js';
import { ytVideoMp4 } from './yt-video-mp4.js';
import { loadConfig } from '../core/config.js';
import { getPlatformInfo } from '../core/platform.js';
import { isValidLocalPath, getPathPlaceholder } from '../core/paths.js';

export type { YtubeCommand, CommandOptions };

export const commands: YtubeCommand[] = [
  bulkAudioExtract,
  ytAudioOnly,
  ytVideoMp4,
];

export const localCommands: YtubeCommand[] = [
  bulkAudioExtract,
];

export const youtubeCommands: YtubeCommand[] = [
  ytAudioOnly,
  ytVideoMp4,
];

export function getCommand(name: string): YtubeCommand | undefined {
  return commands.find((c) => c.name === name);
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return hostname.includes('youtube.com') || hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

export function isLocalPath(path: string): boolean {
  if (isYouTubeUrl(path)) {
    return false;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return false;
  }
  return true;
}

export function isValidLocalPath(path: string): boolean {
  if (!isLocalPath(path)) {
    return false;
  }
  try {
    if (path.includes('/') || path.includes('\\')) {
      return true;
    }
    if (/^[a-zA-Z]:/.test(path)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function extractPlaylistId(url: string): string | undefined {
  try {
    if (!isYouTubeUrl(url)) {
      return undefined;
    }
    const parsed = new URL(url);
    const listParam = parsed.searchParams.get('list');
    if (listParam && parsed.searchParams.has('v')) {
      return listParam;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function mainMenu(): Promise<void> {
  const { select, confirm, group, text, isCancel } = await import('@clack/prompts');
  const config = loadConfig();
  const platform = getPlatformInfo();

  console.log('music-helper - Media Utility Suite\n');

  const inputValue = await text({
    message: 'Input URL or local path',
    placeholder: getPathPlaceholder(platform.platform),
  });

  if (isCancel(inputValue) || !inputValue) {
    console.log('Cancelled. Exiting.');
    return;
  }

  const isUrl = inputValue.startsWith('http://') || inputValue.startsWith('https://');
  let commandList: YtubeCommand[];
  let sourceLabel: string;

  if (isUrl) {
    if (!isYouTubeUrl(inputValue)) {
      console.log('Error: Only YouTube URLs are supported for this action.');
      return;
    }
    commandList = youtubeCommands;
    sourceLabel = 'YouTube';
  } else {
    if (!isValidLocalPath(inputValue, platform.platform)) {
      console.log('Error: Invalid local path format for your platform.');
      return;
    }
    commandList = localCommands;
    sourceLabel = 'Local';
  }

  const selected = await select({
    message: `Select a ${sourceLabel} command:`,
    options: commandList.map((cmd) => ({
      value: cmd.name,
      label: cmd.name,
      hint: cmd.description,
    })),
  });

  if (isCancel(selected) || !selected) {
    console.log('No command selected. Exiting.');
    return;
  }

  const command = getCommand(selected);
  if (!command) {
    console.log(`Command "${selected}" not found. Exiting.`);
    return;
  }

  const input = await group({
    outputDir: () => text({
      message: 'Output Directory',
      defaultValue: config.defaultOutputDir,
      placeholder: config.defaultOutputDir !== '.' ? `Optional, defaults to ${config.defaultOutputDir}` : 'Optional, defaults to .',
    }),
    threads: () => text({
      message: 'Threads',
      defaultValue: String(config.defaultThreads),
      placeholder: config.defaultThreads !== 2 ? `Optional, defaults to ${config.defaultThreads}` : 'Optional, defaults to 2',
    }),
  });

  const threads = parseInt(input.threads as string, 10) || config.defaultThreads;

  let inputUrl = inputValue;

  if (isUrl) {
    const playlistId = extractPlaylistId(inputUrl);
    if (playlistId) {
      const expandToPlaylist = await confirm({
        message: `URL belongs to a playlist. Would you like to process the entire playlist?`,
      });
      if (expandToPlaylist) {
        inputUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
      }
    }
  }

  const shouldRun = await confirm({
    message: `Run "${selected}" with these settings?`,
  });

  const opts: CommandOptions = {
    input: inputUrl,
    outputDir: input.outputDir,
    threads,
    continueOnError: true,
  };

  if (shouldRun) {
    await command.execute(opts);
  }

  printCLIRecommendation(selected, opts);
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