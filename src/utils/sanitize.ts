const WINDOWS_RESERVED_CHARS = /[\/\\:*?"<>|]/g;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
const MULTIPLE_SPACES = /\s{2,}/g;
const TRAILING_PERIOD_OR_SPACE = /[\s.]+$/;
const NON_ASCII = /[^\x00-\x7F]/g;
const UNICODE_PUNCTUATION = /[\u0080-\uFFFF]/g;

export function sanitizeFilename(filename: string): string {
  let result = filename
    .replace(WINDOWS_RESERVED_CHARS, '-')
    .replace(UNICODE_PUNCTUATION, '-')
    .replace(NON_ASCII, '')
    .replace(TRAILING_PERIOD_OR_SPACE, '')
    .replace(MULTIPLE_SPACES, ' ')
    .trim();

  if (WINDOWS_RESERVED_NAMES.test(result)) {
    result = '_' + result;
  }

  return result || 'untitled';
}

export function sanitizeOutputPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}
