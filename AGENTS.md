# tunex

Cross-platform CLI utility wrapping `yt-dlp` via Docker for downloading/converting YouTube content and extracting audio from local video files.

## Commands

```bash
bunx tunex                    # Interactive CLI (zero-install)
bunx tunex config             # Config management menu
bunx tunex run <command>       # Direct CLI mode
bun test                      # Run all tests
bun run build                 # Build standalone exe → dist/tunex.exe
```

## Key Conventions

- **Runtime:** Bun (not Node.js) — use `bun run`, `bun test`, `bun install`
- **Testing:** Mock Docker with `MOCK_DOCKER=true` env var — tests run without Docker
- **CLI prompts:** `@clack/prompts` — use `text()` for all inputs; `number()` does not exist
- **Thread cap:** 4 maximum enforced in `src/core/config.ts`
- **App identity:** `APP_NAME`/`APP_VERSION` exported from `src/constants.ts` (read from `package.json`)
- **Module resolution:** Use `.js` extensions in imports (e.g., `from './bulk-audio-extract.js'`)

## Project Structure

```
src/
├── main.ts                    # Entry point (interactive + direct CLI)
├── constants.ts               # APP_NAME, APP_VERSION from package.json
├── commands/
│   ├── index.ts               # Registry + menu + group() orchestration
│   ├── types.ts               # YtubeCommand interface
│   ├── config-menu.ts         # Config management (bunx tunex config)
│   ├── bulk-audio-extract.ts  # Local video → MP3
│   ├── yt-audio-only.ts       # YouTube → MP3
│   └── yt-video-mp4.ts        # YouTube → MP4
├── core/
│   ├── executor.ts            # Docker exec with MOCK_DOCKER support
│   ├── platform.ts            # pwsh/powershell/bash detection
│   └── config.ts             # .env + thread cap
└── utils/
    └── logger.ts              # Console + file logging
```

## Common Issues

- **group() API:** Pass prompt function calls (`text({...})`) not plain objects
- **Windows paths:** `process.cwd()` uses backslashes; `executor.ts` converts to forward slashes for Docker volumes
- **Build:** Use `--compile` flag, not `--output-format=exe` (doesn't exist in Bun)

## Architecture Notes

- `bin` entry in `package.json` points to `./src/main.ts` — enables `bunx tunex`
- Config file stored at `~/.tunex/config.json`
- Build output: `dist/tunex.exe` (standalone, ~112 MB) — gitignored

## Testing

See `docs/testing-protocol.md` for threshold-based test execution and baseline management (includes build binary metrics).

## Reference

- Commands: `docs/PRD.md`
- Testing: `docs/testing-protocol.md`, `docs/testing-baseline.xml`