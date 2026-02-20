import type { ThrottleOptions } from '~/services/net/ThrottledPort';
import { readRuntimeEnvValue } from '@hierarchidb/util';

type OsrmProfile = 'car' | 'bike' | 'foot' | 'truck';

export function getOsrmEngineDefaults(): { osrmBaseUrl?: string; osmProfile?: OsrmProfile } {
  const osrmBaseUrl = readConfigString('HIDB_OSRM_BASE_URL');
  const profile = readConfigString('HIDB_OSRM_PROFILE');
  const osmProfile = castProfile(profile) ?? 'car';
  return { osrmBaseUrl, osmProfile };
}

export function getOsrmThrottleDefaults(): ThrottleOptions {
  const rps = readPositiveNumber('HIDB_OSRM_RPS') ?? 1;
  const concurrency = readPositiveInteger('HIDB_OSRM_CONCURRENCY') ?? 1;
  return { rps, concurrency };
}

function readConfigString(key: string): string | undefined {
  const globalRecord = globalThis as Record<string, unknown>;
  const fromGlobal = readNonEmptyString(globalRecord[key]);
  if (fromGlobal) return fromGlobal;
  const envValue = readNonEmptyString(readRuntimeEnvValue(key, { prefixes: [''] }));
  if (envValue) return envValue;
  return undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function castProfile(value: string | undefined): OsrmProfile | undefined {
  switch (value?.toLowerCase()) {
    case 'car':
      return 'car';
    case 'bike':
      return 'bike';
    case 'foot':
      return 'foot';
    case 'truck':
      return 'truck';
    default:
      return undefined;
  }
}

function readPositiveNumber(key: string): number | undefined {
  const value = readConfigString(key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readPositiveInteger(key: string): number | undefined {
  const value = readPositiveNumber(key);
  if (value === undefined) return undefined;
  return Math.floor(value);
}
