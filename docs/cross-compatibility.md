# Cross-Platform Compatibility Plan

## Overview

This document outlines the architectural changes required to support music-helper running correctly on Windows (pwsh/powershell), WSL (bash with Docker Desktop), and Linux (bash with native Docker).

## Problem Statement

Current issues:
1. **WSL detection**: No explicit WSL detection — `getShell()` returns `bash` on WSL (correct), but Docker daemon access and path handling differ
2. **Local path validation**: Only accepts paths with `/` or `\` or Windows drive letters; doesn't accept bare Unix paths like `~/my/path` or `videos/`
3. **Docker volume mounting**: Path conversion logic in `executor.ts` handles Windows vs Linux, but not WSL-specific scenarios (e.g., `/mnt/c/...` paths)
4. **PowerShell escaping**: Uses single-quote escaping (`'...'`), which is bash syntax; PowerShell uses different escaping rules

## Execution Platform Model

```
ExecutionPlatform = 'windows' | 'wsl' | 'linux'
DockerContext = 'windows' | 'linux'    # Where Docker daemon runs
Shell = 'pwsh' | 'powershell' | 'bash'
```

### Detection Logic

| Scenario | `process.platform` | Detection Method | Docker Context | Shell |
|----------|-------------------|------------------|----------------|-------|
| Windows + pwsh | `win32` | `pwsh.exe -Version` succeeds | `windows` | `pwsh` |
| Windows + powershell | `win32` | `powershell.exe -Version` succeeds | `windows` | `powershell` |
| WSL + Docker Desktop | `linux` | `/proc/version` contains `microsoft` | `windows` | `bash` |
| WSL + native Docker | `linux` | `/proc/version` contains `microsoft` | `linux` | `bash` |
| Linux | `linux` | `/proc/version` does not contain `microsoft` | `linux` | `bash` |

## Path Type Taxonomy

### Path Categories

| Category | Examples | Description |
|----------|---------|-------------|
| **Windows absolute** | `C:\Users\diego\videos`, `D:/music` | Windows drive letters |
| **WSL host path** | `/mnt/c/Users/diego/videos`, `/mnt/d/music` | Windows filesystem accessed from WSL |
| **WSL native path** | `~/videos`, `/home/user/videos`, `/var/media` | Paths within WSL distro |
| **Unix relative** | `videos/`, `./music`, `../downloads` | Relative paths without leading `/` |
| **YouTube URL** | `https://youtube.com/...`, `https://youtu.be/...` | Not a local path |

### Validation Rules by Platform

| Input Type | Windows | WSL | Linux |
|------------|---------|-----|-------|
| `C:\path` | ✅ Valid | ❌ | ❌ |
| `/mnt/c/path` | ❌ | ✅ Valid | ❌ |
| `~/path` | ❌ | ✅ Valid | ✅ Valid |
| `/home/user/path` | ❌ | ✅ Valid | ✅ Valid |
| `videos/` (relative) | ❌ | ✅ Valid | ✅ Valid |
| `./videos` | ❌ | ✅ Valid | ✅ Valid |

## New Module Structure

### `src/core/platform.ts` (enhanced)

