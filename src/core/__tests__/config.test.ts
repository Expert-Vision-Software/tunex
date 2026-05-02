import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "../config";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test.skip("loadConfig function exists", () => {
    expect(typeof loadConfig).toBe("function");
  });
});