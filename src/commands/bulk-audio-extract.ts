import { executeDocker } from '../core/executor.js';
import { sanitizeFilename } from '../utils/sanitize.js';
import { renameSync } from 'bun';
import { readdirSync as fsReaddir } from 'fs';
import type { YtubeCommand, CommandOptions } from './types.js';
import { getWorkingDirForDocker, buildVolumeMount } from '../core/paths.js';
import { DEFAULT_CONFIG } from '../core/config.js';

export const bulkAudioExtract: YtubeCommand = {
  name: 'bulk-audio-extract',
  description: 'Convert local video files to audio-only MP3',
  async execute(opts: CommandOptions): Promise<void> {
    const input = Array.isArray(opts.input) ? opts.input : [opts.input];
    const outputDir = opts.outputDir || DEFAULT_CONFIG.defaultOutputDir;
    const continueFlag = opts.continueOnError ? ['--continue', '--no-abort-on-error'] : [];
    const workingDir = getWorkingDirForDocker();

    for (const folder of input) {
      const normalizedFolder = folder.replace(/^\.\//, '').replace(/\\/g, '/');
      const normalizedOutput = outputDir.replace(/^\.\//, '').replace(/\\/g, '/');

      const folderPath = `${workingDir}/${normalizedFolder}`;
      let videoFiles: string[];

      try {
        const entries = fsReaddir(folderPath);
        videoFiles = entries.filter(file => {
          const ext = file.toLowerCase().split('.').pop();
          return ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv'].includes(ext || '');
        });
      } catch (err) {
        console.log(`[INFO] Error reading ${folderPath}: ${err}`);
        continue;
      }

      if (videoFiles.length === 0) {
        console.log(`[INFO] No video files found in ${folderPath}`);
        continue;
      }

      const volumeMount = `${workingDir}:/downloads`;
      const inputPaths = videoFiles.map(f => `file:///downloads/${normalizedFolder}/${encodeURIComponent(f)}`);

      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--restrict-filenames',
        '--no-playlist',
        '--enable-file-urls',
        ...continueFlag,
        '-o', '/downloads/output/%(title)s.%(ext)s',
        ...inputPaths
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