import { platformExec, getShell } from './platform';

export function isMockMode(): boolean {
  return process.env.MOCK_DOCKER === 'true';
}

export async function executeDocker(volumeMount: string, ytDlpArgs: string[]): Promise<void> {
  if (isMockMode()) {
    console.log('[MOCK] docker run -it --rm -v "' + volumeMount + '" jauderho/yt-dlp:latest ' + ytDlpArgs.join(' '));
    return;
  }

  const args = ytDlpArgs.map(arg => arg.includes('%') ? `'${arg}'` : arg);
  const cmd = `docker run -i --rm -v "${volumeMount}" jauderho/yt-dlp:latest ${args.join(' ')}`;
  return platformExec(cmd, getShell());
}