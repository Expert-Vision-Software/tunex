import { executeDocker } from '../core/executor';
import type { YtubeCommand, CommandOptions } from './types';

export const ytVideoMp4: YtubeCommand = {
  name: 'yt-video-mp4',
  description: 'Download YouTube video/playlist as mid-quality MP4',
  async execute(opts: CommandOptions): Promise<void> {
    const input = Array.isArray(opts.input) ? opts.input : [opts.input];
    const outputDir = opts.outputDir || '.';
    const continueFlag = opts.continueOnError ? '--continue --no-abort-on-error' : '';

    for (const url of input) {
      const volumeMount = `${process.cwd().replace(/\\/g, '/')}:/downloads`;
      const args = [
        '-f', 'bestaudio[ext=m4a]+worstvideo[height>=720]/bestaudio+bestvideo',
        '--merge-output-format', 'mp4',
        '--no-playlist',
        continueFlag,
        '-o', `${outputDir}/%(uploader)s - %(title)s.%(ext)s`,
        url
      ].filter(Boolean);

      await executeDocker(volumeMount, args);
    }
  }
};