export type Shell = 'pwsh' | 'powershell' | 'bash';
export type ExecutionPlatform = 'windows' | 'wsl' | 'linux';
export type DockerContext = 'windows' | 'linux';

export interface PlatformInfo {
  platform: ExecutionPlatform;
  shell: Shell;
  dockerContext: DockerContext;
  isWSL: boolean;
  hasDocker: boolean;
}

let cachedPlatformInfo: PlatformInfo | null = null;

function checkWSL(): boolean {
  try {
    const result = Bun.spawnSync({ cmd: ['cat', '/proc/version'], stdout: 'pipe' });
    if (result.exitCode !== 0) return false;
    const version = new TextDecoder().decode(result.stdout);
    return version.toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

function checkDocker(): boolean {
  try {
    const result = Bun.spawnSync({ cmd: ['docker', '--version'], stdout: 'pipe' });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

function detectShell(): Shell {
  if (process.platform !== 'win32') {
    return 'bash';
  }
  try {
    const result = Bun.spawnSync({ cmd: ['pwsh.exe', '-Version'], stdout: 'pipe' });
    if (result.exitCode === 0) return 'pwsh';
  } catch { /* fall through */ }
  try {
    const result = Bun.spawnSync({ cmd: ['powershell.exe', '-Version'], stdout: 'pipe' });
    if (result.exitCode === 0) return 'powershell';
  } catch { /* fall through */ }
  return 'bash';
}

function detectDockerContext(execPlatform: ExecutionPlatform): DockerContext {
  if (execPlatform === 'windows' || execPlatform === 'wsl') {
    return 'windows';
  }
  return 'linux';
}

export function detectPlatform(): PlatformInfo {
  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  let isWSL = false;
  if (isLinux) {
    isWSL = checkWSL();
  }

  const executionPlatform: ExecutionPlatform =
    isWindows ? 'windows' :
    isWSL ? 'wsl' : 'linux';

  const shell = detectShell();
  const dockerContext = detectDockerContext(executionPlatform);
  const hasDocker = checkDocker();

  return {
    platform: executionPlatform,
    shell,
    dockerContext,
    isWSL,
    hasDocker,
  };
}

export function getPlatformInfo(): PlatformInfo {
  if (!cachedPlatformInfo) {
    cachedPlatformInfo = detectPlatform();
  }
  return cachedPlatformInfo;
}

export function requireDocker(): void {
  const info = getPlatformInfo();
  if (!info.hasDocker) {
    let installInstructions = '';
    switch (info.platform) {
      case 'windows':
        installInstructions = 'Install Docker Desktop for Windows: https://docs.docker.com/desktop/install/windows-install/';
        break;
      case 'wsl':
        installInstructions = 'Install Docker Desktop for WSL: https://docs.docker.com/desktop/install/wsl/';
        break;
      case 'linux':
        installInstructions = 'Install Docker: https://docs.docker.com/engine/install/';
        break;
    }
    console.error('[ERROR] Docker is required but not installed or not in PATH.');
    console.error('[INFO] ' + installInstructions);
    process.exit(1);
  }
}

export async function platformExec(cmd: string, shell: Shell): Promise<void> {
  let proc;
  if (shell === 'bash') {
    proc = Bun.spawn(['bash', '-c', cmd], { stdout: 'inherit', stderr: 'inherit' });
  } else if (shell === 'pwsh') {
    proc = Bun.spawn(['pwsh.exe', '-NoProfile', '-Command', cmd], { stdout: 'inherit', stderr: 'inherit' });
  } else {
    proc = Bun.spawn(['powershell.exe', '-NoProfile', '-Command', cmd], { stdout: 'inherit', stderr: 'inherit' });
  }

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed with exit code ${exitCode}`);
  }
}

export function getShell(): Shell {
  return getPlatformInfo().shell;
}

export function isWindows(): boolean {
  return getPlatformInfo().platform === 'windows';
}

export function isWSL(): boolean {
  return getPlatformInfo().isWSL;
}

export function isLinux(): boolean {
  return getPlatformInfo().platform === 'linux';
}