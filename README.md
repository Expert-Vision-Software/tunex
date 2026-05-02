# tunex

[![CI](https://github.com/Expert-Vision-Software/tunex/actions/workflows/publish.yml/badge.svg)](https://github.com/Expert-Vision-Software/tunex/actions)
[![npm version](https://img.shields.io/npm/v/@expert-vision-software/tunex)](https://www.npmjs.com/package/@expert-vision-software/tunex)
[![License: MIT](https://img.shields.io/npm/l/@expert-vision-software/tunex)](https://opensource.org/licenses/MIT)

Cross-platform CLI for downloading YouTube/Spotify content, extracting audio, and managing music metadata.

## Install

```bash
bunx tunex
```

## Overview

tunex is a cross-platform CLI utility for downloading YouTube and Spotify content, converting video to audio, extracting MP3s from local media, and managing music metadata. Built with Bun and designed to run anywhere with Docker — no ffmpeg or yt-dlp installation required.

## Features

- **YouTube Downloads**: Extract audio (MP3) or download video (MP4)
- **Local Audio Extraction**: Extract audio from any local video file
- **Playlist Support**: Process entire YouTube playlists automatically
- **Parallel Processing**: Configurable thread count (up to 4)
- **Cross-Platform**: Works on Windows, macOS, and Linux via Docker

## Quick Start

### Interactive Mode

```bash
bunx tunex
```

### Direct CLI Mode

```bash
bunx tunex run bulk-audio-extract -i "./videos" -o "./audio"
```

## Commands

| Command | Description |
|---------|-------------|
| `bulk-audio-extract` | Extract audio from local video files |
| `yt-audio-only` | Download YouTube audio as MP3 |
| `yt-video-mp4` | Download YouTube video as MP4 |

## Configuration

```bash
bunx tunex config
```

Interactive tool to view and set defaults for output directory, thread count, and log file path. Settings are saved to `~/.tunex/config.json`.

### Config Precedence

1. CLI flags (passed at runtime)
2. Environment variables (`.env.local` > `.env`)
3. Config file (`~/.tunex/config.json`)
4. Factory defaults

### Dot Env Overrides

Create a `.env` file in the project root:

```env
DEFAULT_OUTPUT_DIR=./output
DEFAULT_THREADS=2
LOG_FILE=./tunex.log
```

## Roadmap

- [ ] Spotify integration (track/album/playlist download)
- [ ] Automatic metadata tagging (artist, album, title)
- [ ] LLM-powered file matching and organization