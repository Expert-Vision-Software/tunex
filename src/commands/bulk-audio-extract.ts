import { executeDocker } from '../core/executor';
import { sanitizeFilename } from '../utils/sanitize';
import { readdirSync, renameSync } from 'bun';
import type { YtubeCommand, CommandOptions } from './types';

export const bulkAudioExtract: YtubeCommand = {
  name: 'bulk-audio-extract',
  description: 'Convert local video files to audio-only MP3',
  async execute(opts: CommandOptions): Promise<void> {
    const input = Array.isArray(opts.input) ? opts.input : [opts.input];
    const outputDir = opts.outputDir || '.';
    const continueFlag = opts.continueOnError ? ['--continue', '--no-abort-on-error'] : [];

    for (const folder of input) {
      const volumeMount = `${process.cwd().replace(/\\/g, '/')}:/downloads`;
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--no-playlist',
        ...continueFlag,
        '-o', `${outputDir}/%(title)s.%(ext)s`,
        `/downloads/${folder}/`
      ].filter(Boolean);

      await executeDocker(volumeMount, args);
    }

    sanitizeDownloadedFiles(outputDir);
  }
};

function sanitizeDownloadedFiles(outputDir: string): void {
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