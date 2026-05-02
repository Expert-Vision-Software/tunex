import { executeDocker } from '../core/executor';
import { sanitizeFilename } from '../utils/sanitize';
import { readdirSync, renameSync } from 'bun';
import type { YtubeCommand, CommandOptions } from './types';
import { getWorkingDirForDocker, buildVolumeMount } from '../core/paths';

export const ytVideoMp4: YtubeCommand = {
  name: 'yt-video-mp4',
  description: 'Download YouTube video/playlist as mid-quality MP4',
  async execute(opts: CommandOptions): Promise<void> {
    const input = Array.isArray(opts.input) ? opts.input : [opts.input];
    const outputDir = opts.outputDir || '.';
    const continueFlag = opts.continueOnError ? ['--continue', '--no-abort-on-error'] : [];
    const workingDir = getWorkingDirForDocker();

    for (const url of input) {
      const volumeMount = buildVolumeMount(workingDir);
      const args = [
        '-f', 'bestaudio[ext=m4a]+worstvideo[height>=720]/bestaudio+bestvideo',
        '--merge-output-format', 'mp4',
        '--restrict-filenames',
        '--no-playlist',
        ...continueFlag,
        '-o', `${outputDir}/%(uploader)s - %(title)s.%(ext)s`,
        url
      ].filter(Boolean);

      await executeDocker(volumeMount, args);
    }

    sanitizeDownloadedFiles(outputDir);
  }
};

function sanitizeDownloadedFiles(outputDir: string): void {
  const WINDOWS_RESERVED_CHARS = /[\/\\:*?"<>|]/g;
  let count = 0;
  try {
    const files = readdirSync(outputDir);
    for (const file of files) {
      if (!file.includes('/') && !file.includes('\\') && !file.includes(':') &&
          !file.includes('*') && !file.includes('?') && !file.includes('"') &&
          !file.includes('<') && !file.includes('>') && !file.includes('|')) {
        continue;
      }
      const sanitized = sanitizeFilename(file);
      if (sanitized !== file) {
        renameSync(`${outputDir}/${file}`, `${outputDir}/${sanitized}`);
        count++;
      }
    }
    if (count > 0) {
      console.log(`[INFO] Sanitized ${count} file(s) for Windows compatibility`);
    }
  } catch {
    // Directory empty or doesn't exist - nothing to sanitize
  }
}