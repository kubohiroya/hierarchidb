type ViteEnv = ImportMeta & { env: { MODE?: string; DEV?: boolean } };
type NodeProcess = { env?: Record<string, string | undefined> };

const viteEnv = (import.meta as ViteEnv | undefined)?.env;
const globalProcess =
  typeof globalThis === 'object' && globalThis !== null && 'process' in globalThis
    ? (globalThis as { process?: NodeProcess }).process
    : undefined;
const nodeEnv = globalProcess?.env?.NODE_ENV;

const ENABLED = viteEnv?.DEV ?? nodeEnv !== 'production';

export function devLog(...args: unknown[]): void {
  if (ENABLED) console.log(...args);
}

export function devError(...args: unknown[]): void {
  if (ENABLED) console.error(...args);
}

export function devWarn(...args: unknown[]): void {
  if (ENABLED) console.warn(...args);
}
