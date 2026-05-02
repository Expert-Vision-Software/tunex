import { platformExec, getShell } from './platform';
import { buildDockerCommand } from '../utils/ps-safe';

export function isMockMode(): boolean {
  return process.env.MOCK_DOCKER === 'true';
}

export async function executeDocker(volumeMount: string, ytDlpArgs: string[]): Promise<void> {
  if (isMockMode()) {
    const cmd = buildDockerCommand(volumeMount, ytDlpArgs);
    console.log('[MOCK] ' + cmd);
    return;
  }

  const { finalVolumeMount, finalArgs } = rewriteOutputPath(volumeMount, ytDlpArgs);
  const cmd = buildDockerCommand(finalVolumeMount, finalArgs);
  return platformExec(cmd, getShell());
}

function rewriteOutputPath(volumeMount: string, ytDlpArgs: string[]): { finalVolumeMount: string; finalArgs: string[] } {
  const outputIdx = ytDlpArgs.findIndex(arg => arg === '-o');
  if (outputIdx === -1 || outputIdx + 1 >= ytDlpArgs.length) {
    return { finalVolumeMount: volumeMount, finalArgs: ytDlpArgs };
  }

  const outputPath = ytDlpArgs[outputIdx + 1];
  const normalizedOutput = outputPath.replace(/\\/g, '/');

  // Handle absolute Windows paths like c:/media/music/ytube
  const absMatch = normalizedOutput.match(/^([A-Za-z]):\/(.*)/);
  if (absMatch) {
    const drive = absMatch[1].toUpperCase();
    const rest = absMatch[2];
    const targetDir = `${drive}:/${rest.replace(/\/[^/]*$/, '')}`;
    const filename = rest.split('/').pop() || '';

    // On Windows, Docker expects different path formats
    if (process.platform === 'win32') {
      // Use Windows path with backslashes for host, and separate -v flags
      const hostTarget = targetDir.replace(/\//g, '\\');
      const hostWorking = process.cwd().replace(/\//g, '\\');

      // Build docker command with multiple -v flags (passed via finalArgs placeholder)
      const finalArgs = [...ytDlpArgs];
      finalArgs[outputIdx + 1] = `/target/${filename}`;
      // Signal to use multiple volumes via special marker
      return { finalVolumeMount: `${hostWorking}\\:/downloads|${hostTarget}\\:/target`, finalArgs };
    }

    const workingDir = process.cwd().replace(/\\/g, '/');
    const newVolumeMount = `${workingDir}:/downloads,${targetDir}:/target`;
    const finalArgs = [...ytDlpArgs];
    finalArgs[outputIdx + 1] = `/target/${filename}`;
    return { finalVolumeMount: newVolumeMount, finalArgs };
  }

  // Handle relative paths that need subdirectory mounting
  if (normalizedOutput.startsWith('./') || normalizedOutput.startsWith('../')) {
    const parts = normalizedOutput.replace(/^\.\//, '').split('/');
    if (parts.length > 1) {
      const subdir = parts.slice(0, -1).join('/');
      const filename = parts[parts.length - 1];
      const workingDir = process.cwd().replace(/\\/g, '/');

      if (process.platform === 'win32') {
        const hostWorking = process.cwd().replace(/\//g, '\\');
        const finalArgs = [...ytDlpArgs];
        finalArgs[outputIdx + 1] = `/target/${filename}`;
        return { finalVolumeMount: `${hostWorking}\\:/downloads|${hostWorking}\\${subdir}:/target`, finalArgs };
      }

      const newVolumeMount = `${workingDir}:/downloads,${workingDir}/${subdir}:/target`;
      const finalArgs = [...ytDlpArgs];
      finalArgs[outputIdx + 1] = `/target/${filename}`;
      return { finalVolumeMount: newVolumeMount, finalArgs };
    }
  }

  return { finalVolumeMount: volumeMount, finalArgs: ytDlpArgs };
}