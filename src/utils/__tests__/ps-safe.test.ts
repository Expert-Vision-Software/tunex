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
  test('passes through simple unix paths', () => {
    expect(psEscapePathForDocker('/downloads')).toBe('/downloads');
  });

  test('escapes windows drive-letter paths (colon in drive)', () => {
    // C:/dev/project contains ':' — PowerShell interprets C: as path separator
    expect(psEscapePathForDocker('C:/dev/project')).toBe("'C:/dev/project'");
    expect(psEscapePathForDocker('D:/Videos/music')).toBe("'D:/Videos/music'");
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
      'https://www.youtube.com/watch?v=abc'
    ]);
    expect(cmd).toBe("docker run --rm -v /downloads jauderho/yt-dlp:latest -f bestaudio -o '%(uploader)s - %(title)s.%(ext)s' 'https://www.youtube.com/watch?v=abc'");
  });

  test('splits comma-separated volumes and emits separate -v flags (Windows multi-volume)', () => {
    // executor.ts uses ',' as separator for Windows volumes; each must get its own -v
    const cmd = buildDockerCommand('C:/Users/diego:/downloads,C:/Media/Music/ytube:/target', ['--version']);
    expect(cmd).toBe("docker run --rm -v 'C:/Users/diego:/downloads' -v 'C:/Media/Music/ytube:/target' jauderho/yt-dlp:latest --version");
  });

  test('splits pipe-separated volumes and emits separate -v flags (WSL multi-volume)', () => {
    // executor.ts uses '|' as separator for WSL volumes
    const cmd = buildDockerCommand('/home/user/videos:/downloads|/mnt/d/media:/target', ['--version']);
    expect(cmd).toBe("docker run --rm -v '/home/user/videos:/downloads' -v '/mnt/d/media:/target' jauderho/yt-dlp:latest --version");
  });
});