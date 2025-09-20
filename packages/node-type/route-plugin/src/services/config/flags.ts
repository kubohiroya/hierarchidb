import { readRuntimeEnvValue } from '@hierarchidb/util';

export function isFlagEnabled(name: string, fallback = false): boolean {
  const value = readFlagValue(name);
  if (value === undefined) return fallback;
  const normalized = value.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'enabled';
}

function readFlagValue(name: string): string | undefined {
  const local = (() => {
    if (typeof localStorage === 'undefined') return undefined;
    try {
      return localStorage.getItem(name) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  if (local !== undefined) return local;

  const globalRecord = globalThis as Record<string, unknown>;
  const globalValue = globalRecord[name];
  if (globalValue != null) return String(globalValue);

  const envValue = readRuntimeEnvValue(name, { prefixes: [''] });
  if (envValue !== undefined) return envValue;

  return undefined;
}
