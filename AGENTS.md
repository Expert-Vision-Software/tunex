# music-helper

Cross-platform CLI utility wrapping `yt-dlp` via Docker for downloading/converting YouTube content and extracting audio from local video files.

## Commands

```bash
bun test                    # Run all tests
bun run src/main.ts         # Launch interactive CLI
bun run src/main.ts <cmd>  # Direct CLI mode (e.g., bulk-audio-extract)
```

## Key Conventions

- **Runtime:** Bun (not Node.js) — use `bun run`, `bun test`, `bun install`
- **Testing:** Mock Docker with `MOCK_DOCKER=true` env var — tests run without Docker
- **CLI prompts:** `@clack/prompts` — use `text()` for all inputs; `number()` does not exist in this library
- **Thread cap:** 4 maximum enforced in `src/core/config.ts`
- **Entry point:** `src/main.ts` — handles both interactive menu and direct CLI execution

## Project Structure

```
src/
├── main.ts                    # Entry point
├── commands/
│   ├── index.ts               # Registry + menu + group() orchestration
│   ├── types.ts               # YtubeCommand interface
│   ├── bulk-audio-extract.ts  # Local video → MP3
│   ├── yt-audio-only.ts       # YouTube → MP3
│   └── yt-video-mp4.ts        # YouTube → MP4
├── core/
│   ├── executor.ts            # Docker exec with MOCK_DOCKER support
│   ├── platform.ts            # pwsh/powershell/bash detection
│   └── config.ts             # .env + thread cap
└── utils/
    └── logger.ts              # Console + file logging
tests/fixtures/               # Mock yt-dlp JSON + sample video files
```

## Common Issues

- **group() API:** Pass prompt function calls (`text({...})`) not plain objects — the library does not have a `number()` function
- **Module resolution:** Use `.js` extensions in imports (e.g., `from './bulk-audio-extract.js'`)
- **Windows paths:** `process.cwd()` uses backslashes; `executor.ts` converts to forward slashes for Docker volumes

## PRD

See `docs/PRD.md` for full specification (note: PRD still references original `ytube-utils` name)

## Testing

See `docs/testing-protocol.md` for threshold-based test execution and baseline management.

Run tests: `bun test`
Mock mode: `MOCK_DOCKER=true bun run src/main.ts <command>`
