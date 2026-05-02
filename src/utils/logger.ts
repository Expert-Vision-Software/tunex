import { appendFileSync } from 'fs';

export interface LoggerOptions {
  logFile?: string;
}

export class Logger {
  private logFile: string | null;
  private successCount = 0;
  private failureCount = 0;

  constructor(opts?: LoggerOptions) {
    this.logFile = opts?.logFile ?? null;
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] ${message}`;
    console.log(formatted);
    if (this.logFile) {
      appendFileSync(this.logFile, formatted + '\n');
    }
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  success(message: string): void {
    this.log('SUCCESS', message);
    this.successCount++;
  }

  error(message: string): void {
    this.log('ERROR', message);
    this.failureCount++;
  }

  warn(message: string): void {
    this.log('WARN', message);
  }

  printSummary(): void {
    const total = this.successCount + this.failureCount;
    console.log(`\n=== Summary: ${this.successCount}/${total} succeeded, ${this.failureCount} failed ===`);
    if (this.logFile) {
      const summary = `\n=== Summary: ${this.successCount}/${total} succeeded, ${this.failureCount} failed ===\n`;
      appendFileSync(this.logFile, summary);
    }
  }
}

export function createLogger(opts?: LoggerOptions): Logger {
  return new Logger(opts);
}