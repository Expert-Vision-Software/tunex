import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { isMockMode, executeDocker, rewriteOutputPath } from "../executor";

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
});
