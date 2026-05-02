import { describe, expect, test } from 'bun:test';
import { psEscapeArg, psEscapePathForDocker, buildDockerCommand } from '../ps-safe';

describe('psEscapeArg', () => {
  test('passes through simple args', () => {
    expect(psEscapeArg('simple')).toBe('simple');
    expect(psEscapeArg('--no-playlist')).toBe('--no-playlist');
  });

  test('escapes args with spaces using single quotes', () => {
    expect(psEscapeArg('TUNE： Kids - All Star')).toBe("'TUNE： Kids - All Star'");
  });

  test('escapes args with double quotes', () => {
    expect(psEscapeArg('file"name')).toBe("'file\"name'");
  });

  test('escapes args with dollar signs', () => {
    expect(psEscapeArg('$HOME/file')).toBe("'$HOME/file'");
  });

  test('escapes yt-dlp output patterns with %', () => {
    expect(psEscapeArg('%(uploader)s - %(title)s.%(ext)s')).toBe("'%(uploader)s - %(title)s.%(ext)s'");
  });

  test('escapes URLs with colons', () => {
    expect(psEscapeArg('https://youtube.com/watch?v=abc')).toBe("'https://youtube.com/watch?v=abc'");
  });
});

describe('psEscapePathForDocker', () => {
  test('passes through simple paths', () => {
    expect(psEscapePathForDocker('/downloads')).toBe('/downloads');
    expect(psEscapePathForDocker('C:/dev/project')).toBe('C:/dev/project');
  });

  test('escapes paths with spaces', () => {
    expect(psEscapePathForDocker('C:/Users/Test User/Music')).toBe("'C:/Users/Test User/Music'");
  });

  test('escapes paths with special chars', () => {
    expect(psEscapePathForDocker('C:/Users/Test User/Music')).toBe("'C:/Users/Test User/Music'");
  });
});

describe('buildDockerCommand', () => {
  test('builds correct command for simple args', () => {
    const cmd = buildDockerCommand('/downloads', ['--version']);
    expect(cmd).toBe('docker run --rm -v /downloads jauderho/yt-dlp:latest --version');
  });

  test('builds correct command with complex output pattern', () => {
    const cmd = buildDockerCommand('/downloads', [
      '-f', 'bestaudio',
      '-o', '%(uploader)s - %(title)s.%(ext)s',
      'https://youtube.com/watch?v=abc'
    ]);
    expect(cmd).toBe("docker run --rm -v /downloads jauderho/yt-dlp:latest -f bestaudio -o '%(uploader)s - %(title)s.%(ext)s' 'https://youtube.com/watch?v=abc'");
  });
});