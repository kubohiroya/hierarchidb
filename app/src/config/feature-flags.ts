// UI-side feature flags with sensible defaults toward the latest implementation.
// Reads from globalThis.FEATURE_FLAGS (preferred) and falls back to environment variables if needed.

type FeatureFlagContainer = {
  FEATURE_FLAGS?: Record<string, unknown>;
};

type EnvValue = string | boolean | number | undefined;
type EnvRecord = Record<string, EnvValue>;

function readFlag(key: string): string | undefined {
  const globalValue = readFromGlobalFlags(key);
  if (globalValue != null) return globalValue;

  const metaValue = readFromImportMetaEnv(key);
  if (metaValue != null) return metaValue;

  return readFromProcessEnv(key);
}

function readFromGlobalFlags(key: string): string | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const candidate = globalThis as FeatureFlagContainer;
  const value = candidate.FEATURE_FLAGS?.[key];
  return value == null ? undefined : String(value);
}

function readFromImportMetaEnv(key: string): string | undefined {
  try {
    const env = import.meta.env as unknown;
    if (env && typeof env === 'object') {
      const record = env as EnvRecord;
      const direct = record[key];
      if (direct != null) return String(direct);
      const prefixed = record[`VITE_${key}`];
      if (prefixed != null) return String(prefixed);
    }
  } catch {
    // Some test environments do not define import.meta.env
  }
  return undefined;
}

function readFromProcessEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const value = process.env?.[key] ?? process.env?.[`VITE_${key}`];
  return value == null ? undefined : String(value);
}

function flagOn(key: string, def = false): boolean {
  const raw = readFlag(key);
  if (raw == null) return !!def;
  const s = String(raw).toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'enabled';
}

export const UI_FLAGS = {} as const;