```typescript
export type ExecutionPlatform = 'windows' | 'wsl' | 'linux';
export type DockerContext = 'windows' | 'linux';
export type Shell = 'pwsh' | 'powershell' | 'bash';

export interface PlatformInfo {
  platform: ExecutionPlatform;
  shell: Shell;
  dockerContext: DockerContext;
  isWSL: boolean;
}

export function detectPlatform(): PlatformInfo {
  // 1. Detect execution platform
  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';
  
  let isWSL = false;
  if (isLinux) {
    isWSL = checkWSL();  // Check /proc/version for "microsoft"
  }
  
  const executionPlatform: ExecutionPlatform = 
    isWindows ? 'windows' : 
    isWSL ? 'wsl' : 'linux';
  
  // 2. Detect shell (only matters for Windows)
  const shell = detectShell(); // pwsh > powershell > bash
  
  // 3. Detect Docker context
  const dockerContext = detectDockerContext(executionPlatform);
  
  return { platform: executionPlatform, shell, dockerContext, isWSL };
}

function checkWSL(): boolean {
  try {
    const result = Bun.spawnSync({
      cmd: ['cat', '/proc/version'],
      stdout: 'pipe'
    });
    const version = new TextDecoder().decode(result.stdout);
    return version.toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

function detectDockerContext(execPlatform: ExecutionPlatform): DockerContext {
  // On Windows/WSL, Docker Desktop provides docker daemon
  // On native Linux, docker daemon is local
  if (execPlatform === 'windows' || execPlatform === 'wsl') {
    return 'windows'; // Docker Desktop (whether accessed from Windows or WSL)
  }
  return 'linux';
}

function detectShell(): Shell {
  if (process.platform !== 'win32') {
    return 'bash';
  }
  // Windows shell detection
  try {
    const result = Bun.spawnSync({ cmd: ['pwsh.exe', '-Version'], stdout: 'pipe' });
    if (result.exitCode === 0) return 'pwsh';
  } catch { /* fall through */ }
  try {
    const result = Bun.spawnSync({ cmd: ['powershell.exe', '-Version'], stdout: 'pipe' });
    if (result.exitCode === 0) return 'powershell';
  } catch { /* fall through */ }
  return 'bash'; // WSL bash as fallback on Windows
}

export async function platformExec(cmd: string, shell: Shell): Promise<void> {
  // ... existing implementation ...
}
```

### `src/core/paths.ts` (new module)

```typescript
import { detectPlatform, type ExecutionPlatform } from './platform';

export type PathType = 'windows' | 'wsl-host' | 'wsl-native' | 'unix-relative';

export interface ParsedPath {
  type: PathType;
  original: string;
  normalized: string;       // Forward slashes, absolute form
  dockerVolumeSrc: string;   // What to mount FROM the host
  containerTarget: string;  // Where it appears inside container
}

export function parseLocalPath(input: string, execPlatform: ExecutionPlatform): ParsedPath | null {
  const trimmed = input.trim();
  
  // Windows absolute path
  if (/^[a-zA-Z]:[\\\/]/.test(trimmed)) {
    return parseWindowsPath(trimmed);
  }
  
  // /mnt/c/... style path (WSL accessing Windows filesystem)
  if (/^\/mnt\/[a-z](\/|$)/.test(trimmed)) {
    return parseWSLHostPath(trimmed, execPlatform);
  }
  
  // ~/... or /home/... style (WSL native or Linux)
  if (trimmed.startsWith('~/') || trimmed.startsWith('/')) {
    return parseUnixPath(trimmed, execPlatform);
  }
  
  // Relative path (Unix style)
  if (trimmed.startsWith('./') || trimmed.startsWith('../') || !trimmed.includes('/') && !trimmed.includes('\\')) {
    return parseRelativePath(trimmed, execPlatform);
  }
  
  // Bare word (assume current directory subfolder)
  return parseRelativePath('./' + trimmed, execPlatform);
}

function parseWindowsPath(path: string): ParsedPath {
  const normalized = path.replace(/\\/g, '/');
  return {
    type: 'windows',
    original: path,
    normalized,
    dockerVolumeSrc: normalized,
    containerTarget: '/target'
  };
}

function parseWSLHostPath(path: string, execPlatform: ExecutionPlatform): ParsedPath {
  // /mnt/c/Users/... -> C:/Users/... (for Docker Desktop mounting)
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
    dockerVolumeSrc: windowsPath,  // Docker Desktop expects C:/... format
    containerTarget: '/target'
  };
}

function parseUnixPath(path: string, execPlatform: ExecutionPlatform): ParsedPath {
  const expanded = path.replace(/^~/, process.env.HOME || '/root');
  
  return {
    type: execPlatform === 'wsl' ? 'wsl-native' : 'unix-native',
    original: path,
    normalized: expanded,
    dockerVolumeSrc: expanded,  // Native Unix path
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

export function isValidLocalPath(input: string, execPlatform: ExecutionPlatform): boolean {
  try {
    const parsed = parseLocalPath(input, execPlatform);
    return parsed !== null;
  } catch {
    return false;
  }
}
```

### `src/core/executor.ts` (refactored)

