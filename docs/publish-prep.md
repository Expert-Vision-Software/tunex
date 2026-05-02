# Publish Prep Plan: `tunex`

## Overview
Rebrand from `music-helper` to `tunex`. The app name should be read from `package.json` at runtime for loose coupling.

---

## 1. package.json Changes

```json
{
  "name": "tunex",
  "version": "0.9.0",
  "description": "Cross-platform CLI for downloading YouTube/Spotify content and managing local media — audio extraction, metadata tagging, and intelligent file matching via LLM inference.",
  "keywords": ["youtube", "spotify", "audio", "mp3", "video", "download", "converter", "metadata", "tagging", "cli", "bun", "media", "music", "yt-dlp", "spotdl"],
  "bin": {
    "tunex": "./src/main.ts"
  },
  "scripts": {
    "start": "bun run src/main.ts",
    "test": "bun test",
    "build": "bun build --target=bun . --outdir=dist --output-format=exe"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/expert-vision-software/tunex.git"
  },
  "publisher": "Expert Vision Software",
  "author": "Expert Vision Support <support@expertvision.software>",
  "bugs": {
    "url": "https://github.com/expert-vision-software/tunex/issues",
    "email": "support@expertvision.software"
  },
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "dotenv": "^16.4.5"
  }
}
```

### Notes:
- `bin` entry enables `bunx tunex` and `npx tunex`
- `description` is SEO-optimized (front-loaded key terms)
- `build` script stubbed for future self-contained exe
- `repository` and `bugs` updated to reflect new name

---

## 2. Dynamic App Name (Runtime)

**Problem:** `music-helper` is hardcoded in `src/commands/index.ts:61`.

**Solution:** Read `name` from `package.json` at runtime using a thin `src/constants.ts` that re-exports from `package.json`.

### Approach: `src/constants.ts`
```typescript
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dir, '../package.json'), 'utf-8'));

export const APP_NAME = pkg.name as string;
export const APP_VERSION = pkg.version as string;
```

**All code references to hardcoded "music-helper" or "ytube-utils" replace with `APP_NAME`.**  
Files to update (verify at execution time — current known references):
- `src/commands/index.ts:61` — `console.log('music-helper - Media Utility Suite\n')`
- `src/main.ts:66` — CLI usage hint

At execution time, re-search for any remaining hardcoded app name references across all `.ts` and `.md` files before proceeding.

---

## 3. README.md (New)

Create `README.md` with SEO-optimized first paragraph:
```
tunex is a cross-platform CLI utility for downloading YouTube and Spotify content, converting video to audio, extracting MP3s from local media, and managing music metadata. Built with Bun and designed to run anywhere with Docker — no ffmpeg or yt-dlp installation required.
```

Structure:
1. One-liner + install command (`bunx tunex`)
2. SEO paragraph
3. Features (current + roadmap)
4. Quick start (interactive + direct CLI)
5. Commands overview
6. Configuration (.env)
7. Roadmap (Spotify, metadata tagging, LLM matching)

---

## 4. Checklist

- [ ] Write `docs/publish-prep.md` with this plan (this document)
- [ ] Update `package.json` with new name, keywords, description, bin, repository, bugs
- [ ] Create `src/constants.ts` exporting `APP_NAME`, `APP_VERSION`
- [ ] Update `src/commands/index.ts` to use `APP_NAME` instead of hardcoded string
- [ ] Update `src/main.ts` to use `APP_NAME` in CLI usage hint
- [ ] Search all `.ts` and `.md` files for remaining hardcoded references to `music-helper` or `ytube-utils` and update them
- [ ] Create `README.md` with SEO-optimized content
- [ ] Verify `bun test` still passes
- [ ] Verify `bun run src/main.ts` interactive mode works

---

## 5. Version Strategy (Future)

For self-contained build (future):
- `build` script uses `bun build --compile` for single binary
- Binary: `tunex.exe` (Windows) / `tunex` (Unix)