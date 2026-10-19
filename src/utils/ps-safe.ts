import { YT_DLP_DOCKER_IMAGE } from '../constants.js';

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

/**
 * Returns the docker binary name, honoring the `TUNEX_DOCKER_CMD` env var
 * override (useful for podman, testing, or non-standard setups).
 */
export function getDockerCmd(): string {
  return process.env.TUNEX_DOCKER_CMD || 'docker';
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
  return `${getDockerCmd()} run --rm ${volumeFlags} ${YT_DLP_DOCKER_IMAGE} ${escapedArgs.join(' ')}`;
}