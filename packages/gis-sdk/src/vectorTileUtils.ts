export type TileXYZ = {
  z: number;
  x: number;
  y: number;
};

export type LonLat = {
  longitude: number;
  latitude: number;
};

export type BoundingBox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

/**
 * WebMercator tile math utilities.
 *
 * Note: This matches the existing behavior used across the repo (floor-based, XYZ scheme).
 */
export const lonToTileX = (lon: number, z: number): number =>
  Math.floor(((lon + 180) / 360) * 2 ** z);

export const latToTileY = (lat: number, z: number): number => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};

export const lonLatToTileXY = (
  longitude: number,
  latitude: number,
  z: number
): { x: number; y: number } => ({
  x: lonToTileX(longitude, z),
  y: latToTileY(latitude, z),
});

export const tileToBbox = (x: number, y: number, z: number): BoundingBox => {
  const n = 2 ** z;
  const minLon = (x / n) * 360 - 180;
  const maxLon = ((x + 1) / n) * 360 - 180;
  const maxLat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const minLat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return [minLon, minLat, maxLon, maxLat];
};

export const getTilesInBounds = (bbox: BoundingBox, z: number): TileXYZ[] => {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const x1 = lonToTileX(minLon, z);
  const x2 = lonToTileX(maxLon, z);
  const y1 = latToTileY(maxLat, z);
  const y2 = latToTileY(minLat, z);
  const tiles: TileXYZ[] = [];
  for (let x = x1; x <= x2; x += 1) {
    for (let y = y1; y <= y2; y += 1) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
};

const toPropertyString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  return undefined;
};

export const pickFirstString = (
  properties: Record<string, unknown>,
  keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = toPropertyString(properties[key]);
    if (value) return value;
  }
  return undefined;
};

export const pickCountryName = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, [
    'country',
    'COUNTRY',
    'COUNTRY_NAME',
    'NAME_0',
    'ADMIN',
    'SOVEREIGNT',
  ]);

export const pickCountryCode = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, ['ISO_A2', 'ISO2', 'ISO_2', 'ISO_A3', 'ADM0_A3', 'ISO3', 'shapeISO']);

export const pickAdminName = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, [
    'name',
    'NAME',
    'name_en',
    'NAME_EN',
    'shapeName',
    'NAME_1',
    'NAME_2',
    'NAME_3',
    'NAME_4',
    'NAME_5',
  ]);

export const pickAdminCode = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, [
    'GID_0',
    'GID_1',
    'GID_2',
    'GID_3',
    'ADM1_CODE',
    'ADM2_CODE',
    'shapeID',
    'code',
  ]);

export const pickAdminLevel = (properties: Record<string, unknown>): number | undefined => {
  const candidates = [
    properties.adminLevel,
    properties.admin_level,
    properties.ADM_LEVEL,
    properties.level,
    properties.admin_lvl,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};
