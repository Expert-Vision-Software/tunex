# Integration Test Plan: music-helper

## Objective
Execute end-to-end integration tests for all 3 CLI commands by manually walking each menu path via CLI execution.

---

## Test Environment
- **Runtime:** Bun (not Node.js)
- **Mock Mode:** `MOCK_DOCKER=true` (safe execution without actual Docker downloads)
- **Docker Status:** Active and ready (can toggle MOCK_DOCKER=false for real tests)
- **File Size Cap:** ≤100MB total for test fixtures

---

## Commands Under Test

| # | Command | Input Type | Output Pattern |
|---|---------|------------|----------------|
| 1 | `bulk-audio-extract` | Local folder path | `%(title)s.mp3` |
| 2 | `yt-audio-only` | YouTube URL | `%(uploader)s - %(title)s.mp3` |
| 3 | `yt-video-mp4` | YouTube URL | `%(uploader)s - %(title)s.mp4` |

---

## Test Data Requirements

### Option A: Use Mock Mode Only
- Set `MOCK_DOCKER=true`
- No actual files/downloads needed
- Validates CLI flag parsing and command construction

### Option B: Real Files (≤100MB)
- **YouTube URLs:** Use short, known-small videos (e.g., YouTube short URLs or small test videos)
- **Local Test Files:** Create tiny video files (~1-5MB each) for `bulk-audio-extract`

**Recommended Test URLs:**
- `https://www.youtube.com/shorts/dQw4w9WgXcQ` (Rick Astley - 3:03)
- Or use YouTube shorts for smaller files

**Recommended Local Test Files:**
- Use ffmpeg to generate 3 small test videos (~10MB each):
  - `test-video-1.webm` (5 seconds, ~500KB)
  - `test-video-2.mkv` (5 seconds, ~500KB)
  - `test-video-3.mp4` (5 seconds, ~500KB)

---

## CLI Execution Matrix

### Test 1: `bulk-audio-extract` (Local Video → MP3)

```bash
# Interactive menu path
bun run src/main.ts
# → Select "bulk-audio-extract"
# → Input: test-videos/ (folder with local files)
# → Output: ./output
# → Threads: 2
# → Confirm: Yes

# Direct CLI path
MOCK_DOCKER=true bun run src/main.ts bulk-audio-extract -i test-videos/ -o ./output -t 2
```

**Expected Behavior:**
- Searches for `.webm`, `.mkv`, `.mp4`, `.avi`, `.mov` in input folder
- Constructs: `docker run -it --rm -v "$(pwd):/downloads" jauderho/yt-dlp:latest --extract-audio --audio-format mp3 ...`
- Mock mode: prints command to console

---

### Test 2: `yt-audio-only` (YouTube → MP3)

```bash
# Interactive menu path
bun run src/main.ts
# → Select "yt-audio-only"
# → Input: https://www.youtube.com/shorts/dQw4w9WgXcQ
# → Output: ./output
# → Threads: 4
# → Confirm: Yes

# Direct CLI path
MOCK_DOCKER=true bun run src/main.ts yt-audio-only -i "https://www.youtube.com/shorts/dQw4w9WgXcQ" -o ./output -t 4
```

**Expected Behavior:**
- Constructs: `-f bestaudio --extract-audio --audio-format mp3 --audio-quality 128k -o "./output/%(uploader)s - %(title)s.%(ext)s"`
- Mock mode: prints command to console

---

### Test 3: `yt-video-mp4` (YouTube → MP4)

```bash
# Interactive menu path
bun run src/main.ts
# → Select "yt-video-mp4"
# → Input: https://www.youtube.com/shorts/dQw4w9WgXcQ
# → Output: ./output
# → Threads: 1
# → Confirm: Yes

# Direct CLI path
MOCK_DOCKER=true bun run src/main.ts yt-video-mp4 -i "https://www.youtube.com/shorts/dQw4w9WgXcQ" -o ./output -t 1
```

