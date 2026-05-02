import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { isValidLocalPath, parseLocalPath } from "../paths.js";

describe("isValidLocalPath", () => {
  describe("windows platform", () => {
    const platform = "windows" as const;

    describe("absolute Windows paths", () => {
      test.each([
        ["C:\\path\\to\\videos", true],
        ["D:/path/to/videos", true],
        ["E:\\Videos\\music", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("relative paths (unix-style)", () => {
      beforeEach(() => {
        process.cwd = () => "C:\\dev\\projects\\tunex";
      });

      test.each([
        ["./output", true],
        [".\\output", true],
        ["output", true],
        ["../output", true],
        ["./videos/test.mp4", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("home-relative paths", () => {
      beforeEach(() => {
        process.env.HOME = "C:\\Users\\TestUser";
      });

      afterEach(() => {
        delete process.env.HOME;
      });

      test.each([
        ["~/output", true],
        ["~/Videos/test.mp4", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("absolute unix-style paths", () => {
      test.each([
        ["/absolute/path", true],
        ["/mnt/c/path", false],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("invalid inputs", () => {
      test.each([
        ["", false],
        ["   ", false],
        ["https://youtube.com/watch?v=abc", false],
        ["http://example.com", false],
      ])("'%s' should be invalid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });
  });

  describe("wsl platform", () => {
    const platform = "wsl" as const;

    describe("WSL mount paths", () => {
      test.each([
        ["/mnt/c/path/to/videos", true],
        ["/mnt/d/videos", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("relative paths", () => {
      beforeEach(() => {
        process.cwd = () => "/home/user/projects";
      });

      test.each([
        ["./output", true],
        ["output", true],
        ["../output", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("home-relative paths", () => {
      beforeEach(() => {
        process.env.HOME = "/home/user";
      });

      afterEach(() => {
        delete process.env.HOME;
      });

      test.each([
        ["~/output", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("absolute unix paths", () => {
      test.each([
        ["/absolute/path", true],
        ["/home/user/videos", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("invalid inputs", () => {
      test.each([
        ["C:\\path\\to\\videos", false],
        ["D:/videos", false],
        ["", false],
        ["   ", false],
        ["https://youtube.com/watch?v=abc", false],
      ])("'%s' should be invalid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });
  });

  describe("linux platform", () => {
    const platform = "linux" as const;

    describe("relative paths", () => {
      beforeEach(() => {
        process.cwd = () => "/home/user/projects";
      });

      test.each([
        ["./output", true],
        ["output", true],
        ["../output", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("home-relative paths", () => {
      beforeEach(() => {
        process.env.HOME = "/home/user";
      });

      afterEach(() => {
        delete process.env.HOME;
      });

      test.each([
        ["~/output", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("absolute unix paths", () => {
      test.each([
        ["/absolute/path", true],
        ["/home/user/videos", true],
      ])("'%s' should be valid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("WSL mount paths", () => {
      test.each([
        ["/mnt/c/path/to/videos", false],
      ])("'%s' should be invalid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });

    describe("invalid inputs", () => {
      test.each([
        ["C:\\path\\to\\videos", false],
        ["", false],
        ["   ", false],
        ["https://youtube.com/watch?v=abc", false],
      ])("'%s' should be invalid", (path, expected) => {
        expect(isValidLocalPath(path, platform)).toBe(expected);
      });
    });
  });
});

describe("parseLocalPath", () => {
  describe("type classification", () => {
    test("classifies C:\\style as windows", () => {
      const result = parseLocalPath("C:\\path\\to\\videos", "windows");
      expect(result?.type).toBe("windows");
    });

    test("classifies D:/style as windows", () => {
      const result = parseLocalPath("D:/path/to/videos", "windows");
      expect(result?.type).toBe("windows");
    });

    test("classifies /mnt/c/style as wsl-host", () => {
      const result = parseLocalPath("/mnt/c/path/to/videos", "wsl");
      expect(result?.type).toBe("wsl-host");
    });

    test("classifies ~/style as unix-native", () => {
      process.env.HOME = "/home/user";
      const result = parseLocalPath("~/videos", "linux");
      expect(result?.type).toBe("unix-native");
      delete process.env.HOME;
    });

    test("classifies ./style as unix-relative", () => {
      const result = parseLocalPath("./output", "windows");
      expect(result?.type).toBe("unix-relative");
    });

    test("classifies bare word as unix-relative", () => {
      const result = parseLocalPath("output", "linux");
      expect(result?.type).toBe("unix-relative");
    });

    test("classifies /absolute as unix-native", () => {
      const result = parseLocalPath("/absolute/path", "linux");
      expect(result?.type).toBe("unix-native");
    });
  });

  describe("null handling", () => {
    test("returns null for empty string", () => {
      expect(parseLocalPath("", "windows")).toBeNull();
    });

    test("returns null for whitespace only", () => {
      expect(parseLocalPath("   ", "windows")).toBeNull();
    });

    test("returns null for URL", () => {
      expect(parseLocalPath("https://youtube.com/watch", "windows")).toBeNull();
    });
  });
});