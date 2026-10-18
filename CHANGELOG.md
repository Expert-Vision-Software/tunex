# Changelog

All notable changes to this project will be documented in this file.

## [0.9.12] - 2026-10-18

### Fixed

- **Windows PowerShell EPIPE**: `runInteractive()` now guards against non-TTY environments. Previously, running `bunx tunex` in automated PowerShell contexts caused clack/prompts readline to crash with `EPIPE: broken pipe`.
- **Docker volume path quoting**: `psEscapePathForDocker` now correctly quotes Windows drive-letter paths (`C:/...`, `D:/...`). Previously these were passed unquoted, causing PowerShell to misinterpret `C:` as a path separator and producing the docker error `too many colons`.
