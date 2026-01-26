const MAX_LATITUDE = 85.05112878;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clampLatitude = (latitude: number): number =>
  clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE);

const clampLongitude = (longitude: number): number =>
  clamp(longitude, MIN_LONGITUDE, MAX_LONGITUDE);

export const clampTileZoom = (zoom: number, minZoom = 0, maxZoom = 9): number =>
  clamp(Math.floor(zoom), minZoom, maxZoom);

export const lonLatToTileXY = (
  longitude: number,
  latitude: number,
  zoom: number,
): { x: number; y: number } => {
  const z = clampTileZoom(zoom, 0, 22);
  const lon = clampLongitude(longitude);
  const lat = clampLatitude(latitude);
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return {
    x: clamp(x, 0, n - 1),
    y: clamp(y, 0, n - 1),
  };
};

export const formatTileId = (zoom: number, x: number, y: number): string => `${zoom}/${x}/${y}`;

export const resolveTileIdField = (zoom: number, maxZoom = 9): string => `z${clampTileZoom(zoom, 0, maxZoom)}`;

export const getViewportTileIdSet = (
  bbox: [number, number, number, number],
  zoom: number,
  options?: { minZoom?: number; maxZoom?: number },
): Set<string> => {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  if (![minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value))) {
    return new Set();
  }
  const z = clampTileZoom(zoom, options?.minZoom ?? 0, options?.maxZoom ?? 9);
  const topLeft = lonLatToTileXY(minLon, maxLat, z);
  const bottomRight = lonLatToTileXY(maxLon, minLat, z);
  const minX = Math.min(topLeft.x, bottomRight.x);
  const maxX = Math.max(topLeft.x, bottomRight.x);
  const minY = Math.min(topLeft.y, bottomRight.y);
  const maxY = Math.max(topLeft.y, bottomRight.y);
  const tileIds = new Set<string>();
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tileIds.add(formatTileId(z, x, y));
    }
  }
  return tileIds;
};

export const filterItemsByTileIdSet = <T extends Record<string, unknown>>(
  items: T[],
  tileIdSet: Set<string>,
  tileIdField: string,
): T[] => {
  if (tileIdSet.size === 0) return [];
  return items.filter((item) => {
    const value = item[tileIdField];
    return typeof value === 'string' && tileIdSet.has(value);
  });
};
