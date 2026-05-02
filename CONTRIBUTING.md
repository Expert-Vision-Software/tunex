# Contributing to tunex

## Setup

```bash
bun install
```

## Development

```bash
bun run src/main.ts              # Interactive CLI
bun run src/main.ts run <cmd>    # Direct CLI mode
```

## Quality Gates

Use OpenCode skills for regression detection and test evaluation.

```bash
/test-baseline eval              # Run tests + build, evaluate against baseline
/test-baseline update            # Update baseline only if PASS + thresholds exceeded
/regression-check                # Quality decision: PROCEED / STOP / REVIEW
```

**Typical workflow:**
1. Make changes
2. Run `/test-baseline eval` — checks tests + build against thresholds
3. If result is `REVIEW` or `STOP`, fix before proceeding
4. Use `/regression-check` before commit for final quality signal

**Regression-check decision signals:**
- `PROCEED` — PASS, no violations, safe to commit
- `REVIEW` — Has violations or regressions to address first
- `STOP` — Failures that need human approval before proceeding

## Automated Testing

```bash
bun test                        # All tests (mocked Docker)
MOCK_DOCKER=true bun test       # Same effect
```

Key conventions:
- Tests use `MOCK_DOCKER=true` — never call real yt-dlp
- All test files under `src/**/__tests__/`
- See `docs/testing-protocol.md` for threshold definitions

## Build & Validation

```bash
bun run build                   # Creates dist/tunex.exe
bun test                        # Must pass before PR
```

**Validation checklist:**
- [ ] `bun test` passes (0 failures)
- [ ] `bun run build` succeeds
- [ ] No `music-helper` or `ytube-utils` strings in source


## Manual Testing Locally (bun link)

```bash
bun link                          # Symlink globally — run from project root
bunx tunex                        # Test as if installed globally
bunx tunex config                 # Config menu
bunx tunex run bulk-audio-extract -i "./videos"

bunx unlink                       # Remove global link when done
```

Use `bun link` instead of publishing to test CLI behavior end-to-end.

## Code Conventions

- **Module imports:** Use `.js` extensions (`from './bulk-audio-extract.js'`)
- **CLI prompts:** Use `@clack/prompts` `text()` — no `number()` in this library
- **Thread cap:** Maximum 4 threads enforced in `src/core/config.ts`
- **App name:** Use `APP_NAME` from `src/constants.js`, never hardcode strings

## Project Structure

| Path | Purpose |
|------|---------|
| `src/commands/*.ts` | Command implementations |
| `src/core/executor.ts` | Docker execution (mockable) |
| `src/core/config.ts` | Config loading + thread cap |
| `src/constants.ts` | APP_NAME, APP_VERSION |
| `docs/testing-protocol.md` | Test execution workflow |

## Committing

```bash
git commit -m "description"
git push
```

Keep commits focused. Update `docs/testing-baseline.xml` if thresholds are exceeded and tests pass.