**Expected Behavior:**
- Constructs: `-f bestaudio[ext=m4a]+worstvideo[height>=720]/bestaudio+bestvideo --merge-output-format mp4 -o "./output/%(uploader)s - %(title)s.%(ext)s"`
- Mock mode: prints command to console

---

## Test Execution Order

1. **Pre-flight:** Verify Docker is running (`docker ps`)
2. **Test 1:** `bulk-audio-extract` via direct CLI with MOCK_DOCKER=true
3. **Test 2:** `yt-audio-only` via direct CLI with MOCK_DOCKER=true
4. **Test 3:** `yt-video-mp4` via direct CLI with MOCK_DOCKER=true
5. **Interactive walkthrough:** Run each command through interactive menu (if feasible in automated context)
6. **Real execution:** Optional - toggle MOCK_DOCKER=false with small test files

---

## Bug Delegation Protocol

**On any failure:**
1. Isolate the specific command and flag combination
2. Document reproduction steps
3. Delegate to subagent with:
   - Command that failed
   - Exact flags used
   - Expected vs actual behavior
   - Relevant source file(s) and line number(s)
4. Re-test after fix before continuing

---

---

## Integration Test Results

| Test | Date | Result | Notes |
|------|------|--------|-------|
| `bulk-audio-extract` direct CLI | 2026-04-30 | PASS | MOCK_DOCKER=true, threads=2 |
| `yt-audio-only` direct CLI | 2026-04-30 | PASS | MOCK_DOCKER=true, threads=4 |
| `yt-video-mp4` direct CLI | 2026-04-30 | PASS | MOCK_DOCKER=true, threads=1 |
| Interactive menu (all 3 commands) | 2026-04-30 | PASS | Fixed `group()` API bug |
| Unit tests (all suites) | 2026-04-30 | PASS | 59 pass, 1 skip, 0 fail |

### Bugs Found & Fixed
1. **`src/core/config.ts:13`** - `existsSync` not a function in Bun runtime → Fixed by using `Bun.readFile()` with try/catch
2. **`src/commands/index.ts:43`** - `group()` API expects function wrappers, not direct prompt calls → Fixed by wrapping `text()` calls in arrow functions

---

## Unit Test Log (Post-Integration Pass)

Current test coverage (from `src/main.test.ts` + all `__tests__` directories):
- ✓ commands registry exports 3 commands
- ✓ getCommand returns correct commands
- ✓ mainMenu is a function
- ✓ @clack/prompts API availability (select, confirm, group, text)
- ✓ number() does NOT exist in @clack/prompts
- ✓ Command name and description for all 3 commands
- ✓ core/executor.test.ts - builds correct docker command string
- ✓ core/platform.test.ts - detects pwsh/powershell/bash per platform
- ✓ core/config.test.ts - loads .env, defaults, thread cap at 4 enforced
- ✓ commands/bulk-audio-extract.test.ts - folder input, output dir, audio quality
- ✓ commands/yt-audio-only.test.ts - single URL, playlist URL, output pattern, flatten
- ✓ commands/yt-video-mp4.test.ts - format selector, merge-output-format, output pattern
- ✓ utils/logger.test.ts - console output, file logging, success/failure summary

All PRD test cases are now covered by existing unit tests.

---

## Completion Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | All 3 commands execute successfully in mock mode | ✓ DONE |
| 2 | All CLI flags are parsed correctly | ✓ DONE |
| 3 | Thread cap at 4 is enforced | ✓ DONE |
| 4 | Error messages are clear when required flags are missing | ✓ DONE |
| 5 | Integration test log is updated with results | ✓ DONE |
| 6 | Unit tests are added for any bugs found during integration testing | ✓ DONE (2 bugs fixed with tests) |

---

## Validation Commands

```bash
# Run all unit tests
bun test

# Run with coverage
bun test --coverage

# Run specific suite
bun test src/commands/

# Run in mock mode
MOCK_DOCKER=true bun run src/main.ts bulk-audio-extract -i test/ -o ./output
```