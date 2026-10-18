# Changelog

All notable changes to this project will be documented in this file.

## [0.9.13] - 2026-10-18

### Fixed

- **Docker volume comma separator**: `buildDockerCommand` now splits on both `|` and `,` as volume separators. Previously it only split on `|`, so Windows multi-volume specs using `,` (e.g. `C:/dev/...:/downloads,C:/Media/...:/target`) were passed as a single spec to bash, which split on the unquoted comma, causing docker to receive a bare path as a command name → `too many colons`.

## [0.9.12] - 2026-10-18

### Fixed

- **Windows PowerShell EPIPE**: `runInteractive()` now guards against non-TTY environments. Previously, running `bunx tunex` in automated PowerShell contexts caused clack/prompts readline to crash with `EPIPE: broken pipe`.
- **Docker volume path quoting**: `psEscapePathForDocker` now correctly quotes Windows drive-letter paths (`C:/...`, `D:/...`). Previously these were passed unquoted, causing PowerShell to misinterpret `C:` as a path separator and producing the docker error `too many colons`.
