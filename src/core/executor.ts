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

  const cmd = buildDockerCommand(volumeMount, ytDlpArgs);
  return platformExec(cmd, getShell());
}