import {
  createRouteEngineCapability,
  type RouteEngineCapability,
  type RoutingEngine,
} from '@hierarchidb/route-engine';
import type { NetworkPortLike } from './types.js';

type Coordinate = [number, number];

export interface OsrmOptions {
  baseUrl?: string;
  osrmBaseUrl?: string;
  profile: 'car' | 'bike' | 'foot' | 'truck';
  geometries: 'geojson' | 'polyline';
  overview: 'full' | 'simplified' | 'false';
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
  readonly capability: RouteEngineCapability = createRouteEngineCapability({
    engineId: 'osrm',
    engineVersion: 'osrm-route-v1',
    method: 'osm_route',
    acceptedRouteModes: ['road', 'highway'],
    networkRequirement: 'required',
    supportsWaypoints: true,
  });

  constructor(private readonly net: NetworkPortLike) {}

  async route(points: [number, number][], options?: unknown) {
    const osrmOptions = requireOsrmOptions(options);
    const baseSource = osrmOptions.baseUrl ?? osrmOptions.osrmBaseUrl;
    if (baseSource === undefined) throw new Error('OSRM baseUrl is required');
    const base = trimTrailingSlash(baseSource.trim());
    if (!base) throw new Error('OSRM baseUrl is required');

    const profile = osrmOptions.profile;
    const coordinates = points.map((p) => `${p[0]},${p[1]}`).join(';');
    const params = new URLSearchParams({
      geometries: osrmOptions.geometries,
      overview: osrmOptions.overview,
    });
    const url = `${base}/route/v1/${profile}/${coordinates}?${params.toString()}`;
    const res = await this.net.get(url, { headers: osrmOptions.headers });

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

function requireOsrmOptions(options: unknown): OsrmOptions {
  if (
    options === undefined ||
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new Error('OSRM options must be an object');
  }
  const source = options as Record<string, unknown>;
  const baseUrl = readOptionalNonEmptyString(source.baseUrl);
  const osrmBaseUrl = readOptionalNonEmptyString(source.osrmBaseUrl);
  if (!baseUrl && !osrmBaseUrl) throw new Error('OSRM baseUrl is required');
  const profile = requireOneOf('OSRM profile', source.profile, ['car', 'bike', 'foot', 'truck']);
  const geometries = requireOneOf('OSRM geometries', source.geometries, ['geojson', 'polyline']);
  const overview = requireOneOf('OSRM overview', source.overview, ['full', 'simplified', 'false']);
  const headers = requireOptionalHeaders(source.headers);
  return {
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(osrmBaseUrl === undefined ? {} : { osrmBaseUrl }),
    profile,
    geometries,
    overview,
    ...(headers === undefined ? {} : { headers }),
  };
}

function readOptionalNonEmptyString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('OSRM string option must be a non-empty string when provided');
  }
  return value.trim();
}

function requireOneOf<const T extends readonly string[]>(
  label: string,
  value: unknown,
  allowed: T
): T[number] {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}`);
  }
  return value as T[number];
}

function requireOptionalHeaders(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('OSRM headers must be an object when provided');
  }
  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof headerValue !== 'string') {
      throw new Error(`OSRM header ${key} must be a string`);
    }
    headers[key] = headerValue;
  }
  return headers;
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

function extractOsrmRoute(payload: unknown): {
  distance: number;
  duration?: number;
  coordinates: Coordinate[];
} {
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
    const coordinatesCandidate =
      typeof geometry === 'object' && geometry !== null
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
