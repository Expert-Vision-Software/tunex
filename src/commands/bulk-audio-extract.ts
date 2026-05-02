import { executeDocker } from '../core/executor';
import type { YtubeCommand, CommandOptions } from './types';

export const bulkAudioExtract: YtubeCommand = {
  name: 'bulk-audio-extract',
  description: 'Convert local video files to audio-only MP3',
  async execute(opts: CommandOptions): Promise<void> {
    const input = Array.isArray(opts.input) ? opts.input : [opts.input];
    const outputDir = opts.outputDir || '.';
    const continueFlag = opts.continueOnError ? '--continue --no-abort-on-error' : '';

    for (const folder of input) {
      const volumeMount = `${process.cwd().replace(/\\/g, '/')}:/downloads`;
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '128k',
        '--no-playlist',
        continueFlag,
        '-o', `${outputDir}/%(title)s.%(ext)s`,
        `/downloads/${folder}/`
      ].filter(Boolean);

      await executeDocker(volumeMount, args);
    }
  }
};