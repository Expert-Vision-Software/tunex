import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { ytVideoMp4 } from "../yt-video-mp4";
import { CommandOptions } from "../types";

describe("yt-video-mp4", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MOCK_DOCKER: "true" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("execute method exists and is callable", () => {
    expect(typeof ytVideoMp4.execute).toBe("function");
  });

  test("execute handles single video URL", async () => {
    const opts: CommandOptions = {
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    };
    await expect(ytVideoMp4.execute(opts)).resolves.toBeUndefined();
  });

  test("execute handles playlist URL", async () => {
    const opts: CommandOptions = {
      input: "https://www.youtube.com/playlist?list=PLrAXtmEr4O0F7C0C36p8KqR8bKQ8Z5x6y"
    };
    await expect(ytVideoMp4.execute(opts)).resolves.toBeUndefined();
  });

  test("execute handles array of URLs", async () => {
    const opts: CommandOptions = {
      input: [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=abc123"
      ]
    };
    await expect(ytVideoMp4.execute(opts)).resolves.toBeUndefined();
  });

  test("execute uses provided outputDir", async () => {
    const opts: CommandOptions = {
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      outputDir: "/downloads"
    };
    await expect(ytVideoMp4.execute(opts)).resolves.toBeUndefined();
  });

  test("execute handles continueOnError flag", async () => {
    const opts: CommandOptions = {
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      continueOnError: true
    };
    await expect(ytVideoMp4.execute(opts)).resolves.toBeUndefined();
  });

  test("has correct name and description", () => {
    expect(ytVideoMp4.name).toBe("yt-video-mp4");
    expect(ytVideoMp4.description).toBeTruthy();
  });
});