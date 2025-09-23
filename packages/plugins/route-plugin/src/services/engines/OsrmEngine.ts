import type { NetworkPortLike, RoutingEngine } from './types.js';

type Coordinate = [number, number];

export interface OsrmOptions {
  baseUrl?: string;
  osrmBaseUrl?: string;
  profile: 'car' | 'bike' | 'foot' | 'truck';
  geometries?: 'geojson' | 'polyline';
  overview?: 'full' | 'simplified' | 'false';
  headers?: Record<string, string>;
}

interface AuthNotificationPayload {
  resource: string;
  provider: string;
  hint?: string;
}

interface AuthNotificationRegistry {
  onAuthRequired?(payload: AuthNotificationPayload): void;
  getInstance?(): unknown;
}

export class OsrmEngine implements RoutingEngine {
  constructor(private readonly net: NetworkPortLike) {}

  async route(points: Coordinate[], options: OsrmOptions) {
    const base = trimTrailingSlash((options.baseUrl ?? options.osrmBaseUrl ?? '').trim());
    if (!base) throw new Error('OSRM baseUrl is required');

    const profile = options.profile || 'car';
    const coordinates = points.map((p) => `${p[0]},${p[1]}`).join(';');
    const params = new URLSearchParams({
      geometries: options.geometries || 'geojson',
      overview: options.overview || 'full',
    });
    const url = `${base}/route/v1/${profile}/${coordinates}?${params.toString()}`;
    const res = await this.net.get(url, { headers: options.headers });

    if (res.status === 401 || res.status === 403) {
      const registry = resolveAuthRegistry();
      registry?.onAuthRequired?.({
        resource: url,
        provider: 'osrm',
        hint: 'Authorization header required',
      });
      throw new Error(`OSRM auth required: ${res.status}`);
    }

    if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`);

    const text = new TextDecoder().decode(await res.arrayBuffer());
    const payload: unknown = JSON.parse(text);
    const { distance, duration, coordinates: line } = extractOsrmRoute(payload);
    return { line, distance_m: distance, duration_s: duration };
  }
}

function resolveAuthRegistry(): AuthNotificationRegistry | undefined {
  const globalRecord = globalThis as Record<string, unknown>;
  const candidates: unknown[] = [
    globalRecord.AuthNotificationRegistry,
    globalRecord.authNotificationRegistry,
    globalRecord.authRegistry,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isAuthRegistry(candidate)) return candidate;
    if (typeof candidate === 'object' && candidate !== null) {
      const maybeFactory = candidate as { getInstance?: () => unknown };
      if (typeof maybeFactory.getInstance === 'function') {
        const instance = maybeFactory.getInstance();
        if (isAuthRegistry(instance)) return instance;
      }
    }
  }
  return undefined;
}

function isAuthRegistry(value: unknown): value is AuthNotificationRegistry {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.onAuthRequired === 'function';
}

function extractOsrmRoute(payload: unknown): { distance: number; duration?: number; coordinates: Coordinate[] } {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('OSRM response was not an object');
  }
  const record = payload as Record<string, unknown>;
  const routes = Array.isArray(record.routes) ? record.routes : undefined;
  if (!routes || routes.length === 0) {
    throw new Error('OSRM response did not include routes');
  }

  for (const routeCandidate of routes) {
    const routeRecord = routeCandidate as Record<string, unknown>;
    const distance = toFiniteNumber(routeRecord.distance);
    if (distance === undefined) continue;
    const duration = toFiniteNumber(routeRecord.duration);

    const geometry = routeRecord.geometry;
    const coordinatesCandidate = typeof geometry === 'object' && geometry !== null
      ? (geometry as Record<string, unknown>).coordinates
      : geometry;
    const coordinates = toCoordinatePairs(coordinatesCandidate);
    if (!coordinates) continue;

    return { distance, duration, coordinates };
  }

  throw new Error('OSRM response did not include a usable route');
}

function toCoordinatePairs(candidate: unknown): Coordinate[] | undefined {
  if (!Array.isArray(candidate)) return undefined;
  const pairs: Coordinate[] = [];
  for (const item of candidate) {
    if (!Array.isArray(item) || item.length < 2) return undefined;
    const lon = toFiniteNumber(item[0]);
    const lat = toFiniteNumber(item[1]);
    if (lon === undefined || lat === undefined) return undefined;
    pairs.push([lon, lat]);
  }
  return pairs.length >= 2 ? pairs : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}
