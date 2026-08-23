import { readRuntimeEnvValue } from '@hierarchidb/util';
import { createRouteEngineCapability, type RouteEngineCapability } from './RouteEngineCapability.js';
import type { RoutingEngine } from './RoutingEngine.js';

type Coordinate = [number, number];
type SeaRouteFunction = (
  from: Coordinate,
  to: Coordinate,
  options?: SeaRouteOptions | string
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
  readonly capability: RouteEngineCapability = createRouteEngineCapability({
    engineId: 'searoute',
    engineVersion: 'searoute-js-runtime',
    method: 'searoute',
    acceptedRouteModes: ['waterway'],
    networkRequirement: 'required',
    supportsWaypoints: false,
  });

  private libPromise?: Promise<SeaRouteModule>;

  async route(
    points: Coordinate[],
    options?: unknown
  ): Promise<{
    line: Coordinate[];
    distance_m: number;
    duration_s?: number;
  }> {
    if (points.length !== 2) {
      throw new Error('searoute requires exactly two coordinates');
    }
    const start = points[0];
    const end = points[1];
    if (!start || !end) throw new Error('searoute requires exactly two coordinates');

    const normalizedOptions = this.normalizeOptions(options as SeaRouteOptions | undefined);

    const module = await this.loadLib();
    const fn = this.resolveApi(module);
    if (!fn) throw new Error('Unsupported searoute module shape');
    const response = await fn([start[0], start[1]], [end[0], end[1]], normalizedOptions);
    const line = this.extractLine(response);
    const distance_m = this.extractDistanceMeters(response);
    const duration_s = this.estimateDuration(distance_m, normalizedOptions);
    return { line, distance_m, duration_s };
  }

  private async loadLib(): Promise<SeaRouteModule> {
    if (!this.libPromise) {
      this.libPromise = (async () => {
        const packageName = this.readPreferredPackageName() ?? 'searoute-js';
        let imported: unknown;
        try {
          imported = await import(/* @vite-ignore */ packageName);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to load searoute engine package ${packageName}: ${message}`);
        }
        if (!isSeaRouteModule(imported)) {
          throw new Error(`Unsupported searoute engine package shape: ${packageName}`);
        }
        return imported;
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

    const envValue = readNonEmptyString(
      readRuntimeEnvValue('ROUTE_SEAROUTE_PKG', { prefixes: [''] })
    );
    if (envValue) return envValue;

    const globalValue = readNonEmptyString(
      (globalThis as Record<string, unknown>).ROUTE_SEAROUTE_PKG
    );
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
    if (options === undefined) return undefined;
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('searoute options must be an object when provided');
    }
    const source = options as Record<string, unknown>;
    const normalized: SeaRouteOptions = {};

    if ('units' in source) normalized.units = requireNonEmptyString('options.units', source.units);

    if ('blockedAreas' in source) normalized.blockedAreas = source.blockedAreas;
    if ('avoidCanals' in source) {
      if (typeof source.avoidCanals !== 'boolean') {
        throw new Error('searoute options.avoidCanals must be boolean');
      }
      normalized.avoidCanals = source.avoidCanals;
    }

    if ('vesselSpeedKnots' in source) {
      normalized.vesselSpeedKnots = requirePositiveNumber(
        'options.vesselSpeedKnots',
        source.vesselSpeedKnots
      );
    }

    if ('vesselSpeed' in source) {
      normalized.vesselSpeed = requirePositiveNumber('options.vesselSpeed', source.vesselSpeed);
    }

    if ('speed_knots' in source) {
      normalized.speed_knots = requirePositiveNumber('options.speed_knots', source.speed_knots);
    }

    for (const [key, value] of Object.entries(source)) {
      if (!(key in normalized)) normalized[key] = value;
    }

    return normalized;
  }

  private extractLine(result: SeaRouteResponse): Coordinate[] {
    const candidates = [result.geometry?.coordinates, result.coordinates, result.line];

    for (const candidate of candidates) {
      const line = toCoordinatePairs(candidate);
      if (line) return line;
    }
    throw new Error('searoute response did not include coordinates');
  }

  private extractDistanceMeters(result: SeaRouteResponse): number {
    const props = result.properties ?? result.props ?? {};
    const rawDistance = props.distance ?? props.length;
    const numeric = toFiniteNumber(rawDistance);
    const units = readNonEmptyString(props.units ?? props.unit ?? result.units)?.toLowerCase();
    if (numeric === undefined || numeric < 0) {
      throw new Error('searoute response distance must be a finite non-negative number');
    }
    if (!units) {
      throw new Error('searoute response distance units are required');
    }
    switch (units) {
      case 'm':
      case 'meter':
      case 'meters':
        return numeric;
      case 'km':
      case 'kilometer':
      case 'kilometers':
        return numeric * 1000;
      case 'mile':
      case 'miles':
      case 'mi':
        return numeric * 1609.344;
      case 'nm':
      case 'nauticalmile':
      case 'nauticalmiles':
        return numeric * 1852;
      default:
        throw new Error(`Unsupported searoute response distance units: ${units}`);
    }
  }

  private estimateDuration(distanceMeters: number, options?: SeaRouteOptions): number | undefined {
    if (!options) return undefined;
    const speed = options.vesselSpeedKnots ?? options.vesselSpeed ?? options.speed_knots;
    if (speed === undefined || speed <= 0) return undefined;
    const distanceNm = distanceMeters / 1852;
    const hours = distanceNm / speed;
    if (!Number.isFinite(hours)) {
      throw new Error('searoute duration calculation must produce a finite number');
    }
    return hours * 3600;
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
    if (!Array.isArray(item) || item.length !== 2) return undefined;
    const lon = toFiniteNumber(item[0]);
    const lat = toFiniteNumber(item[1]);
    if (lon === undefined || lon < -180 || lon > 180 || lat === undefined || lat < -90 || lat > 90)
      return undefined;
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
  return undefined;
}

function requireNonEmptyString(label: string, value: unknown): string {
  const result = readNonEmptyString(value);
  if (!result) throw new Error(`searoute ${label} must be a non-empty string`);
  return result;
}

function requirePositiveNumber(label: string, value: unknown): number {
  const result = toFiniteNumber(value);
  if (result === undefined || result <= 0) {
    throw new Error(`searoute ${label} must be a finite positive number`);
  }
  return result;
}
