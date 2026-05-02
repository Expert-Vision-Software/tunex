import { executeDocker } from '../core/executor.js';
import { sanitizeFilename } from '../utils/sanitize.js';
import { renameSync } from 'bun';
import { readdirSync as fsReaddir } from 'fs';
import type { YtubeCommand, CommandOptions } from './types.js';
import { getWorkingDirForDocker, buildVolumeMount } from '../core/paths.js';
import { DEFAULT_CONFIG } from '../core/config.js';

export const ytAudioOnly: YtubeCommand = {
  name: 'yt-audio-only',
  description: 'Download YouTube video/playlist as audio-only MP3',
  async execute(opts: CommandOptions): Promise<void> {
    const input = Array.isArray(opts.input) ? opts.input : [opts.input];
    const outputDir = opts.outputDir || DEFAULT_CONFIG.defaultOutputDir;
    const continueFlag = opts.continueOnError ? ['--continue', '--no-abort-on-error'] : [];
    const workingDir = getWorkingDirForDocker();

    for (const url of input) {
      const volumeMount = buildVolumeMount(workingDir);
      const args = [
        '-f', 'bestaudio',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
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
  let count = 0;
  try {
    const files = fsReaddir(outputDir);
    for (const file of files) {
      const needsSanitize = file.includes('/') || file.includes('\\') || file.includes(':') ||
        file.includes('*') || file.includes('?') || file.includes('"') ||
        file.includes('<') || file.includes('>') || file.includes('|') ||
        /[^\x00-\x7F]/.test(file);
      if (!needsSanitize) {
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