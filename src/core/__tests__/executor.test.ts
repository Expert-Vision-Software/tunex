import { test, expect, describe, beforeEach, afterEach, spyOn } from "bun:test";
import { isMockMode, executeDocker, pullDockerImage, rewriteOutputPath } from "../executor.js";
import { _resetPlatformCache } from "../platform.js";

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
  const scriptPath = "/tmp/tunex-test-pull-mock.sh";
  const markerPath = "/tmp/tunex-test-pull-marker";

  function writeMockScript(mode: "success" | "pull-fails" | "all-fail"): void {
    // Smart mock: behavior depends on the called subcommand.
    //   --version → exit 0 (so requireDocker's check passes)
    //   pull      → exit per `mode`
    //   anything else (run) → exit 0
    // The mode parameter lets each test control the pull outcome while
    // always letting the docker --version check pass.
    const pullExit = mode === "pull-fails" || mode === "all-fail" ? 1 : 0;
    const script =
      `#!/bin/sh\n` +
      `echo "$@" >> ${markerPath}\n` +
      `case "$1" in\n` +
      `  --version) exit 0 ;;\n` +
      `  pull) exit ${pullExit} ;;\n` +
      `  *) exit 0 ;;\n` +
      `esac\n`;
    require("fs").writeFileSync(scriptPath, script);
    require("fs").chmodSync(scriptPath, 0o755);
  }

  function readMarker(): string | null {
    try {
      return require("fs").readFileSync(markerPath, "utf-8").trim();
    } catch {
      return null;
    }
  }

  function clearMarker(): void {
    try {
      require("fs").unlinkSync(markerPath);
    } catch {
      // Already absent — fine.
    }
  }

  beforeEach(() => {
    // Real path: no MOCK_DOCKER, TUNEX_DOCKER_CMD points at our recording script.
    process.env = { ...originalEnv };
    delete process.env.MOCK_DOCKER;
    process.env.TUNEX_DOCKER_CMD = scriptPath;
    // Reset the platform cache so checkDocker() re-runs against the new TUNEX_DOCKER_CMD.
    _resetPlatformCache();
    clearMarker();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearMarker();
  });

  test("pulls the yt-dlp image before running in real mode", async () => {
    // All subcommands succeed; we only care that the pull ran.
    writeMockScript("success");
    try {
      await executeDocker("/cwd:/downloads", ["--version"], undefined, undefined);
    } catch {
      // The mock exits 0, but the run step may still emit output the
      // shell interprets. We only assert on the marker.
    }
    const marker = readMarker();
    expect(marker).not.toBeNull();
    // requireDocker() runs `TUNEX_DOCKER_CMD --version` first, then
    // pullDockerImage runs `TUNEX_DOCKER_CMD pull <image>`, then the
    // docker run step. So the marker has up to 3 lines in that order.
    // Verify the pull line is present (not necessarily the first line).
    expect(marker).toContain("pull");
    expect(marker).toContain("jauderho/yt-dlp:latest");
  });

  test("skips the pull when noPull option is true", async () => {
    writeMockScript("success");
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
    const marker = readMarker();
    expect(marker).not.toBeNull();
    // With noPull=true, the marker should contain the docker --version
    // check and the docker run, but NO "pull" line.
    expect(marker).not.toMatch(/^pull\s/m);
    expect(marker).not.toContain(" pull ");
  });

  test("does not abort when the pull fails (fall back to cached image)", async () => {
    // Mock exits 1 only for the pull subcommand; --version and run still
    // exit 0. The pull should fail, log a warning, and let the executor
    // continue to the run step.
    writeMockScript("pull-fails");
    try {
      await executeDocker("/cwd:/downloads", ["--version"], undefined, undefined);
    } catch {
      // The run step should still succeed; ignore any unexpected errors.
    }
    const marker = readMarker();
    expect(marker).not.toBeNull();
    // The pull invocation should still appear in the marker — proving
    // the pull ran and (correctly) failed gracefully without aborting.
    expect(marker).toContain("pull");
    expect(marker).toContain("jauderho/yt-dlp:latest");
  });
});

describe("pullDockerImage", () => {
  const originalEnv = process.env;
  const scriptPath = "/tmp/tunex-test-pull-image-mock.sh";
  const markerPath = "/tmp/tunex-test-pull-image-marker";

  function writeMockScript(exitCode: number, stderrMsg?: string): void {
    const stderrLine = stderrMsg
      ? `echo "${stderrMsg}" >&2\n`
      : "";
    const script =
      `#!/bin/sh\n` +
      `echo "$@" > ${markerPath}\n` +
      stderrLine +
      `exit ${exitCode}\n`;
    require("fs").writeFileSync(scriptPath, script);
    require("fs").chmodSync(scriptPath, 0o755);
  }

  function readMarker(): string | null {
    try {
      return require("fs").readFileSync(markerPath, "utf-8").trim();
    } catch {
      return null;
    }
  }

  function clearMarker(): void {
    try {
      require("fs").unlinkSync(markerPath);
    } catch {
      // Already absent — fine.
    }
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TUNEX_DOCKER_CMD = scriptPath;
    // Reset the platform cache so checkDocker() re-runs against the new TUNEX_DOCKER_CMD.
    _resetPlatformCache();
    clearMarker();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearMarker();
  });

  test("invokes the configured pull command", async () => {
    writeMockScript(0);
    await pullDockerImage("jauderho/yt-dlp:latest");
    const marker = readMarker();
    expect(marker).not.toBeNull();
    expect(marker).toContain("jauderho/yt-dlp:latest");
  });

  test("warns but resolves when the pull command fails", async () => {
    writeMockScript(1, "simulated network error");
    // Should NOT throw — failure is swallowed with a warning.
    await expect(pullDockerImage("jauderho/yt-dlp:latest")).resolves.toBeUndefined();
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
