import { platformExec, getShell } from './platform';

export function isMockMode(): boolean {
  return process.env.MOCK_DOCKER === 'true';
}

export async function executeDocker(volumeMount: string, ytDlpArgs: string[]): Promise<void> {
  if (isMockMode()) {
    console.log('[MOCK] docker run -it --rm -v "' + volumeMount + '" jauderho/yt-dlp:latest ' + ytDlpArgs.join(' '));
    return;
  }

  const cmd = `docker run -it --rm -v "${volumeMount}" jauderho/yt-dlp:latest ${ytDlpArgs.join(' ')}`;
  return platformExec(cmd, getShell());
}