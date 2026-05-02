import { readdirSync, renameSync } from 'bun';
import { sanitizeFilename, sanitizeOutputPath } from './sanitize';

const WINDOWS_RESERVED_CHARS = /[\/\\:*?"<>|]/g;

export function sanitizeExistingFiles(outputDir: string): void {
  const sanitized: string[] = [];
  const files = readdirSync(outputDir, { recursive: true });

  for (const file of files) {
    if (typeof file !== 'string') continue;
    const fullPath = `${outputDir}/${file}`;
    const sanitizedName = sanitizeFilename(file);
    if (sanitizedName !== file) {
      const sanitizedPath = `${outputDir}/${sanitizedName}`;
      renameSync(fullPath, sanitizedPath);
      sanitized.push(`${file} -> ${sanitizedName}`);
    }
  }

  if (sanitized.length > 0) {
    console.log(`[INFO] Sanitized ${sanitized.length} file(s):`);
    for (const s of sanitized) {
      console.log(`  ${s}`);
    }
  }
}

export function sanitizeOutputArg(outputDir: string): string {
  const sanitized = sanitizeOutputPath(outputDir);
  if (sanitized.match(WINDOWS_RESERVED_CHARS)) {
    throw new Error(`Output directory contains invalid Windows characters: ${outputDir}`);
  }
  return sanitized;
}
