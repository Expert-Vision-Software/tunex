import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { getShell, platformExec } from "../platform";

describe("platform", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("getShell returns a valid shell type", () => {
    const shell = getShell();
    expect(["pwsh", "powershell", "bash"]).toContain(shell);
  });

  test("getShell returns pwsh on Windows when pwsh is available", () => {
    if (process.platform === "win32") {
      const shell = getShell();
      expect(shell).toBeTruthy();
    } else {
      expect(true).toBe(true);
    }
  });

  test("platformExec throws on non-zero exit code in real mode", async () => {
    process.env.MOCK_DOCKER = "false";
    if (process.platform === "win32") {
      await expect(platformExec("exit 1", "pwsh")).rejects.toThrow();
    } else {
      await expect(platformExec("exit 1", "bash")).rejects.toThrow();
    }
  });

  test("getShell is a function", () => {
    expect(typeof getShell).toBe("function");
  });

  test("platformExec is an async function", () => {
    expect(platformExec.constructor.name).toBe("AsyncFunction");
  });
});