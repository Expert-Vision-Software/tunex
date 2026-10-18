export function psEscapeArg(arg: string): string {
  if (!arg.includes(' ') && !arg.includes('"') && !arg.includes('$') && !arg.includes('`') && !arg.includes('\'') && !arg.includes(':') && !arg.includes('(') && !arg.includes(')')) {
    return arg;
  }
  return `'${arg.replace(/'/g, "''")}'`;
}

export function psEscapePathForDocker(path: string): string {
  const hasSpecialChars = /[ &:()$`"':]/.test(path);
  if (!hasSpecialChars) {
    return path;
  }
  return `'${path.replace(/'/g, "''")}'`;
}

export function buildDockerCommand(volumeMount: string, ytDlpArgs: string[]): string {
  const escapedArgs = ytDlpArgs.map(psEscapeArg);

  // Split on '|' (pipe) or ',' (comma) — executor.ts uses '|' for WSL path
  // rewriting and ',' for Windows path rewriting. Both must be split so each
  // volume spec gets its own -v flag, otherwise bash/PowerShell will treat
  // the separator as a word boundary and pass multiple -v arguments.
  const separator = volumeMount.includes('|') ? '|' : ',';
  const volumes = volumeMount.split(separator);
  const volumeFlags = volumes.map(v => `-v ${psEscapePathForDocker(v)}`).join(' ');
  return `docker run --rm ${volumeFlags} jauderho/yt-dlp:latest ${escapedArgs.join(' ')}`;
}