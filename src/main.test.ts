import { describe, expect, test } from 'bun:test';
import { bulkAudioExtract } from './commands/bulk-audio-extract';
import { ytAudioOnly } from './commands/yt-audio-only';
import { ytVideoMp4 } from './commands/yt-video-mp4';
import { commands, getCommand, mainMenu } from './commands/index';
import * as clack from '@clack/prompts';

describe('commands registry', () => {
  test('commands array exports 3 commands', () => {
    expect(commands).toHaveLength(3);
  });

  test('bulk-audio-extract is in commands', () => {
    expect(commands).toContain(bulkAudioExtract);
  });

  test('yt-audio-only is in commands', () => {
    expect(commands).toContain(ytAudioOnly);
  });

  test('yt-video-mp4 is in commands', () => {
    expect(commands).toContain(ytVideoMp4);
  });

  test('getCommand returns bulk-audio-extract', () => {
    expect(getCommand('bulk-audio-extract')).toBe(bulkAudioExtract);
  });

  test('getCommand returns undefined for unknown', () => {
    expect(getCommand('unknown-command')).toBeUndefined();
  });

  test('mainMenu is a function', () => {
    expect(typeof mainMenu).toBe('function');
  });
});

describe('@clack/prompts API availability', () => {
  test('select is a function', () => {
    expect(typeof clack.select).toBe('function');
  });

  test('confirm is a function', () => {
    expect(typeof clack.confirm).toBe('function');
  });

  test('group is a function', () => {
    expect(typeof clack.group).toBe('function');
  });

  test('text is a function (used for all prompt inputs)', () => {
    expect(typeof clack.text).toBe('function');
  });

  test('number does NOT exist in @clack/prompts (must use text + parseInt)', () => {
    expect(clack.number).toBeUndefined();
  });
});

describe('command structure', () => {
  test('bulk-audio-extract has correct name and description', () => {
    expect(bulkAudioExtract.name).toBe('bulk-audio-extract');
    expect(bulkAudioExtract.description).toBe('Convert local video files to audio-only MP3');
    expect(typeof bulkAudioExtract.execute).toBe('function');
  });

  test('yt-audio-only has correct name and description', () => {
    expect(ytAudioOnly.name).toBe('yt-audio-only');
    expect(ytAudioOnly.description).toBe('Download YouTube video/playlist as audio-only MP3');
    expect(typeof ytAudioOnly.execute).toBe('function');
  });

  test('yt-video-mp4 has correct name and description', () => {
    expect(ytVideoMp4.name).toBe('yt-video-mp4');
    expect(ytVideoMp4.description).toBe('Download YouTube video/playlist as mid-quality MP4');
    expect(typeof ytVideoMp4.execute).toBe('function');
  });
});