```typescript
import { detectPlatform } from './platform';
import { parseLocalPath, type ParsedPath } from './paths';

let cachedPlatformInfo: PlatformInfo | null = null;

function getPlatformInfo(): PlatformInfo {
  if (!cachedPlatformInfo) {
    cachedPlatformInfo = detectPlatform();
  }
  return cachedPlatformInfo;
}

export async function executeDocker(
  volumeMount: string, 
  ytDlpArgs: string[],
  localInputPath?: string
): Promise<void> {
  if (isMockMode()) {
    const cmd = buildDockerCommand(volumeMount, ytDlpArgs);
    console.log('[MOCK] ' + cmd);
    return;
  }

  const platform = getPlatformInfo();
  const { finalVolumeMount, finalArgs } = rewriteOutputPath(
    volumeMount, 
    ytDlpArgs, 
    platform,
    localInputPath
  );
  const cmd = buildDockerCommand(finalVolumeMount, finalArgs);
  return platformExec(cmd, platform.shell);
}

function rewriteOutputPath(
  volumeMount: string, 
  ytDlpArgs: string[],
  platform: PlatformInfo,
  localInputPath?: string
): { finalVolumeMount: string; finalArgs: string[] } {
  const outputIdx = ytDlpArgs.findIndex(arg => arg === '-o');
  if (outputIdx === -1 || outputIdx + 1 >= ytDlpArgs.length) {
    return { finalVolumeMount: volumeMount, finalArgs: ytDlpArgs };
  }

  const outputPath = ytDlpArgs[outputIdx + 1];
  
  // Parse output path
  const parsed = parseLocalPath(outputPath, platform.platform);
  if (!parsed) {
    return { finalVolumeMount: volumeMount, finalArgs: ytDlpArgs };
  }

  // Build volume mount based on platform and path type
  const { dockerVolumeSrc, containerTarget } = buildVolumeMount(parsed, platform, localInputPath);
  
  const finalArgs = [...ytDlpArgs];
  finalArgs[outputIdx + 1] = containerTarget;
  
  return { finalVolumeMount: dockerVolumeSrc, finalArgs };
}

function buildVolumeMount(
  parsed: ParsedPath,
  platform: PlatformInfo,
  localInputPath?: string
): { dockerVolumeSrc: string; containerTarget: string } {
  const inputParsed = localInputPath ? parseLocalPath(localInputPath, platform.platform) : null;
  const workingDir = process.cwd().replace(/\\/g, '/');
  
  // Determine base volume (always mount cwd as /downloads)
  let baseVolume = platform.dockerContext === 'windows' 
    ? workingDir.replace(/\//g, '\\')
    : workingDir;
  
  // For WSL with Docker Desktop, convert paths appropriately
  if (platform.isWSL && platform.dockerContext === 'windows') {
    // Running in WSL, Docker Desktop on Windows
    baseVolume = convertWSLToWindowsPath(workingDir);
  }
  
  // If output is in a different directory, add secondary mount
  if (parsed.type !== 'unix-relative' && parsed.dockerVolumeSrc !== workingDir) {
    const secondaryVolume = parsed.dockerVolumeSrc;
    const secondaryTarget = '/target';
    return {
      dockerVolumeSrc: `${baseVolume}:/downloads|${secondaryVolume}:${secondaryTarget}`,
      containerTarget: `/target/${parsed.normalized.split('/').pop()}`
    };
  }
  
  return {
    dockerVolumeSrc: `${baseVolume}:/downloads`,
    containerTarget: parsed.containerTarget
  };
}

function convertWSLToWindowsPath(wsldPath: string): string {
  // /home/user -> //wsl$/Ubuntu/home/user (for Docker Desktop)
  // /mnt/c/Users -> C:/Users
  if (wsldPath.startsWith('/mnt/')) {
    const match = wsldPath.match(/^\/mnt\/([a-z])(.*)/);
    if (match) {
      return `${match[1].toUpperCase()}:${match[2]}`;
    }
  }
  
  // For WSL native paths, use //wsl$/distro/path
  // This is a simplified version; full implementation would need distro detection
  return wsldPath;
}
```

### `src/commands/index.ts` (updated)

