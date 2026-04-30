# ytube-utils PRD

## Overview

**Project Name:** ytube-utils
**Type:** Cross-platform CLI utility (Bun + TypeScript)
**Core Functionality:** Wrapper around `yt-dlp` via Docker for downloading/converting YouTube content and extracting audio from local video files.
**Target Users:** Music enthusiasts who manage local video collections and consume YouTube content.

---

## Technology Stack

- **Runtime:** Bun (native TypeScript, `$` for shell commands)
- **CLI Framework:** @clack/prompts (interactive menu-driven UX)
- **Container:** Docker (jauderho/yt-dlp:latest)
- **Platform:** Cross-platform; PowerShell-primary (pwsh.exe → powershell → bash fallback)

---

## Project Structure

```
ytube-utils/
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts                    # Entry point: menu + CLI flag handling
│   ├── commands/
│   │   ├── types.ts               # Command interface (SOLID)
│   │   ├── bulk-audio-extract.ts  # Local folder → audio MP3
│   │   ├── yt-audio-only.ts       # YouTube → audio MP3
│   │   └── yt-video-mp4.ts        # YouTube → video MP4
│   ├── core/
│   │   ├── executor.ts            # Docker command execution
│   │   ├── platform.ts            # pwsh/bash detection & execution
│   │   ├── config.ts              # Shared config + .env support
│   │   └── metadata.ts            # Artist/title parsing
│   └── utils/
│       └── logger.ts              # Console output + optional file logging
├── docker-compose.yml             # Optional: custom yt-dlp (derived from jauderho)
└── README.md
```

---

## Commands

### 1. bulk-audio-extract
**Description:** Convert local video files to audio-only MP3.
**Input Type:** Folder path (processes all .webm, .mkv, .mp4, .avi, .mov)
**Output:** `{outputDir}/filename.mp3` (filename as-is, no metadata extraction)

**yt-dlp flags:**
```
--extract-audio --audio-format mp3 --audio-quality 128k
--continue --no-abort-on-error --no-playlist-automerge
-o "{outputDir}/%(title)s.%(ext)s"
```

**Docker volume:** `$(pwd):/downloads` → `/downloads/<folder>/`

---

### 2. yt-audio-only
**Description:** Download YouTube video/playlist as audio-only MP3.
**Input Type:** Single URL or playlist URL
**Output:** `{outputDir}/uploader - title.mp3` (flattened to single dir)

**yt-dlp flags:**
```
-f "bestaudio" --extract-audio --audio-format mp3 --audio-quality 128k
--continue --no-abort-on-error --no-playlist-automerge
-o "{outputDir}/%(uploader)s - %(title)s.%(ext)s"
```

---

### 3. yt-video-mp4
**Description:** Download YouTube video/playlist as mid-quality MP4.
**Input Type:** Single URL or playlist URL
**Output:** `{outputDir}/uploader - title.mp4` (flattened to single dir)

**yt-dlp flags:**
```
-f "bestaudio[ext=m4a]+worstvideo[height>=720]/bestaudio+bestvideo"
--merge-output-format mp4
--continue --no-abort-on-error --no-playlist-automerge
-o "{outputDir}/%(uploader)s - %(title)s.%(ext)s"
```

---

## CLI Interface

### Entry Point Behavior
- **Interactive (default):** `bun run ytube-utils` → @clack menu to pick command → prompt for inputs
- **Direct CLI:** `bun run ytube-utils <command> [flags]` → non-interactive, scripted use

### Global Flags
| Flag                    | Description                           | Default       |
| ----------------------- | ------------------------------------- | ------------- |
| `-i, --input <path|url>` | Required. File/folder path or URL    | (none)        |
| `-o, --output-dir <path>` | Output directory                      | Same as input |
| `-t, --threads <n>`     | Parallel threads (1-4)                 | 4             |
| `--flatten`             | Flatten playlist output               | true          |
| `--no-continue`         | Stop on first error                   | false         |
| `--log-file <path>`     | Write logs to file (optional)          | console only  |
| `--config`             | Path to .env config file               | .env          |

### Interactive Menu Flow
1. Display command list (numbered)
2. User selects command
3. Prompt for input (URL, folder path, or file)
4. Prompt for output dir (default: same as input/cwd)
5. Prompt for threads (default: 4)
6. Confirm and execute
7. Display progress/output
8. Report summary at end (success/failure count)

---

## Configuration (.env support)

All config values also accessible via menu and overridable via CLI flags.

```env
DEFAULT_THREADS=4
DEFAULT_OUTPUT_DIR=.
LOG_FILE=
```

---

## Platform Abstraction

### Shell Detection (core/platform.ts)
```typescript
function getShell(): 'pwsh' | 'powershell' | 'bash' {
  // 1. Try pwsh.exe (PowerShell Core)
  // 2. Try powershell.exe (Windows PowerShell)
  // 3. Fallback to bash (Linux/macOS)
}
```

### Docker Execution (core/executor.ts)
```typescript
async function executeDocker(volumeMount: string, ytDlpArgs: string[]): Promise<void> {
  const cmd = `docker run -it --rm -v "${volumeMount}" jauderho/yt-dlp:latest ${ytDlpArgs.join(' ')}`;
  return platformExec(cmd, getShell());
}
```

---

## Docker Setup

**Image:** `jauderho/yt-dlp:latest` (pulled automatically)

**Optional docker-compose.yml** (for custom image):
```yaml
services:
  yt-dlp:
    image: jauderho/yt-dlp:latest
    build: ./docker
```

If custom Dockerfile needed, derive from:
```dockerfile
FROM jauderho/yt-dlp:latest
# Add any custom dependencies here
```

---

## SOLID Principles

### Interface Segregation (commands/types.ts)
```typescript
interface YtubeCommand {
  name: string;
  description: string;
  execute(opts: CommandOptions): Promise<void>;
}

interface CommandOptions {
  input: string | string[];
  outputDir?: string;
  threads?: number;
  continueOnError?: boolean;
  flatten?: boolean;
}
```

### Single Responsibility
- `commands/*.ts` - Command implementation only
- `core/executor.ts` - Docker execution only
- `core/platform.ts` - Shell detection/execution only
- `core/config.ts` - Configuration management only
- `utils/logger.ts` - Output formatting only

### Extensibility
New commands added by:
1. Implement `YtubeCommand` interface in `src/commands/<new-command>.ts`
2. Register in `src/commands/index.ts`
3. Auto-appears in menu and CLI

---

## Error Handling

- `--continue --no-abort-on-error` on all yt-dlp commands
- Individual file failures don't stop batch
- At end: report "X succeeded, Y failed"
- Console errors visible; `--log-file` optional

---

## Non-Goals (Out of Scope)

- Keeping original files after extraction (delete originals)
- Metadata embedding (ID3 tags, etc.)
- Custom yt-dlp image unless explicitly provided
- Platform-specific workarounds beyond shell detection

---

## Acceptance Criteria

1. `bun run ytube-utils` launches interactive @clack menu
2. All 3 commands available via menu and CLI
3. PowerShell execution works on Windows (pwsh.exe fallback)
4. Bash execution works on Linux/macOS
5. All CLI flags work in non-interactive scripted mode
6. .env config loaded and merged with defaults
7. Thread count capped at 4 max
8. Playlist flattening works (default behavior)
9. New commands can be added without modifying existing code
10. Error handling continues on per-file failure, reports at end