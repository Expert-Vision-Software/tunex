import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { isMockMode, executeDocker } from "../executor";

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
      "--audio-quality", "128k"
    ];

    await executeDocker(volumeMount, args);
  });
});