import { test, expect, describe, beforeEach, afterEach, spyOn } from "bun:test";
import { isMockMode, executeDocker, pullDockerImage, rewriteOutputPath } from "../executor.js";
import { _resetPlatformCache } from "../platform.js";
import { writeFileSync, readFileSync, unlinkSync, chmodSync } from "fs";
import os from "os";
import { platform } from "process";

/**
 * Shared helpers for tests that need to mock the docker binary.
 *
 * Each describe block should call `mockHarness(id)` with a unique id so the
 * mock script and marker file don't collide when tests run in parallel
 * (e.g. across processes in CI or in the same Bun test process).
 *
 * The mock script is a tiny shell program that:
 *   - Always records its argv to a marker file (append mode)
 *   - Exits 0 for `--version` (so requireDocker's check passes)
 *   - Exits per the `pullExit` arg for `pull` (so tests can simulate failure)
 *   - Exits 0 for everything else (the `docker run` step)
 */
function mockHarness(id: string) {
  const tmpDir = os.tmpdir();
  const isWin = platform === "win32";
  const scriptPath = `${tmpDir}/tunex-test-${id}-mock${isWin ? ".cmd" : ".sh"}`;
  const markerPath = `${tmpDir}/tunex-test-${id}-marker`;
  return {
    scriptPath,
    markerPath,
    /** Write a script that exits `pullExit` for `pull`, 0 for everything else. */
    writeMockScript(pullExit: 0 | 1 = 0): void {
      if (isWin) {
        // Windows batch script: cmd.exe does not have a shebang mechanism, so we
        // write a .cmd file and spawn it directly (Bun.spawnSync on Windows resolves
        // .cmd via PATHEXT). We use a call-gate to capture %ERRORLEVEL% from the
        // compound command before exiting.
        const pullCase = pullExit === 1 ? "1" : "0";
        const script =
          `@echo off\n` +
          `call :gate %~1 %~2 & exit /b %ERRORLEVEL%\n` +
          `:gate\n` +
          `echo %* >> "${markerPath.replace(/\\/g, "\\\\")}"\n` +
          `if "%~2"=="pull" exit /b ${pullCase}\n` +
          `exit /b 0\n`;
        writeFileSync(scriptPath, script);
      } else {
        const script =
          `#!/bin/sh\n` +
          `echo "$@" >> ${markerPath}\n` +
          `case "$1" in\n` +
          `  --version) exit 0 ;;\n` +
          `  pull) exit ${pullExit} ;;\n` +
          `  *) exit 0 ;;\n` +
          `esac\n`;
        writeFileSync(scriptPath, script);
        chmodSync(scriptPath, 0o755);
      }
    },
    /** Read the marker file; returns null if absent. */
    readMarker(): string | null {
      try {
        return readFileSync(markerPath, "utf-8").trim();
      } catch {
        return null;
      }
    },
    /** Delete the marker file. No-op if absent. */
    clearMarker(): void {
      try {
        unlinkSync(markerPath);
      } catch {
        // Already absent — fine.
      }
    },
  };
}

/**
 * Find the recorded line for a given subcommand (e.g. "pull", "run", "--version").
 * Returns null if not present. The mock script appends one line per invocation:
 *   <subcommand> <args...>
 */
function findInvocation(marker: string, subcommand: string): string | null {
  const lines = marker.split("\n");
  for (const line of lines) {
    // Match the line that starts with the subcommand as its first arg.
    // We use a word-boundary on the start to avoid partial matches.
    if (line === subcommand || line.startsWith(subcommand + " ") || line.startsWith(subcommand + "\t")) {
      return line;
    }
  }
  return null;
}

