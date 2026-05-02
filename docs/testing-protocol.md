---
name: music-helper testing protocol
description: Test execution, baseline management, and threshold evaluation for music-helper CLI project
updated: 2026-05-02
baseline: docs/testing-baseline.xml
---

# Music-Helper Testing Protocol

## Project Context

**System:** Cross-platform CLI media utility (yt-dlp wrapper via Docker)
**Runtime:** Bun
**Test Framework:** Vitest
**Commands:** bulk-audio-extract, yt-audio-only, yt-video-mp4

## Critical Rules

| Rule | Description |
|------|-------------|
| PASS CRITERIA | All tests pass (0 failures), no build errors |
| BASELINE UPDATE | Update `@testing-baseline.xml` **ONLY** on PASS + threshold exceeded |
| NO REAL APIS | Never call real external APIs in tests (yt-dlp mocked via MOCK_DOCKER=true) |
| DOMAIN ISOLATION | Zero external network dependencies in test suite |
| STOP ON FAILURE | STOP immediately on test failure → REPORT → PLAN → APPROVAL → FIX |

## Execution Workflow

```
Build → Test_Backend → Evaluate → Decision
```

### Stage: Build
```bash
bun run build  # if exists
# or check syntax via bun run src/main.ts --help
```

### Stage: Test_Backend
```bash
bun test
```

### Stage: Evaluate
- PASS: All tests pass, no build errors
- FAIL: Any test failure, build error

### Stage: Baseline
If PASS + threshold met → Update `@testing-baseline.xml`
**Do NOT modify this protocol file with results**

## Threshold Matrix

| Metric | Threshold | Direction |
|--------|-----------|-----------|
| Test count | > 10% change | Any |
| Pass rate | > 10% change | Any |
| Build time | > 10% increase | Up only |
| Coverage | > 5% change | Any |
| Test duration | > 20% increase | Up only |

## Decision Matrix

| Current | New | Result | Update? |
|---------|-----|--------|---------|
| PASS | PASS | PASS | Yes, if threshold met |
| PASS | FAIL | FAIL | No |
| FAIL | PASS | PASS | Yes (recovery) |
| FAIL | FAIL | FAIL | No |

## Test Commands

```bash
# Run all unit tests
bun test

# Run specific suite
bun test src/commands/

# Run in mock mode (all external deps mocked)
MOCK_DOCKER=true bun run src/main.ts <command>
```

## Investigation Triggers

- Test failures increase
- Pass rate < 90%
- Build time > 10% increase
- New unhandled errors

## Anti-Patterns

- Anemic tests (only getters/setters)
- Testing private methods
- Missing critical path coverage
- Using real Docker daemon in tests (must use MOCK_DOCKER=true)