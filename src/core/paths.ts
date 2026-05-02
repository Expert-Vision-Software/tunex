import { getPlatformInfo, type ExecutionPlatform } from './platform';

export type PathType = 'windows' | 'wsl-host' | 'wsl-native' | 'unix-native' | 'unix-relative';

export interface ParsedPath {
  type: PathType;
  original: string;
  normalized: string;
  dockerVolumeSrc: string;
  containerTarget: string;
}

export function parseLocalPath(input: string, execPlatform?: ExecutionPlatform): ParsedPath | null {
  const platform = execPlatform ?? getPlatformInfo().platform;
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  if (/^[a-zA-Z]:[\\\/]/.test(trimmed)) {
    return parseWindowsPath(trimmed);
  }

  if (/^\/mnt\/[a-z](\/|$)/.test(trimmed)) {
    return parseWSLHostPath(trimmed, platform);
  }

  if (trimmed.startsWith('~/') || trimmed.startsWith('/')) {
    return parseUnixPath(trimmed, platform);
  }

  return parseRelativePath(trimmed, platform);
}

function parseWindowsPath(path: string): ParsedPath {
  const normalized = path.replace(/\\/g, '/');
  const drive = normalized[0].toUpperCase();
  const rest = normalized.slice(2);

  return {
    type: 'windows',
    original: path,
    normalized,
    dockerVolumeSrc: `${drive}:/${rest}`,
    containerTarget: '/target'
  };
}

function parseWSLHostPath(path: string, execPlatform: ExecutionPlatform): ParsedPath {
  const match = path.match(/^\/mnt\/([a-z])(.*)/);
  if (!match) {
    throw new Error('Invalid /mnt/ path');
  }
  const drive = match[1].toUpperCase();
  const rest = match[2];
  const windowsPath = `${drive}:${rest}`;

  return {
    type: 'wsl-host',
    original: path,
    normalized: path,
    dockerVolumeSrc: windowsPath,
    containerTarget: '/target'
  };
}

function parseUnixPath(path: string, execPlatform: ExecutionPlatform): ParsedPath {
  const expanded = path.replace(/^~/, process.env.HOME || '/root');

  return {
    type: execPlatform === 'wsl' ? 'wsl-native' : 'unix-native',
    original: path,
    normalized: expanded,
    dockerVolumeSrc: expanded,
    containerTarget: '/target'
  };
}

function parseRelativePath(path: string, execPlatform: ExecutionPlatform): ParsedPath {
  const cwd = process.cwd().replace(/\\/g, '/');
  const normalized = path.replace(/^\.\//, '');
  const resolved = `${cwd}/${normalized}`;

  return {
    type: 'unix-relative',
    original: path,
    normalized: resolved,
    dockerVolumeSrc: cwd,
    containerTarget: `/target/${normalized}`
  };
}

export function isValidLocalPath(input: string, execPlatform?: ExecutionPlatform): boolean {
  const platform = execPlatform ?? getPlatformInfo().platform;
  const trimmed = input.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return false;
  }

  try {
    const parsed = parseLocalPath(trimmed, platform);
    if (!parsed) return false;

    switch (platform) {
      case 'windows':
        return parsed.type === 'windows';
      case 'wsl':
        return ['wsl-host', 'wsl-native', 'unix-relative'].includes(parsed.type);
      case 'linux':
        return ['unix-native', 'unix-relative'].includes(parsed.type);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export function convertWSLToWindowsPath(wsldPath: string): string {
  if (wsldPath.startsWith('/mnt/')) {
    const match = wsldPath.match(/^\/mnt\/([a-z])(.*)/);
    if (match) {
      return `${match[1].toUpperCase()}:${match[2]}`;
    }
  }
  return wsldPath;
}

export function getPathPlaceholder(platform: ExecutionPlatform): string {
  switch (platform) {
    case 'windows':
      return 'C:\\path\\to\\videos or https://youtube.com/...';
    case 'wsl':
      return '/mnt/c/path/to/videos, ~/videos, or https://youtube.com/...';
    case 'linux':
      return '~/path/to/videos or https://youtube.com/...';
  }
}