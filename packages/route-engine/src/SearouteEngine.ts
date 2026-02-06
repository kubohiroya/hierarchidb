import { readRuntimeEnvValue } from '@hierarchidb/util';
import type { RoutingEngine } from './RoutingEngine.js';

type Coordinate = [number, number];
type SeaRouteFunction = (
  from: Coordinate,
  to: Coordinate,
  options?: SeaRouteOptions | string,
) => Promise<SeaRouteResponse>;
type SeaRouteModule = SeaRouteFunction | SeaRouteObjectModule;
type SeaRouteObjectModule = { getSeaRoute?: SeaRouteFunction; default?: SeaRouteFunction };

interface SeaRouteOptions {
  units?: string;
  blockedAreas?: unknown;
  avoidCanals?: boolean;
  vesselSpeedKnots?: number;
  vesselSpeed?: number;
  speed_knots?: number;
  [key: string]: unknown;
}

interface SeaRouteProperties {
  distance?: unknown;
  length?: unknown;
  units?: string;
  unit?: string;
}

interface SeaRouteGeometry {
  type?: string;
  coordinates?: unknown;
}

interface SeaRouteResponse {
  geometry?: SeaRouteGeometry;
  coordinates?: unknown;
  line?: unknown;
  properties?: SeaRouteProperties;
  props?: SeaRouteProperties;
  units?: string;
  [key: string]: unknown;
}

type ImportMetaWithEnv = ImportMeta & { env?: Record<string, unknown> };

export class SearouteEngine implements RoutingEngine {
  private libPromise?: Promise<SeaRouteModule | undefined>;

  async route(
    points: Coordinate[],
    options?: unknown,
  ): Promise<{
    line: Coordinate[];
    distance_m: number;
    duration_s?: number;
  }> {
    const start = points[0];
    const end = points[points.length - 1];
    if (!start || !end) throw new Error('searoute requires at least two coordinates');

    const normalizedOptions = this.normalizeOptions(options as SeaRouteOptions | undefined);

    try {
      const module = await this.loadLib();
      if (module) {
        const fn = this.resolveApi(module);
        if (!fn) throw new Error('Unsupported searoute module shape');

        let response: SeaRouteResponse;
        try {
          response = await fn([start[0], start[1]], [end[0], end[1]], normalizedOptions);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const fallbackUnits = normalizedOptions ? this.unitsString(normalizedOptions) : undefined;
          if (fallbackUnits && /units/i.test(message)) {
            response = await fn([start[0], start[1]], [end[0], end[1]], fallbackUnits);
          } else {
            throw error;
          }
        }

        const line = this.extractLine(response);
        const distance_m = this.extractDistanceMeters(response, line);
        const duration_s = this.estimateDuration(distance_m, normalizedOptions);
        return { line, distance_m, duration_s };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`searoute-js unavailable, fallback to great-circle: ${message}`);
      }
    }

