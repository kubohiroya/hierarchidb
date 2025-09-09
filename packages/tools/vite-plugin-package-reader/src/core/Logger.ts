import pc from 'picocolors';
import type { LoggerOptions, LogLevel } from '../types';

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private colors: boolean;

  private static readonly levelPriority: Record<LogLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.prefix = options.prefix ?? '[PackageReader]';
    this.colors = options.colors ?? true;
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.levelPriority[level] <= Logger.levelPriority[this.level];
  }

  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().split('T')[1]?.split('.')[0] || '';
    const prefix = this.colors && pc.gray ? pc.gray(this.prefix) : this.prefix;
    const time = this.colors && pc.gray ? pc.gray(timestamp) : timestamp;

    let levelTag: string;
    if (this.colors) {
      switch (level) {
        case 'error':
          levelTag = pc.red('ERROR');
          break;
        case 'warn':
          levelTag = pc.yellow('WARN');
          break;
        case 'info':
          levelTag = pc.blue('INFO');
          break;
        case 'debug':
          levelTag = pc.gray('DEBUG');
          break;
        default:
          levelTag = level.toUpperCase();
      }
    } else {
      levelTag = level.toUpperCase();
    }

    return `${prefix} ${time} ${levelTag} ${message}`;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message), ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message), ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}