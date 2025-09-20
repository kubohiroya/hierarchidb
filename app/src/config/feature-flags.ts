// UI-side feature flags with sensible defaults toward the latest implementation.
// Reads from globalThis.FEATURE_FLAGS (preferred) and falls back to environment variables if needed.

import { readRuntimeEnvValue } from '@hierarchidb/util';

type FeatureFlagContainer = {
  FEATURE_FLAGS?: Record<string, unknown>;
};

function readFlag(key: string): string | undefined {
  const globalValue = readFromGlobalFlags(key);
  if (globalValue != null) return globalValue;

  return readRuntimeEnvValue(key) ?? undefined;
}

function readFromGlobalFlags(key: string): string | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const candidate = globalThis as FeatureFlagContainer;
  const value = candidate.FEATURE_FLAGS?.[key];
  return value == null ? undefined : String(value);
}

function _flagOn(key: string, def = false): boolean {
  const raw = readFlag(key);
  if (raw == null) return !!def;
  const s = String(raw).toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'enabled';
}

export const UI_FLAGS = {} as const;