```typescript
import { detectPlatform } from './core/platform.js';
import { isValidLocalPath } from './core/paths.js';

// ... existing imports ...

export async function mainMenu(): Promise<void> {
  const { select, confirm, group, text, isCancel } = await import('@clack/prompts');
  const config = loadConfig();
  const platform = detectPlatform();

  console.log('music-helper - Media Utility Suite\n');

  const inputValue = await text({
    message: 'Input URL or local path',
    placeholder: getPlaceholderForPlatform(platform.platform),
  });

  if (isCancel(inputValue) || !inputValue) {
    console.log('Cancelled. Exiting.');
    return;
  }

  const isUrl = inputValue.startsWith('http://') || inputValue.startsWith('https://');
  let commandList: YtubeCommand[];
  let sourceLabel: string;

  if (isUrl) {
    if (!isYouTubeUrl(inputValue)) {
      console.log('Error: Only YouTube URLs are supported for this action.');
      return;
    }
    commandList = youtubeCommands;
    sourceLabel = 'YouTube';
  } else {
    if (!isValidLocalPath(inputValue, platform.platform)) {
      console.log('Error: Invalid local path format for your platform.');
      return;
    }
    commandList = localCommands;
    sourceLabel = 'Local';
  }
  
  // ... rest unchanged ...
}

function getPlaceholderForPlatform(p: ExecutionPlatform): string {
  switch (p) {
    case 'windows':
      return 'C:\\path\\to\\videos or https://youtube.com/...';
    case 'wsl':
      return '/mnt/c/path/to/videos, ~/videos, or https://youtube.com/...';
    case 'linux':
      return '~/path/to/videos or https://youtube.com/...';
  }
}
```

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/core/platform.ts` | Enhancement | Add `detectPlatform()`, `checkWSL()`, `detectDockerContext()`, `PlatformInfo` interface |
| `src/core/paths.ts` | **New** | Path parsing, normalization, validation by platform |
| `src/core/executor.ts` | Refactor | Use new platform detection, integrate path parsing |
| `src/commands/index.ts` | Update | Use platform-aware validation, update placeholders |

## Implementation Order

1. **Phase 1: Platform detection** (`src/core/platform.ts`)
   - Add `detectPlatform()` function
   - Add WSL detection via `/proc/version`
   - Add Docker context detection
   - Export `PlatformInfo` interface

2. **Phase 2: Path handling** (`src/core/paths.ts`)
   - Create new module with `parseLocalPath()`
   - Implement `parseWindowsPath()`, `parseWSLHostPath()`, `parseUnixPath()`, `parseRelativePath()`
   - Implement `isValidLocalPath()` using platform context
   - Implement `convertWSLToWindowsPath()` for Docker mounting

3. **Phase 3: Executor integration** (`src/core/executor.ts`)
   - Use cached `PlatformInfo` from `detectPlatform()`
   - Replace path rewriting with `parseLocalPath()` calls
   - Implement `buildVolumeMount()` with platform awareness
   - Ensure multi-volume mount support for divergent paths

4. **Phase 4: Validation updates** (`src/commands/index.ts`)
   - Import and use `detectPlatform()` and `isValidLocalPath()`
   - Update input placeholder to show platform-appropriate examples
   - Ensure local commands only accept valid local paths

## Testing Strategy

| Scenario | Platform | Input Type | Expected Behavior |
|----------|----------|------------|-------------------|
| Windows local folder | `windows` | `C:\Users\videos` | Valid, mount as Windows path |
| WSL Windows path | `wsl` | `/mnt/c/Users/videos` | Valid, convert to `C:\Users\videos` for Docker |
| WSL native path | `wsl` | `~/videos` | Valid, mount as `/root/videos` or equivalent |
| Linux relative | `linux` | `./videos` | Valid, mount as Unix path |
| YouTube URL | any | `https://youtube.com/...` | Valid, show YouTube commands |
| Invalid on platform | varies | `C:\path` on `linux` | Invalid, reject with error |

## Non-Functional Requirements

- All existing behavior must remain unchanged for current supported scenarios
- Tests must pass without modification (mock Docker already isolates platform logic)
- Platform detection must be cached to avoid repeated subprocess calls
- All path parsing must handle edge cases: spaces, special chars, unicode