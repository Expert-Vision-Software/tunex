import { getPlatformInfo, platformExec, requireDocker } from './platform';
import { parseLocalPath, convertWSLToWindowsPath } from './paths';
import { buildDockerCommand } from '../utils/ps-safe';

export function isMockMode(): boolean {
  return process.env.MOCK_DOCKER === 'true';
}

export async function executeDocker(volumeMount: string, ytDlpArgs: string[], localInputPath?: string): Promise<void> {
  if (isMockMode()) {
    const cmd = buildDockerCommand(volumeMount, ytDlpArgs);
    console.log('[MOCK] ' + cmd);
    return;
  }

  requireDocker();

  const platform = getPlatformInfo();
  const { finalVolumeMount, finalArgs } = rewriteOutputPath(volumeMount, ytDlpArgs, platform, localInputPath);
  const cmd = buildDockerCommand(finalVolumeMount, finalArgs);
  return platformExec(cmd, platform.shell);
}

export function rewriteOutputPath(
  volumeMount: string,
  ytDlpArgs: string[],
  platform: ReturnType<typeof getPlatformInfo>,
  localInputPath?: string
): { finalVolumeMount: string; finalArgs: string[] } {
  const outputIdx = ytDlpArgs.findIndex(arg => arg === '-o');
  if (outputIdx === -1 || outputIdx + 1 >= ytDlpArgs.length) {
    return { finalVolumeMount: volumeMount, finalArgs: ytDlpArgs };
  }

  const outputPath = ytDlpArgs[outputIdx + 1];
  const normalizedOutput = outputPath.replace(/\\/g, '/');

  const absMatch = normalizedOutput.match(/^([A-Za-z]):\/(.*)/);
  if (absMatch) {
    const drive = absMatch[1].toUpperCase();
    const rest = absMatch[2];
    const targetDir = `${drive}:/${rest.replace(/\/[^/]*$/, '')}`;
    const filename = rest.split('/').pop() || '';
    const workingDir = process.cwd().replace(/\\/g, '/');

    if (platform.platform === 'win32' || platform.dockerContext === 'windows') {
      const finalArgs = [...ytDlpArgs];
      finalArgs[outputIdx + 1] = `/target/${filename}`;
      return { finalVolumeMount: `${workingDir}:/downloads|${targetDir}:/target`, finalArgs };
    }

    // Linux/non-Windows platform: use comma-separated volumes
    const newVolumeMount = `${workingDir}:/downloads,${targetDir}:/target`;
    const finalArgs = [...ytDlpArgs];
    finalArgs[outputIdx + 1] = `/target/${filename}`;
    return { finalVolumeMount: newVolumeMount, finalArgs };
  }

  if (normalizedOutput.startsWith('./') || normalizedOutput.startsWith('../')) {
    const parts = normalizedOutput.replace(/^\.\//, '').split('/');
    if (parts.length > 1) {
      const subdir = parts.slice(0, -1).join('/');
      const filename = parts[parts.length - 1];
      const workingDir = process.cwd().replace(/\\/g, '/');

      if (platform.platform === 'win32' || platform.dockerContext === 'windows') {
        const finalArgs = [...ytDlpArgs];
        finalArgs[outputIdx + 1] = `/target/${filename}`;
        return { finalVolumeMount: `${workingDir}:/downloads|${workingDir}/${subdir}:/target`, finalArgs };
      }

      const newVolumeMount = `${workingDir}:/downloads,${workingDir}/${subdir}:/target`;
      const finalArgs = [...ytDlpArgs];
      finalArgs[outputIdx + 1] = `/target/${filename}`;
      return { finalVolumeMount: newVolumeMount, finalArgs };
    }
  }

  // WSL + Windows Docker: parseLocalPath handles WSL mount paths (/mnt/c/...)
  // and converts them to Windows paths for Docker Desktop.
  if (platform.isWSL && platform.dockerContext === 'windows') {
    const parsed = parseLocalPath(outputPath, platform.platform);
    if (parsed) {
      const convertedPath = convertWSLToWindowsPath(parsed.dockerVolumeSrc);
      const filename = parsed.normalized.split('/').pop() || '';
      const workingDir = process.cwd().replace(/\\/g, '/');
      const hostWorking = convertWSLToWindowsPath(workingDir);

      const finalArgs = [...ytDlpArgs];
      finalArgs[outputIdx + 1] = `/target/${filename}`;
      return { finalVolumeMount: `${hostWorking}:/downloads|${convertedPath}:/target`, finalArgs };
    }

    // Fallback for Windows-format paths (e.g. C:/Media/Music/ytube) when
    // parseLocalPath returns null. This handles the case where bun runs as a
    // Linux binary on WSL but the output path comes from a Windows config.
    const winMatch = normalizedOutput.match(/^([A-Za-z]):\/(.*)/);
    if (winMatch) {
      const drive = winMatch[1].toUpperCase();
      const rest = winMatch[2];
      const targetDir = `${drive}:/${rest.replace(/\/[^/]*$/, '')}`;
      const filename = rest.split('/').pop() || '';
      const workingDir = process.cwd().replace(/\\/g, '/');
      const hostWorking = convertWSLToWindowsPath(workingDir);

      const finalArgs = [...ytDlpArgs];
      finalArgs[outputIdx + 1] = `/target/${filename}`;
      return { finalVolumeMount: `${hostWorking}:/downloads|${targetDir}:/target`, finalArgs };
    }
  }

  return { finalVolumeMount: volumeMount, finalArgs: ytDlpArgs };
}
