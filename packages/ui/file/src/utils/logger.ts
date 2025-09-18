const ENV = (typeof globalThis !== 'undefined' && typeof (globalThis as any).process !== 'undefined'
  ? ((globalThis as any).process.env?.NODE_ENV as string | undefined)
  : undefined) || 'development';
const ENABLED = ENV !== 'production';

export function devLog(...args: unknown[]): void {
  if (ENABLED) console.log(...args);
}

export function devError(...args: unknown[]): void {
  if (ENABLED) console.error(...args);
}

export function devWarn(...args: unknown[]): void {
  if (ENABLED) console.warn(...args);
}
