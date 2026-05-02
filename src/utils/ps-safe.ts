export function psEscapeArg(arg: string): string {
  if (!arg.includes(' ') && !arg.includes('"') && !arg.includes('$') && !arg.includes('`') && !arg.includes('\'') && !arg.includes(':')) {
    return arg;
  }
  return `'${arg.replace(/'/g, "''")}'`;
}

export function psEscapePathForDocker(path: string): string {
  const hasSpecialChars = /[ &()$`"'|]/.test(path);
  if (!hasSpecialChars) {
    return path;
  }
  return `'${path.replace(/'/g, "''")}'`;
}

export function buildDockerCommand(volumeMount: string, ytDlpArgs: string[]): string {
  const escapedArgs = ytDlpArgs.map(psEscapeArg);

  // Handle multiple volumes (separated by | on Windows)
  if (volumeMount.includes('|')) {
    const volumes = volumeMount.split('|');
    const volumeFlags = volumes.map(v => `-v ${psEscapePathForDocker(v)}`).join(' ');
    return `docker run -i --rm ${volumeFlags} jauderho/yt-dlp:latest ${escapedArgs.join(' ')}`;
  }

  const escapedVolume = psEscapePathForDocker(volumeMount);
  return `docker run -i --rm -v ${escapedVolume} jauderho/yt-dlp:latest ${escapedArgs.join(' ')}`;
}