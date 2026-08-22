/**
 * Runtime environment helpers with safe fallbacks for browser, worker, and Node contexts.
 *
 * These utilities avoid referencing the global `process` identifier directly so that
 * browser-delivered bundles remain free of Node-specific globals while still allowing
 * tests and tooling to provide overrides via `globalThis.process.env` or import.meta.env.
 */

type RuntimeEnvRecord = Record<string, unknown>;

type EnvValue = string | boolean | number | null | undefined;

const PROCESS_KEY = 'process';
const ENV_KEY = 'env';
const GLOBAL_ENV_KEYS = ['__HDB_ENV__', '__HDB_RUNTIME_ENV__'];

const readImportMetaEnv = (): RuntimeEnvRecord | undefined => {
  try {
    const meta = import.meta as ImportMeta & { env?: RuntimeEnvRecord };
    if (meta && typeof meta.env === 'object' && meta.env) {
      return meta.env;
    }
  } catch {
    // Environments without import.meta (e.g., CommonJS tests) will land here.
  }
  return undefined;
};

const readNodeProcessEnv = (): RuntimeEnvRecord | undefined => {
  if (typeof globalThis === 'undefined') return undefined;
  const scope = globalThis as Record<string, unknown>;
  const maybeProcess = scope[PROCESS_KEY] as { [ENV_KEY]?: RuntimeEnvRecord } | undefined;
  const env = maybeProcess?.[ENV_KEY];
  if (env && typeof env === 'object') {
    return env;
  }
  return undefined;
};

const readExplicitGlobalEnv = (): RuntimeEnvRecord | undefined => {
  if (typeof globalThis === 'undefined') return undefined;
  const scope = globalThis as Record<string, unknown>;
  for (const key of GLOBAL_ENV_KEYS) {
    const candidate = scope[key];
    if (candidate && typeof candidate === 'object') {
      return candidate as RuntimeEnvRecord;
    }
  }
  return undefined;
};

type EnvSource = () => RuntimeEnvRecord | undefined;

const ENV_SOURCES: EnvSource[] = [readExplicitGlobalEnv, readImportMetaEnv, readNodeProcessEnv];

export type ReadEnvOptions = {
  /**
   * Additional key prefixes to probe. Defaults to ['', 'VITE_'] to match Vite conventions.
   */
  prefixes?: string[];
};

const DEFAULT_PREFIXES = ['', 'VITE_'];

/**
 * Read an environment value by probing known sources (global hints, import.meta.env, process.env).
 */
export function readRuntimeEnvValue(key: string, options?: ReadEnvOptions): string | undefined {
  const prefixes = options?.prefixes ?? DEFAULT_PREFIXES;
  for (const getSource of ENV_SOURCES) {
    const record = getSource();
    if (!record) continue;
    for (const prefix of prefixes) {
      const lookupKey = prefix ? `${prefix}${key}` : key;
      const value = record[lookupKey];
      if (value != null) {
        return String(value);
      }
    }
  }
  return undefined;
}

export function readRuntimeEnvFlag(key: string, fallback = false): boolean {
  const raw = readRuntimeEnvValue(key);
  if (raw == null) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'on' ||
    normalized === 'enabled'
  ) {
    return true;
  }
  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'off' ||
    normalized === 'disabled'
  ) {
    return false;
  }
  return fallback;
}

export function readRuntimeEnvNumber(key: string): number | undefined {
  const raw = readRuntimeEnvValue(key, { prefixes: [''] });
  if (raw == null) return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

export function readRuntimeMode(): string | undefined {
  return (
    readRuntimeEnvValue('MODE', { prefixes: [''] }) ??
    readRuntimeEnvValue('NODE_ENV', { prefixes: [''] })
  );
}

export function mergeRuntimeEnv(overrides?: Record<string, EnvValue>): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const getSource of ENV_SOURCES) {
    const record = getSource();
    if (!record) continue;
    for (const [key, value] of Object.entries(record)) {
      if (value != null && merged[key] === undefined) {
        merged[key] = String(value);
      }
    }
  }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value != null) merged[key] = String(value);
    }
  }
  return merged;
}