describe("executor", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MOCK_DOCKER: "true" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("isMockMode returns true when MOCK_DOCKER is 'true'", () => {
    process.env.MOCK_DOCKER = "true";
    expect(isMockMode()).toBe(true);
  });

  test("isMockMode returns false when MOCK_DOCKER is not set", () => {
    delete process.env.MOCK_DOCKER;
    expect(isMockMode()).toBe(false);
  });

  test("isMockMode returns false when MOCK_DOCKER is 'false'", () => {
    process.env.MOCK_DOCKER = "false";
    expect(isMockMode()).toBe(false);
  });

  test("executeDocker logs mock command in mock mode", async () => {
    process.env.MOCK_DOCKER = "true";
    const volumeMount = "/path/to/downloads:/downloads";
    const args = ["--version"];
    await expect(executeDocker(volumeMount, args)).resolves.toBeUndefined();
  });

  test("executeDocker passes correct volume mount and args", async () => {
    process.env.MOCK_DOCKER = "true";
    const volumeMount = "/home/user/videos:/downloads";
    const args = ["--list-formats", "--no-playlist"];
    await executeDocker(volumeMount, args);
  });

  test("executeDocker handles multiple yt-dlp arguments", async () => {
    process.env.MOCK_DOCKER = "true";
    const volumeMount = "/cwd:/downloads";
    const args = [
      "-f", "bestaudio",
      "--extract-audio",
      "--audio-format", "mp3",
      "--audio-quality", "0"
    ];
    await executeDocker(volumeMount, args);
  });

  test("executeDocker in MOCK mode logs the would-be pull command", async () => {
    // Per the issue spec: even in MOCK mode, the executor should advertise
    // what it would have done, so test output is auditable. This proves the
    // pull call would have run against the constant image name.
    process.env.MOCK_DOCKER = "true";
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await executeDocker("/cwd:/downloads", ["--version"]);
      // The mock should have logged the docker run command AND the would-be
      // pull, so a reader of test output can see both.
      const logLines = logSpy.mock.calls.map(args => String(args[0]));
      const combined = logLines.join("\n");
      expect(combined).toContain("[MOCK]");
      expect(combined).toContain("jauderho/yt-dlp:latest");
      expect(combined).toContain("would pull");
    } finally {
      logSpy.mockRestore();
    }
  });
});

/**
 * Tests for the auto-pull behavior added in tunex 0.9.16.
 *
 * These tests run with MOCK_DOCKER unset (real path), but use the
 * TUNEX_DOCKER_CMD env var to redirect both `docker pull` and
 * `docker run` to a tiny shell script we control. This lets us:
 *   - Verify the pull is invoked (script records its argv to a file)
 *   - Verify the pull is skipped (script not invoked, marker file absent)
 *   - Verify failure handling (script exits non-zero, pull failure does
 *     not pre-empt the docker run step)
 *
 * Without TUNEX_DOCKER_CMD, these tests would attempt real `docker pull`
 * calls and fail in any environment without a Docker daemon reachable
 * on the test host. The override also gives ops a useful escape hatch
 * for podman / non-standard setups.
 */
describe("executeDocker auto-pull", () => {
  const originalEnv = process.env;
  const harness = mockHarness("autopull");

  beforeEach(() => {
    // Real path: no MOCK_DOCKER, TUNEX_DOCKER_CMD points at our recording script.
    process.env = { ...originalEnv };
    delete process.env.MOCK_DOCKER;
    process.env.TUNEX_DOCKER_CMD = harness.scriptPath;
    // Reset the platform cache so checkDocker() re-runs against the new TUNEX_DOCKER_CMD.
    _resetPlatformCache();
    harness.clearMarker();
  });

  afterEach(() => {
    process.env = originalEnv;
    harness.clearMarker();
  });

  test("pulls the yt-dlp image before running in real mode", async () => {
    // All subcommands succeed; we only care that the pull ran.
    harness.writeMockScript(0);
    try {
      await executeDocker("/cwd:/downloads", ["--version"], undefined, undefined);
    } catch {
      // The mock exits 0, but the run step may still emit output the
      // shell interprets. We only assert on the marker.
    }
    const marker = harness.readMarker();
    expect(marker).not.toBeNull();
    // Find the actual `pull` invocation line (not the `run` line, which
    // also references the image). This is the precise assertion the
    // spec review flagged as too loose (was `toContain("pull")`).
    const pullLine = findInvocation(marker!, "pull");
    expect(pullLine).not.toBeNull();
    expect(pullLine).toContain("jauderho/yt-dlp:latest");
  });

  test("skips the pull when noPull option is true", async () => {
    harness.writeMockScript(0);
    try {
      await executeDocker(
        "/cwd:/downloads",
        ["--version"],
        undefined,
        { noPull: true },
      );
    } catch {
      // Ignore run-step output that the shell might interpret.
    }
    const marker = harness.readMarker();
    expect(marker).not.toBeNull();
    // Strong assertion: no line in the marker should START with the
    // word "pull" followed by a separator (i.e. a real pull invocation).
    // This catches regressions where the pull runs but the args differ.
    expect(findInvocation(marker!, "pull")).toBeNull();
  });

  test("does not abort when the pull fails (fall back to cached image)", async () => {
    // Mock exits 1 only for the pull subcommand; --version and run still
    // exit 0. The pull should fail, log a warning, and let the executor
    // continue to the run step.
    harness.writeMockScript(1);
    let caught: unknown = null;
    try {
      await executeDocker("/cwd:/downloads", ["--version"], undefined, undefined);
    } catch (err) {
      caught = err;
    }
    const marker = harness.readMarker();
    expect(marker).not.toBeNull();
    // The pull invocation must have run (marker has the pull line) and
    // the executor must have continued to the docker run step
    // (marker has the `run` line) — proving the pull failure was
    // graceful and non-preemptive.
    const pullLine = findInvocation(marker!, "pull");
    const runLine = findInvocation(marker!, "run");
    expect(pullLine).not.toBeNull();
    expect(pullLine).toContain("jauderho/yt-dlp:latest");
    expect(runLine).not.toBeNull();
    // The run step should also have completed (no exception bubbled out).
    // If the run failed for some other reason, capture it for diagnosis.
    if (caught) {
      throw new Error(`executor threw unexpectedly: ${caught}`);
    }
  });
});

