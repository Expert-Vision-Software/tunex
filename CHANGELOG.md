# Changelog

All notable changes to this project will be documented in this file.

## [0.9.16] - 2026-10-19

### Added

- **Auto-pull `jauderho/yt-dlp` image before every run**: `executeDocker()` now runs `docker pull` on the configured image (default: `jauderho/yt-dlp:latest`) before each `docker run`. The publisher (jauderho) rebuilds the `:latest` tag within an hour of every yt-dlp upstream release and at least once a week, so this kills the "Your yt-dlp version is older than 90 days" warning that fired on first use for every new install. Closes #10.
- **`--no-pull` escape hatch**: new CLI flag that skips the auto-pull step and runs against the locally-cached image. Useful for air-gapped networks, slow links, or CI environments where the image is pre-pulled.
- **`TUNEX_DOCKER_CMD` env override**: the docker binary can be swapped at runtime (e.g. `TUNEX_DOCKER_CMD=podman`). Also unlocks a single env-var override for the test suite's mock harness.
- **MOCK audit trail**: even when `MOCK_DOCKER=true`, the executor logs `[MOCK] would pull: <cmd> <image>` so test output is auditable per the issue spec.

### Changed

- **Pull output routing per spec**: `pullDockerImage` now captures both stdout and stderr, suppresses output on a clean pull (`Image is up to date` / `already up to date`), and streams the progress to stderr on an actual update. No more "Image is up to date" line on every command.
- **Image name centralization**: the `jauderho/yt-dlp:latest` string is now a single exported constant `YT_DLP_DOCKER_IMAGE` in `src/constants.ts`. All three call sites (`buildDockerCommand`, `checkDocker`, `pullDockerImage`) read it via the `getDockerCmd()` helper.
- **Fail-soft on pull error**: when the pull fails (offline, registry down, DNS, auth), the executor logs `[WARN] Failed to pull <image>. Falling back to locally-cached image.` to stderr and continues to `docker run` with the cached image. A stale cached image is still useful; a hard failure would break every command for any user whose network is briefly unavailable.

### Removed

- Dead `build: ./docker` line in `docker-compose.yml` — the referenced directory did not exist.

### Tests

- 8 new test cases added to `src/core/__tests__/executor.test.ts`. Test count: 128 → 149 (+16%).
- Shared `mockHarness(id)` factory extracted to top-level helper to remove duplication between describe blocks.
- `findInvocation()` helper for precise subcommand-line matching (the previous `toContain("pull")` assertion matched any substring including the `run` line).

## [0.9.15] - 2026-10-18

### Fixed

- **Platform misdetection on Windows with WSL installed**: `checkBashOnWindows()` in `src/core/platform.ts` now checks environment variables (`SHELL`, `MSYSTEM`, `WSL_DISTRO_NAME`) instead of whether `bash.exe` exists. Previously, on any modern Windows dev box with WSL or Git Bash installed, the function returned `true` and misdetected native Windows execution as Linux, causing the wrong volume separator (`,` instead of `|`) and `docker: invalid mode: /downloads` errors.
- **WSL path conversion breaks WSL Docker**: `rewriteOutputPath()` in `src/core/executor.ts` now keeps WSL native paths (`/mnt/c/...`) for WSL executions instead of converting to Windows format (`C:/...`). The WSL dockerd (and Docker Desktop WSL integration) accepts WSL paths; Windows-format specs fail with `invalid mode: /target` because the colon in the drive letter splits the spec.
- **Output files land one directory level deeper than user specified**: `rewriteOutputPath()` now extracts the parent directory of the output path and mounts that at `/target`, rather than mounting the full output pattern (which created a literal `%(uploader)s - %(title)s.%(ext)s` directory inside the user's intended output dir).

## [0.9.14] - 2026-10-18

### Fixed

- **WSL bun + Windows Docker output path**: When bun runs as a Linux binary on WSL (platform.platform='linux'), `rewriteOutputPath` now correctly detects Windows absolute output paths (`C:\Media\Music\ytube`) and uses pipe (`|`) as the volume separator for Windows Docker contexts. Previously the comma separator was used everywhere, causing Docker to parse `/downloads` as a mode flag → `invalid mode: /downloads`.

## [0.9.13] - 2026-10-18

### Fixed

- **Docker volume comma separator**: `buildDockerCommand` now splits on both `|` and `,` as volume separators. Previously it only split on `|`, so Windows multi-volume specs using `,` (e.g. `C:/dev/...:/downloads,C:/Media/...:/target`) were passed as a single spec to bash, which split on the unquoted comma, causing docker to receive a bare path as a command name → `too many colons`.

## [0.9.12] - 2026-10-18

### Fixed

- **Windows PowerShell EPIPE**: `runInteractive()` now guards against non-TTY environments. Previously, running `bunx tunex` in automated PowerShell contexts caused clack/prompts readline to crash with `EPIPE: broken pipe`.
- **Docker volume path quoting**: `psEscapePathForDocker` now correctly quotes Windows drive-letter paths (`C:/...`, `D:/...`). Previously these were passed unquoted, causing PowerShell to misinterpret `C:` as a path separator and producing the docker error `too many colons`.
