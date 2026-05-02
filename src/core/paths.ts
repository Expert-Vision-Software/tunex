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

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
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
        return ['windows', 'unix-relative', 'unix-native'].includes(parsed.type);
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

export function normalizePathForDisplay(path: string, execPlatform?: ExecutionPlatform): string {
  const platform = execPlatform ?? getPlatformInfo().platform;
  const trimmed = path.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (/^[a-zA-Z]:[\\\/]/.test(trimmed)) {
    if (platform === 'wsl') {
      return convertWSLToWindowsPath(trimmed);
    }
    if (platform === 'linux') {
      const normalized = trimmed.replace(/\\/g, '/');
      return normalized.replace(/^([A-Za-z]):/, '/$1');
    }
    return trimmed;
  }

  if (platform === 'windows' && (trimmed.startsWith('/mnt/') || trimmed.startsWith('~/'))) {
    return convertWSLToWindowsPath(trimmed);
  }

  if (trimmed === '.' || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    const cwd = process.cwd();
    const normalized = trimmed.replace(/^\.\//, '');
    return `${cwd}/${normalized}`.replace(/\\/g, '/');
  }

  if (!trimmed.includes('/') && !trimmed.includes('\\')) {
    const cwd = process.cwd();
    return `${cwd}/${trimmed}`.replace(/\\/g, '/');
  }

  return trimmed;
}

function convertWindowsToWSLPath(windowsPath: string): string {
  const normalized = windowsPath.replace(/\\/g, '/');
  const match = normalized.match(/^([A-Za-z]):\/(.*)/);
  if (match) {
    const drive = match[1].toLowerCase();
    const rest = match[2];
    return `/mnt/${drive}/${rest}`;
  }
  return normalized;
}

export function getWorkingDirForDocker(): string {
  const platform = getPlatformInfo();
  const cwd = process.cwd().replace(/\\/g, '/');

  if (platform.isWSL && platform.dockerContext === 'windows') {
    return convertWSLToWindowsPath(cwd);
  }

  return cwd;
}

export function buildVolumeMount(workingDir: string, targetDir?: string): string {
  if (!targetDir || targetDir === '.' || targetDir === workingDir) {
    return `${workingDir}:/downloads`;
  }

  const normalizedTarget = targetDir.replace(/\\/g, '/');

  if (normalizedTarget.startsWith('./') || normalizedTarget.startsWith('../')) {
    const resolvedTarget = `${workingDir}/${normalizedTarget.replace(/^\.\//, '')}`;
    return `${workingDir}:/downloads|${resolvedTarget}:/target`;
  }

  if (/^[a-zA-Z]:/.test(normalizedTarget)) {
    const normalizedWin = normalizedTarget.replace(/\//g, '/');
    return `${workingDir}:/downloads|${normalizedWin}:/target`;
  }

  return `${workingDir}:/downloads|${normalizedTarget}:/target`;
}