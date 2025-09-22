import type { EngineMethod, TransportMode } from '../types.js';

const ENGINE_ALIASES: Record<string, EngineMethod> = {
  direct: 'direct',
  'great_circle': 'great_circle',
  'great-circle': 'great_circle',
  osm_route: 'osm_route',
  'osm-route': 'osm_route',
  searoute: 'searoute',
  'sea-route': 'searoute',
  custom: 'custom',
};

const MODE_ALIASES: Record<string, TransportMode> = {
  road_general: 'road_general',
  'road-general': 'road_general',
  road_express: 'road_express',
  'road-express': 'road_express',
  rail: 'rail',
  railway: 'rail',
  rail_highspeed: 'rail_highspeed',
  'rail-highspeed': 'rail_highspeed',
  sea: 'sea',
  maritime: 'sea',
  air: 'air',
  aviation: 'air',
};

export function normalizeEngine(value: unknown, fallback?: EngineMethod): EngineMethod | undefined {
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (!key) return fallback;
    const normalized = ENGINE_ALIASES[key] ?? ENGINE_ALIASES[key.replace(/\s+/g, '_')];
    return normalized ?? fallback;
  }
  return fallback;
}

export function normalizeMode(value: unknown, fallback?: TransportMode): TransportMode | undefined {
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (!key) return fallback;
    const normalized = MODE_ALIASES[key] ?? MODE_ALIASES[key.replace(/\s+/g, '_')];
    return normalized ?? fallback;
  }
  return fallback;
}

export function toCoordinatePair(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const lon = toFiniteNumber(value[0]);
  const lat = toFiniteNumber(value[1]);
  if (lon === undefined || lat === undefined) return undefined;
  return [lon, lat];
}

export function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

