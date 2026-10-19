# Changelog

All notable changes to this project will be documented in this file.

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