    const fallbackDistance = haversine(start[1], start[0], end[1], end[0]);
    const fallbackLine: Coordinate[] = [start, end];
    return { line: fallbackLine, distance_m: fallbackDistance };
  }

  private async loadLib(): Promise<SeaRouteModule | undefined> {
    if (!this.libPromise) {
      this.libPromise = (async () => {
        const tryLoad = async (name: string): Promise<SeaRouteModule | undefined> => {
          try {
            const mod: unknown = await import(/* @vite-ignore */ name);
            return isSeaRouteModule(mod) ? mod : undefined;
          } catch {
            return undefined;
          }
        };

        const forcedName = this.readPreferredPackageName();
        if (forcedName) {
          const forcedModule = await tryLoad(forcedName);
          if (forcedModule) return forcedModule;
        }

        const candidates = ['searoute', 'searoute-js'];
        for (const candidate of candidates) {
          const module = await tryLoad(candidate);
          if (module) return module;
        }
        return undefined;
      })();
    }
    return this.libPromise;
  }

  private readPreferredPackageName(): string | undefined {
    const fromImportMeta = (() => {
      try {
        const meta = import.meta as ImportMetaWithEnv;
        const value = meta.env?.VITE_ROUTE_SEAROUTE_PKG;
        return readNonEmptyString(value);
      } catch {
        return undefined;
      }
    })();

    if (fromImportMeta) return fromImportMeta;

    const envValue = readNonEmptyString(readRuntimeEnvValue('ROUTE_SEAROUTE_PKG', { prefixes: [''] }));
    if (envValue) return envValue;

    const globalValue = readNonEmptyString((globalThis as Record<string, unknown>).ROUTE_SEAROUTE_PKG);
    return globalValue;
  }

  private resolveApi(module: SeaRouteModule): SeaRouteFunction | undefined {
    if (typeof module === 'function') return module;
    if (isSeaRouteObjectModule(module) && typeof module.getSeaRoute === 'function') {
      return module.getSeaRoute.bind(module);
    }
    if (isSeaRouteObjectModule(module) && typeof module.default === 'function') {
      return module.default.bind(module);
    }
    return undefined;
  }

  private normalizeOptions(options: SeaRouteOptions | undefined): SeaRouteOptions | undefined {
    if (!options || typeof options !== 'object') return undefined;
    const source = options as Record<string, unknown>;
    const normalized: SeaRouteOptions = {};

    const units = readNonEmptyString(source.units);
    if (units) normalized.units = units;

    if ('blockedAreas' in source) normalized.blockedAreas = source.blockedAreas;
    if ('avoidCanals' in source) normalized.avoidCanals = Boolean(source.avoidCanals);

    const vesselSpeedKnots = toFiniteNumber(source.vesselSpeedKnots);
    if (vesselSpeedKnots !== undefined) normalized.vesselSpeedKnots = vesselSpeedKnots;

    const vesselSpeed = toFiniteNumber(source.vesselSpeed);
    if (vesselSpeed !== undefined) normalized.vesselSpeed = vesselSpeed;

    const speedKnots = toFiniteNumber(source.speed_knots);
    if (speedKnots !== undefined) normalized.speed_knots = speedKnots;

    for (const [key, value] of Object.entries(source)) {
      if (!(key in normalized)) normalized[key] = value;
    }

    return normalized;
  }

  private extractLine(result: SeaRouteResponse): Coordinate[] {
    const candidates = [
      result.geometry?.coordinates,
      result.coordinates,
      result.line,
    ];

    for (const candidate of candidates) {
      const line = toCoordinatePairs(candidate);
      if (line) return line;
    }
    throw new Error('searoute response did not include coordinates');
  }

  private extractDistanceMeters(result: SeaRouteResponse, line: Coordinate[]): number {
    let distance: number | undefined;
    const props = result.properties ?? result.props ?? {};
    const rawDistance = props.distance ?? props.length;
    const numeric = toFiniteNumber(rawDistance);
    const units = readNonEmptyString(props.units ?? props.unit ?? result.units)?.toLowerCase();

    if (numeric !== undefined && units) {
      switch (units) {
        case 'm':
        case 'meter':
        case 'meters':
          distance = numeric;
          break;
        case 'km':
        case 'kilometer':
        case 'kilometers':
          distance = numeric * 1000;
          break;
        case 'mile':
        case 'miles':
        case 'mi':
          distance = numeric * 1609.344;
          break;
        case 'nm':
        case 'nauticalmile':
        case 'nauticalmiles':
          distance = numeric * 1852;
          break;
        default:
          break;
      }
    }

    if (distance === undefined && numeric !== undefined) {
      distance = numeric;
    }

    if (distance === undefined) {
      distance = this.distanceFromLine(line);
    }
    return distance;
  }

  private estimateDuration(distanceMeters: number, options?: SeaRouteOptions): number | undefined {
    if (!options) return undefined;
    const speed = options.vesselSpeedKnots ?? options.vesselSpeed ?? options.speed_knots;
    if (speed === undefined || speed <= 0) return undefined;
    const distanceNm = distanceMeters / 1852;
    const hours = distanceNm / speed;
    if (!Number.isFinite(hours)) return undefined;
    return hours * 3600;
  }

  private unitsString(options: SeaRouteOptions): 'nm' | 'kilometers' | 'miles' | undefined {
    const candidate = readNonEmptyString(options.units);
    if (!candidate) return undefined;
    switch (candidate.toLowerCase()) {
      case 'nm':
      case 'nauticalmile':
      case 'nauticalmiles':
      case 'knots':
        return 'nm';
      case 'km':
      case 'kilometer':
      case 'kilometers':
        return 'kilometers';
      case 'mile':
      case 'miles':
      case 'mi':
        return 'miles';
      default:
        return undefined;
    }
  }

  private distanceFromLine(line: Coordinate[]): number {
    let sum = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const current = line[i];
      const next = line[i + 1];
      if (!current || !next) continue;
      sum += haversine(current[1], current[0], next[1], next[0]);
    }
    return sum;
  }
}

function isSeaRouteObjectModule(value: unknown): value is SeaRouteObjectModule {
  return typeof value === 'object' && value !== null;
}

function isSeaRouteModule(value: unknown): value is SeaRouteModule {
  if (typeof value === 'function') return true;
  if (isSeaRouteObjectModule(value)) {
    const candidate = value as Record<string, unknown>;
    return typeof candidate.getSeaRoute === 'function' || typeof candidate.default === 'function';
  }
  return false;
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

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const a = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
