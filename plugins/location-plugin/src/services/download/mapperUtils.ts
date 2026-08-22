import type { LocationType } from '~/common/entities/LocationEntity';

const TYPE_MAP: Record<string, LocationType> = {
  centroid: 'area_centroid',
  area_centroid: 'area_centroid',
  aerodrome: 'airport',
  airport: 'airport',
  railway_station: 'railway_station',
  railway: 'railway_station',
  harbour: 'port',
  port: 'port',
  interchange: 'interchange',
};

export const mapType = (value?: string): LocationType => TYPE_MAP[value ?? ''] ?? 'area_centroid';

export const sanitizeTags = (tags: unknown): Record<string, string> | undefined => {
  if (!tags || typeof tags !== 'object') return undefined;
  const entries = Object.entries(tags as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};
