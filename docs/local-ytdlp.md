# Plan: Optional Local yt-dlp Installation (No Docker Required)

## Current State

The tool currently **requires Docker** to run yt-dlp via the `jauderho/yt-dlp:latest` container image. When Docker is missing, `requireDocker()` in `src/core/platform.ts:123` exits with installation instructions.

## Feasibility Assessment

**Highly feasible** with moderate complexity. Key findings:

| Factor | Assessment |
|--------|------------|
| yt-dlp has standalone binaries | ✅ Windows `.exe`, macOS, Linux binaries available - single-file executables at `github.com/yt-dlp/yt-dlp/releases/latest/download/` |
| No Python needed | ✅ Standalone executables are PyInstaller-bundled with Python included |
| FFmpeg dependency | ⚠️ **The main complexity** - needed only when yt-dlp must merge separate video+audio streams |
| Path handling | ✅ Simpler since no cross-platform Docker volume mounts needed |
| Code changes needed | Medium - executor abstraction, binary download/installation |

## Tradeoffs

**Advantages of local installation:**
- No Docker dependency, faster startup (no container init), works in restricted environments
- Simpler architecture (no Docker volume mount path rewriting)
- Lower memory footprint

**Disadvantages:**
- FFmpeg still needed for video download (when yt-dlp needs to merge separate video+audio streams)
- Platform-specific binary management adds maintenance burden
- Docker provides isolation; local execution has different failure modes
- Must manually update yt-dlp binary (Docker image stays current automatically)

## How yt-dlp + FFmpeg Interplay

yt-dlp's `-x` flag (audio extraction) works by:
1. Downloading the audio stream from the video
2. **Without FFmpeg**: yt-dlp just renames/muxes the existing audio container (e.g., webm → mp3). Works without FFmpeg.
3. **With FFmpeg**: yt-dlp transcodes audio to MP3 using FFmpeg, giving proper MP3 encoding with correct metadata.

For video (`--remux-video mp4` or default mp4 download):
- yt-dlp typically downloads video+audio separately then muxes them together using FFmpeg
- Without FFmpeg, some formats may fail; others may need `--no-merge` which produces separate files

## Dynamic Platform Binary Download

The `github.com/yt-dlp/yt-dlp/releases/latest/download/` page provides platform-specific binaries:

| Platform | Binary | URL pattern |
|----------|--------|------------|
| Windows x64 | `yt-dlp.exe` | `yt-dlp.exe` |
| Windows x86 | `yt-dlp_x86.exe` | `yt-dlp_x86.exe` |
| Windows ARM64 | `yt-dlp_arm64.exe` | `yt-dlp_arm64.exe` |
| macOS (Universal) | `yt-dlp_macos` | `yt-dlp_macos` |
| Linux (glibc) | `yt-dlp` | `yt-dlp` |
| Linux (musl) | `yt-dlp_musllinux` | `yt-dlp_musllinux` |

**Detection logic** in `src/core/ytdlp.ts`:
```typescript
function getPlatformBinary(): string {
  const pf = process.platform;
  const arch = process.arch;
  if (pf === 'win32') return arch === 'x64' ? 'yt-dlp.exe' : 'yt-dlp_x86.exe';
  if (pf === 'darwin') return 'yt-dlp_macos';
  if (pf === 'linux') {
    // Check for musl with Bun.spawnSync({cmd: ['ldd', '--version']})
    // or just try glibc first, fall back to musllinux
    return 'yt-dlp';
  }
}
```

## FFmpeg Availability & Behavior

| Scenario | FFmpeg Available? | Behavior |
|----------|-------------------|----------|
| YouTube audio only (`-x`) | Not needed | Works - outputs MP3 with existing audio stream container |
| YouTube audio only (`-x --audio-format mp3`) | **Needed** | FFmpeg transcodes to MP3 |
| YouTube video mp4 | **Needed** | FFmpeg merges video+audio streams |
| YouTube video (best, no merge needed) | Maybe not needed | Some formats muxed directly |
| Local video → MP3 | Not needed | Stream copy extraction (no transcoding) |

**Implementation approach**: When running locally, detect FFmpeg via `Bun.spawnSync({cmd: ['ffmpeg', '-version']})`. For audio-only commands, skip FFmpeg check. For video commands, warn if FFmpeg missing and fail gracefully with instructions.

## Platform-Specific Abstraction for Third-Party App Execution

To mitigate different failure modes between Docker and local execution, implement a platform abstraction in `src/core/ytdlp.ts`:

```typescript
export interface YtdlpExecutor {
  readonly mode: ExecutionMode;
  readonly binaryPath: string;
  readonly ffmpegAvailable: boolean;

  canExecute(): boolean;
  getInstallationInstructions(): string;
  execute(args: string[]): Promise<void>;
}
```

This abstraction:
- Hides Docker vs local execution differences from commands
- Provides consistent error handling and user messaging
- Allows easy addition of other execution modes (e.g., WSL-bound binary) in future

## Proposed Implementation

### 1. New Module: `src/core/ytdlp.ts`
```typescript
export type ExecutionMode = 'docker' | 'local';

export interface YtdlpInstallResult {
  mode: ExecutionMode;
  binaryPath: string;
  ffmpegAvailable: boolean;
}

export async function ensureYtdlp(): Promise<YtdlpInstallResult>
export async function executeLocalYtdlp(args: string[], ffmpegRequired: boolean): Promise<void>
```

### 2. Detect and Offer Choice
When Docker is unavailable in `executor.ts`:
- Check env var `YTDP_LP_MODE=docker|local|auto` (default: `auto`)
- If `auto`: prompt user with `@clack/prompts` - "Docker unavailable. Install yt-dlp locally?"
- If `local`: proceed with local installation

### 3. Binary Download Strategy
- Cache in `~/.music-helper/bin/` (platform-appropriate subdirectory)
- On first run: download from GitHub releases using platform detection
- Verify binary exists on subsequent runs (skip download if present)
- Update check via `yt-dlp --version` comparison
- Self-update via `yt-dlp -U` (or let user know update available)

### 4. Modified Execution Flow
```
executeDocker() / executeLocal()
       ↓
  ┌────┴────┐
  ↓         ↓
Docker    Local
 path     path
```

Commands call `execute()` with `ffmpegRequired: boolean` flag.

## Files to Modify

| File | Change |
|------|--------|
| `src/core/executor.ts` | Add `executeLocal()` parallel to `executeDocker()` |
| `src/core/platform.ts` | Soften `requireDocker()` to return bool, add FFmpeg detection |
| `src/core/ytdlp.ts` | **NEW** - binary download, verification, local execution |
| `src/commands/*.ts` | Pass `ffmpegRequired` flag to executor |
| `src/core/config.ts` | Add `YTDP_LP_MODE`, `YTDP_LP_BIN_DIR` config options |

## Testing Considerations

- `MOCK_DOCKER=true` already exists; add `MOCK_LOCAL=true` for local execution testing
- Mock local binary path in tests
- Integration tests need actual yt-dlp binary (can download in CI or mock)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Binary download fails | Retry with fallback, clear error message |
| FFmpeg missing causes confusing errors | Detect early, clear instructions |
| Binary outdated | Auto-update on launch via `yt-dlp -U` |
| Windows path with spaces | Use `Bun.spawn()` with array args, not shell string |
| Different failure modes | Platform abstraction (`YtdlpExecutor` interface) normalizes behavior |