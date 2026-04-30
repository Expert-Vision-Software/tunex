export type Shell = 'pwsh' | 'powershell' | 'bash';

export async function platformExec(cmd: string, shell: Shell): Promise<void> {
  const proc = shell === 'bash'
    ? Bun.spawn(['bash', '-c', cmd], { stdout: 'inherit', stderr: 'inherit' })
    : Bun.spawn([cmd], { shell: true, stdout: 'inherit', stderr: 'inherit' });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed with exit code ${exitCode}`);
  }
}

export function getShell(): Shell {
  if (process.platform === 'win32') {
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
  return 'bash';
}