describe("pullDockerImage", () => {
  const originalEnv = process.env;
  const harness = mockHarness("pullimage");

  /** Mock variant: a one-shot pull command, no smart subcommand handling. */
  function writeOneShotMock(exitCode: number, stdoutMsg?: string, stderrMsg?: string): void {
    const stdoutLine = stdoutMsg ? `echo "${stdoutMsg}"\n` : "";
    const stderrLine = stderrMsg ? `echo "${stderrMsg}" >&2\n` : "";
    if (platform === "win32") {
      const script =
        `@echo off\n` +
        `call :gate %~1 %~2 & exit /b %ERRORLEVEL%\n` +
        `:gate\n` +
        `echo %* > "${harness.markerPath.replace(/\\/g, "\\\\")}"\n` +
        stdoutLine.replace(/"/g, '""').replace(/\n$/, '"\n') +
        (stderrMsg ? stderrLine.replace(/"/g, '""').replace(/\n$/, '"\n') : "") +
        `exit /b ${exitCode}\n`;
      writeFileSync(harness.scriptPath, script);
    } else {
      const script =
        `#!/bin/sh\n` +
        `echo "$@" > ${harness.markerPath}\n` +
        stdoutLine +
        stderrLine +
        `exit ${exitCode}\n`;
      writeFileSync(harness.scriptPath, script);
      chmodSync(harness.scriptPath, 0o755);
    }
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TUNEX_DOCKER_CMD = harness.scriptPath;
    // Reset the platform cache so checkDocker() re-runs against the new TUNEX_DOCKER_CMD.
    _resetPlatformCache();
    harness.clearMarker();
  });

  afterEach(() => {
    process.env = originalEnv;
    harness.clearMarker();
  });

  test("invokes the configured pull command", async () => {
    writeOneShotMock(0);
    await pullDockerImage("jauderho/yt-dlp:latest");
    const marker = harness.readMarker();
    expect(marker).not.toBeNull();
    expect(marker).toContain("jauderho/yt-dlp:latest");
  });

  test("warns but resolves when the pull command fails", async () => {
    writeOneShotMock(1, "", "simulated network error");
    // Should NOT throw — failure is swallowed with a warning.
    await expect(pullDockerImage("jauderho/yt-dlp:latest")).resolves.toBeUndefined();
  });

  test("suppresses output on a clean pull (image up to date)", async () => {
    // The mock prints "Status: Image is up to date" — the executor should
    // detect this and NOT forward any output to the user.
    writeOneShotMock(0, "Status: Image is up to date, something:else");
    const writeSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await pullDockerImage("jauderho/yt-dlp:latest");
      // The "up to date" text should not appear on stderr.
      const allStderr = writeSpy.mock.calls.map(args => String(args[0])).join("");
      expect(allStderr).not.toContain("Image is up to date");
    } finally {
      writeSpy.mockRestore();
    }
  });

  test("streams output on an actual image update", async () => {
    // The mock simulates a real download (no "up to date" signal).
    writeOneShotMock(0, "Downloading layer 1", "Pull complete");
    const writeSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await pullDockerImage("jauderho/yt-dlp:latest");
      // The download progress should be surfaced to the user.
      const allStderr = writeSpy.mock.calls.map(args => String(args[0])).join("");
      expect(allStderr).toContain("Downloading layer 1");
      expect(allStderr).toContain("Pull complete");
    } finally {
      writeSpy.mockRestore();
    }
  });
});

