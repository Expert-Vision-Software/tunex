import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { ytAudioOnly } from "../yt-audio-only";
import { CommandOptions } from "../types";

describe("yt-audio-only", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MOCK_DOCKER: "true" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("execute method exists and is callable", () => {
    expect(typeof ytAudioOnly.execute).toBe("function");
  });

  test("execute handles single URL input", async () => {
    const opts: CommandOptions = {
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    };
    await expect(ytAudioOnly.execute(opts)).resolves.toBeUndefined();
  });

  test("execute handles array of URLs", async () => {
    const opts: CommandOptions = {
      input: [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=abc123"
      ]
    };
    await expect(ytAudioOnly.execute(opts)).resolves.toBeUndefined();
  });

  test("execute uses provided outputDir", async () => {
    const opts: CommandOptions = {
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      outputDir: "/downloads"
    };
    await expect(ytAudioOnly.execute(opts)).resolves.toBeUndefined();
  });

  test("execute handles continueOnError flag", async () => {
    const opts: CommandOptions = {
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      continueOnError: true
    };
    await expect(ytAudioOnly.execute(opts)).resolves.toBeUndefined();
  });

  test("has correct name and description", () => {
    expect(ytAudioOnly.name).toBe("yt-audio-only");
    expect(ytAudioOnly.description).toBeTruthy();
  });
});