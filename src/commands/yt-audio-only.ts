import { executeDocker } from '../core/executor';
import type { YtubeCommand, CommandOptions } from './types';

export const ytAudioOnly: YtubeCommand = {
  name: 'yt-audio-only',
  description: 'Download YouTube video/playlist as audio-only MP3',
  async execute(opts: CommandOptions): Promise<void> {
    const input = Array.isArray(opts.input) ? opts.input : [opts.input];
    const outputDir = opts.outputDir || '.';
    const continueFlag = opts.continueOnError ? '--continue --no-abort-on-error' : '';

    for (const url of input) {
      const volumeMount = `${process.cwd().replace(/\\/g, '/')}:/downloads`;
      const args = [
        '-f', 'bestaudio',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '128k',
        '--no-playlist-automerge',
        continueFlag,
        '-o', `${outputDir}/%(uploader)s - %(title)s.%(ext)s`,
        url
      ].filter(Boolean);

      await executeDocker(volumeMount, args);
    }
  }
};