import type { ThrottleOptions } from '../net/ThrottledPort';

export function getOsrmEngineDefaults(): { osrmBaseUrl?: string; osmProfile?: 'car' | 'bike' | 'foot' | 'truck' } {
  const g: any = (globalThis as any);
  const env = (typeof process !== 'undefined' ? (process as any).env : undefined) || {};
  const osrmBaseUrl = g.HIDB_OSRM_BASE_URL || env.HIDB_OSRM_BASE_URL || undefined;
  const osmProfile = (g.HIDB_OSRM_PROFILE || env.HIDB_OSRM_PROFILE || 'car') as any;
  return { osrmBaseUrl, osmProfile };
}

export function getOsrmThrottleDefaults(): ThrottleOptions {
  const g: any = (globalThis as any);
  const env = (typeof process !== 'undefined' ? (process as any).env : undefined) || {};
  const rps = Number(g.HIDB_OSRM_RPS || env.HIDB_OSRM_RPS || 1);
  const concurrency = Number(g.HIDB_OSRM_CONCURRENCY || env.HIDB_OSRM_CONCURRENCY || 1);
  return { rps, concurrency };
}

