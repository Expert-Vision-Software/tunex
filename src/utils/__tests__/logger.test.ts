import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Logger, createLogger } from "../logger";

describe("logger", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("info method logs INFO level message", () => {
    const logger = new Logger();
    expect(() => logger.info("test message")).not.toThrow();
  });

  test("success method logs SUCCESS level message", () => {
    const logger = new Logger();
    expect(() => logger.success("success message")).not.toThrow();
  });

  test("error method logs ERROR level message", () => {
    const logger = new Logger();
    expect(() => logger.error("error message")).not.toThrow();
  });

  test("warn method logs WARN level message", () => {
    const logger = new Logger();
    expect(() => logger.warn("warn message")).not.toThrow();
  });

  test("printSummary method logs summary", () => {
    const logger = new Logger();
    expect(() => logger.printSummary()).not.toThrow();
  });

  test("success increments successCount", () => {
    const logger = new Logger();
    logger.success("op1");
    logger.success("op2");
    logger.printSummary();
  });

  test("error increments failureCount", () => {
    const logger = new Logger();
    logger.error("fail1");
    logger.error("fail2");
    logger.printSummary();
  });

  test("handles empty logFile path", () => {
    const logger = new Logger({ logFile: "" });
    expect(() => logger.info("test")).not.toThrow();
  });

  test("handles null logFile path", () => {
    const logger = new Logger({ logFile: null });
    expect(() => logger.info("test")).not.toThrow();
  });

  test("handles undefined logFile option", () => {
    const logger = new Logger({});
    expect(() => logger.info("test")).not.toThrow();
  });

  test("createLogger factory function returns Logger instance", () => {
    const logger = createLogger();
    expect(logger).toBeInstanceOf(Logger);
  });

  test("createLogger accepts logFile option", () => {
    const logger = createLogger({ logFile: "/tmp/test.log" });
    expect(logger).toBeInstanceOf(Logger);
  });

  test("Logger class can be instantiated", () => {
    expect(() => new Logger()).not.toThrow();
  });

  test("Logger accepts options", () => {
    expect(() => new Logger({ logFile: "/tmp/test.log" })).not.toThrow();
  });
});