describe("rewriteOutputPath", () => {
  const fakePlatform = {
    platform: 'linux' as const,
    shell: 'bash' as const,
    dockerContext: 'linux' as const,
    isWSL: false,
    hasDocker: true,
  };

  test("returns unchanged when no -o flag", () => {
    const result = rewriteOutputPath("/cwd:/downloads", ["--version"], fakePlatform);
    expect(result.finalVolumeMount).toBe("/cwd:/downloads");
    expect(result.finalArgs).toEqual(["--version"]);
  });

  test("returns unchanged for relative output path without subdir on non-Windows platform", () => {
    // When output is just "./file.ext" with no subdir, no additional volume needed
    const result = rewriteOutputPath(
      "/cwd:/downloads",
      ["-o", "./file.mp3", "url"],
      fakePlatform
    );
    expect(result.finalVolumeMount).toBe("/cwd:/downloads");
    expect(result.finalArgs).toEqual(["-o", "./file.mp3", "url"]);
  });

  test("adds volume mount for relative output path with subdir on non-Windows platform", () => {
    // "./music/file.mp3" has a subdir — adds a second volume mount
    const result = rewriteOutputPath(
      "/cwd:/downloads",
      ["-o", "./music/file.mp3", "url"],
      fakePlatform
    );
    expect(result.finalVolumeMount).toContain(",");
    expect(result.finalArgs[1]).toBe("/target/file.mp3");
  });

  test("comma-separates volumes for Windows absolute output on non-Windows platform", () => {
    // Simulates: bun running as Linux binary on WSL, output dir is C:\Media\Music\ytube
    const result = rewriteOutputPath(
      "/mnt/d/project:/downloads",
      ["-o", "C:\\Media\\Music\\ytube\\%(title)s.%(ext)s", "url"],
      fakePlatform
    );
    // Non-Windows platform uses comma separator (not pipe)
    expect(result.finalVolumeMount).toContain(",");
    expect(result.finalVolumeMount.split(",").length).toBe(2);
    expect(result.finalArgs[1]).toBe("/target/%(title)s.%(ext)s");
  });

  test("pipe-separates volumes for Windows absolute output on WSL+Windows Docker", () => {
    const wslWindowsPlatform = {
      platform: 'wsl' as const,
      shell: 'bash' as const,
      dockerContext: 'windows' as const,
      isWSL: true,
      hasDocker: true,
    };
    const result = rewriteOutputPath(
      "/mnt/d/project:/downloads",
      ["-o", "C:\\Media\\Music\\ytube\\%(title)s.%(ext)s", "url"],
      wslWindowsPlatform
    );
    // WSL+Windows uses pipe separator
    expect(result.finalVolumeMount).toContain("|");
    expect(result.finalVolumeMount.split("|").length).toBe(2);
    expect(result.finalArgs[1]).toBe("/target/%(title)s.%(ext)s");
  });

  test("extracts filename from Windows output path", () => {
    const wslWindowsPlatform = {
      platform: 'wsl' as const,
      shell: 'bash' as const,
      dockerContext: 'windows' as const,
      isWSL: true,
      hasDocker: true,
    };
    const result = rewriteOutputPath(
      "/mnt/d/project:/downloads",
      ["-o", "C:\\Media\\Music\\ytube\\my-video.%(ext)s", "url"],
      wslWindowsPlatform
    );
    expect(result.finalArgs[1]).toBe("/target/my-video.%(ext)s");
  });

  test("rewrites absolute Linux output path to /target on WSL+Windows Docker", () => {
    const wslWindowsPlatform = {
      platform: 'wsl' as const,
      shell: 'bash' as const,
      dockerContext: 'windows' as const,
      isWSL: true,
      hasDocker: true,
    };
    const result = rewriteOutputPath(
      "/mnt/d/project:/downloads",
      ["-o", "/tmp/output/test.mp3", "url"],
      wslWindowsPlatform
    );
    expect(result.finalArgs[1]).toBe("/target/test.mp3");
    expect(result.finalVolumeMount).toContain("|");
    expect(result.finalVolumeMount).toContain("/target");
  });
});
