import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { bulkAudioExtract } from "../bulk-audio-extract";
import { CommandOptions } from "../types";

describe("bulk-audio-extract", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MOCK_DOCKER: "true" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("execute method exists and is callable", () => {
    expect(typeof bulkAudioExtract.execute).toBe("function");
  });

  test("execute handles single folder input", async () => {
    const opts: CommandOptions = {
      input: "/videos"
    };
    await expect(bulkAudioExtract.execute(opts)).resolves.toBeUndefined();
  });

  test("execute handles array of folder inputs", async () => {
    const opts: CommandOptions = {
      input: ["/videos", "/music"]
    };
    await expect(bulkAudioExtract.execute(opts)).resolves.toBeUndefined();
  });

  test("execute uses provided outputDir", async () => {
    const opts: CommandOptions = {
      input: "/videos",
      outputDir: "/output"
    };
    await expect(bulkAudioExtract.execute(opts)).resolves.toBeUndefined();
  });

  test("execute handles continueOnError flag", async () => {
    const opts: CommandOptions = {
      input: "/videos",
      continueOnError: true
    };
    await expect(bulkAudioExtract.execute(opts)).resolves.toBeUndefined();
  });

  test("has correct name and description", () => {
    expect(bulkAudioExtract.name).toBe("bulk-audio-extract");
    expect(bulkAudioExtract.description).toBeTruthy();
  });
});