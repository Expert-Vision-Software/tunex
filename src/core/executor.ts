import { getPlatformInfo, platformExec, requireDocker } from './platform.js';
import { parseLocalPath } from './paths.js';
import { buildDockerCommand, getDockerCmd, psEscapeArg } from '../utils/ps-safe.js';
import { YT_DLP_DOCKER_IMAGE } from '../constants.js';

export function isMockMode(): boolean {
  return process.env.MOCK_DOCKER === 'true';
}

export interface ExecuteDockerOptions {
  /**
   * When true, skip the `docker pull` step entirely and run against whatever
   * image is already cached locally. Useful for air-gapped networks, slow
   * links, or CI environments where the image is pre-pulled.
   */
  noPull?: boolean;
}

export async function executeDocker(
  volumeMount: string,
  ytDlpArgs: string[],
  localInputPath?: string,
  options?: ExecuteDockerOptions,
): Promise<void> {
  if (isMockMode()) {
    // Even in mock mode, advertise what the executor would have done so
    // test output is auditable (per issue #10 spec). The pull is genuinely
    // skipped — no real docker invocation — but the line proves the
    // auto-pull would have run.
    console.log(`[MOCK] would pull: ${getDockerCmd()} pull ${YT_DLP_DOCKER_IMAGE}`);
    const cmd = buildDockerCommand(volumeMount, ytDlpArgs);
    console.log("[MOCK] " + cmd);
    return;
  }

  requireDocker();

  if (!options?.noPull) {
    await pullDockerImage(YT_DLP_DOCKER_IMAGE);
  }

  const platform = getPlatformInfo();
  const { finalVolumeMount, finalArgs } = rewriteOutputPath(volumeMount, ytDlpArgs, platform, localInputPath);
  const cmd = buildDockerCommand(finalVolumeMount, finalArgs);
  return platformExec(cmd, platform.shell);
}

/**
 * Pull the latest version of the yt-dlp Docker image.
 *
 * On a clean pull (image already up-to-date), output is suppressed to avoid
 * noise on every run. On an actual update, the pull output streams to stderr
 * so the user sees what changed. On failure (offline, registry down, DNS,
 * auth), the error is caught, a warning is logged to stderr, and the function
 * resolves successfully so the caller can continue with the locally-cached
 * image. This is deliberate: a stale cached image is still useful; a hard
 * failure would break every command for any user whose network is briefly
 * unavailable.
 *
 * The `TUNEX_DOCKER_CMD` environment variable overrides the docker binary
 * for ALL docker invocations (pull + run). This is useful for non-standard
 * setups (e.g. `podman`) and for testing the failure path without hitting
 * a real registry.
 */
export async function pullDockerImage(image: string): Promise<void> {
  const platform = getPlatformInfo();
  const cmd = `${getDockerCmd()} pull ${psEscapeArg(image)}`;

  // Capture stdout and stderr so we can decide what to surface to the user.
  // Default behavior (per issue #10 spec):
  //   - "Image is up to date" / "already up-to-date"  → suppress (clean pull, no news)
  //   - Anything else                                  → stream to stderr (user wants to see)
  //   - Non-zero exit                                   → warn, don't throw
  const proc = platform.shell === 'bash'
    ? Bun.spawn(['bash', '-c', cmd], { stdout: 'pipe', stderr: 'pipe' })
    : platform.shell === 'pwsh'
    ? Bun.spawn(['pwsh.exe', '-NoProfile', '-Command', cmd], { stdout: 'pipe', stderr: 'pipe' })
    : Bun.spawn(['powershell.exe', '-NoProfile', '-Command', cmd], { stdout: 'pipe', stderr: 'pipe' });

  const [stdoutBytes, stderrBytes, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const firstLine = (stderrBytes || stdoutBytes).split('\n').find(l => l.trim().length > 0) || `exit code ${exitCode}`;
    process.stderr.write(
      `[WARN] Failed to pull ${image}. Falling back to locally-cached image.\n` +
      `  Reason: ${firstLine.trim()}\n`
    );
    return;
  }

  // Check for the "no update" signals in either stream. The exact wording
  // varies across docker versions ("up to date" vs "already up to date"),
  // so we match on the stable token.
  const combined = (stdoutBytes + stderrBytes).toLowerCase();
  const isUpToDate = /\bup to date\b/.test(combined) || /\balready (up to date|pulled)\b/.test(combined);
  if (isUpToDate) {
    return; // Clean pull — no output, no noise.
  }

  // Actual update — surface the pull progress to the user.
  if (stdoutBytes) process.stderr.write(stdoutBytes);
  if (stderrBytes) process.stderr.write(stderrBytes);
}

/**
 * Extract the parent directory and filename from a path.
 * The "filename" is the last segment, typically a yt-dlp template
 * (e.g. "%(uploader)s - %(title)s.%(ext)s"). The "dir" is everything
 * before that — this is what should be mounted into the container.
 *
 * Handles both Windows (C:\foo\bar) and Unix (/foo/bar) paths.
 */
