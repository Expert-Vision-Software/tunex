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
  const escapedVolume = psEscapePathForDocker(volumeMount);
  const escapedArgs = ytDlpArgs.map(psEscapeArg);
  return `docker run -i --rm -v ${escapedVolume} jauderho/yt-dlp:latest ${escapedArgs.join(' ')}`;
}