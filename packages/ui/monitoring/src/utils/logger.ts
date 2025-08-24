export function devWarn(message: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[ui-monitoring] ${message}`, ...args);
  }
}

export function devLog(message: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[ui-monitoring] ${message}`, ...args);
  }
}

export function devError(message: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ui-monitoring] ${message}`, ...args);
  }
}