function splitPathForVolume(path: string): { dir: string; filename: string } {
  const normalized = path.replace(/\\/g, '/');
  const isWindowsAbs = /^[A-Za-z]:\//.test(normalized);
  const isUnixAbs = !isWindowsAbs && normalized.startsWith('/');
  const drive = isWindowsAbs ? normalized[0] : '';

  // Strip drive letter (Windows) or leading slash (Unix abs) for splitting
  const stripped = isWindowsAbs
    ? normalized.slice(2)
    : (isUnixAbs ? normalized.slice(1) : normalized);

  const parts = stripped.split('/').filter(p => p.length > 0);
  if (parts.length === 0) {
    return { dir: isWindowsAbs ? `${drive}:` : '.', filename: '' };
  }
  const filename = parts[parts.length - 1] || '';
  const dirParts = parts.slice(0, -1);
  if (dirParts.length === 0) {
    return { dir: isWindowsAbs ? `${drive}:` : '.', filename };
  }
  const joined = dirParts.join('/');
  // Preserve leading slash for absolute Unix paths so callers can detect
  // abs vs rel from the returned dir.
  const dir = isWindowsAbs
    ? `${drive}:/${joined}`
    : (isUnixAbs ? `/${joined}` : joined);
  return { dir, filename };
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
  const { dir: outputDir, filename } = splitPathForVolume(outputPath);
  const workingDir = process.cwd().replace(/\\/g, '/');

  // Determine the path style for volume mounts:
  // - Native Windows: use Windows-style paths (C:\foo) — docker CLI on Windows
  //   accepts these directly via Docker Desktop.
  // - WSL: use WSL-style paths (/mnt/c/foo) — the WSL dockerd (or Docker
  //   Desktop WSL integration) accepts these. NEVER convert to Windows
  //   format, since the WSL dockerd rejects C:/... spec.
  // - Native Linux: use Linux paths as-is.
  const isWindowsContext = platform.platform === 'windows' || platform.dockerContext === 'windows';
  const pathStyle: 'windows' | 'wsl' | 'linux' = platform.platform === 'windows' ? 'windows' : (platform.isWSL ? 'wsl' : 'linux');
  const separator = isWindowsContext ? '|' : ',';

  // Resolve the output dir to an absolute path in the correct path style.
  // The parsed type tells us what kind of path the user gave us.
  const parsed = parseLocalPath(outputPath, platform.platform);
  let absoluteOutputDir: string;

  if (parsed?.type === 'windows') {
    // User gave a Windows path. On native Windows, keep Windows format.
    // On WSL, we still need to convert to the WSL equivalent (/mnt/c/...)
    // because the WSL dockerd can't read C:\ paths.
    if (pathStyle === 'windows') {
      absoluteOutputDir = outputDir;
    } else if (pathStyle === 'wsl') {
      // Convert C:\foo\bar to /mnt/c/foo/bar
      const drive = outputDir[0].toLowerCase();
      const rest = outputDir.slice(2); // strip "C:"
      absoluteOutputDir = `/mnt/${drive}${rest}`;
    } else {
      // Native Linux with a Windows path — shouldn't normally happen
      absoluteOutputDir = outputDir;
    }
  } else if (parsed?.type === 'wsl-host') {
    // User gave a WSL path like /mnt/c/foo — keep as-is on WSL, or convert
    // to Windows path on native Windows.
    if (pathStyle === 'wsl') {
      absoluteOutputDir = outputDir;
    } else if (pathStyle === 'windows') {
      // Convert /mnt/c/foo to C:/foo
      const match = outputDir.match(/^\/mnt\/([a-z])\/(.*)/);
      if (match) {
        absoluteOutputDir = `${match[1].toUpperCase()}:/${match[2]}`;
      } else {
        absoluteOutputDir = outputDir;
      }
    } else {
      absoluteOutputDir = outputDir;
    }
  } else if (outputDir.startsWith('/')) {
    // Absolute Linux path
    absoluteOutputDir = outputDir;
  } else if (outputDir === '.') {
    // Output is in cwd — no second volume needed
    absoluteOutputDir = workingDir;
  } else {
    // Relative path with subdir
    absoluteOutputDir = `${workingDir}/${outputDir}`;
  }

  // If the resolved output dir is the same as the working dir, no second
  // volume mount is needed (the working dir is already mounted at /downloads,
  // and the file is at the root of the working dir).
  // E.g. -o ./file.mp3 → outputDir='.' and absoluteOutputDir=workingDir
  if (outputDir === '.' || absoluteOutputDir === workingDir) {
    return { finalVolumeMount: volumeMount, finalArgs: ytDlpArgs };
  }

  const finalArgs = [...ytDlpArgs];
  finalArgs[outputIdx + 1] = `/target/${filename}`;

  return {
    finalVolumeMount: `${volumeMount}${separator}${absoluteOutputDir}:/target`,
    finalArgs,
  };
}
