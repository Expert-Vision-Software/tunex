import { describe, expect, test } from 'bun:test';
import { sanitizeFilename, sanitizeOutputPath } from '../sanitize';

describe('sanitizeFilename', () => {
  test('removes Windows reserved characters', () => {
    expect(sanitizeFilename('file:with:colons.txt')).toBe('file-with-colons.txt');
    expect(sanitizeFilename('file*with*asterisks.txt')).toBe('file-with-asterisks.txt');
    expect(sanitizeFilename('file?with?question.txt')).toBe('file-with-question.txt');
    expect(sanitizeFilename('file"with"quotes.txt')).toBe('file-with-quotes.txt');
    expect(sanitizeFilename('file<with>angles.txt')).toBe('file-with-angles.txt');
    expect(sanitizeFilename('file|with|pipes.txt')).toBe('file-with-pipes.txt');
    expect(sanitizeFilename('file/with/slashes.txt')).toBe('file-with-slashes.txt');
    expect(sanitizeFilename('file\\with\\backslashes.txt')).toBe('file-with-backslashes.txt');
  });

  test('removes trailing periods and spaces', () => {
    expect(sanitizeFilename('filename.   ')).toBe('filename');
    expect(sanitizeFilename('filename...')).toBe('filename');
  });

  test('collapses multiple spaces', () => {
    expect(sanitizeFilename('file  name  with   spaces')).toBe('file name with spaces');
  });

  test('prefixes reserved names with underscore', () => {
    expect(sanitizeFilename('con')).toBe('_con');
    expect(sanitizeFilename('CON.TXT')).toBe('_CON.TXT');
    expect(sanitizeFilename('lpt9')).toBe('_lpt9');
    expect(sanitizeFilename('aux.txt')).toBe('_aux.txt');
  });

  test('passes valid filenames through', () => {
    expect(sanitizeFilename('valid_filename.mp3')).toBe('valid_filename.mp3');
    expect(sanitizeFilename('Another Valid File.mp4')).toBe('Another Valid File.mp4');
  });
});

describe('sanitizeOutputPath', () => {
  test('converts backslashes to forward slashes', () => {
    expect(sanitizeOutputPath('C:\\Users\\test')).toBe('C:/Users/test');
  });

  test('collapses multiple slashes', () => {
    expect(sanitizeOutputPath('C:///Users//test')).toBe('C:/Users/test');
  });
});
