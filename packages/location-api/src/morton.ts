const MAX_LATITUDE = 85.05112878;

export type LocationTileIdByZoom = {
  z0?: string;
  z1?: string;
  z2?: string;
  z3?: string;
  z4?: string;
  z5?: string;
  z6?: string;
  z7?: string;
  z8?: string;
  z9?: string;
};

const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

export const MORTON_MAX_BITS = 24;
export const MORTON_KEY_HEX_LENGTH = Math.ceil((MORTON_MAX_BITS * 2) / 4);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clampLatitude = (latitude: number): number =>
  clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE);

const clampLongitude = (longitude: number): number =>
  clamp(longitude, MIN_LONGITUDE, MAX_LONGITUDE);

export const clampMortonZoom = (zoom: number): number =>
  clamp(Math.floor(zoom), 0, MORTON_MAX_BITS);

export const lonLatToTileXY = (
  longitude: number,
  latitude: number,
  zoom: number,
): { x: number; y: number } => {
  const z = clampMortonZoom(zoom);
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

const interleaveBits = (x: bigint, y: bigint, bits: number): bigint => {
  let result = 0n;
  for (let i = 0; i < bits; i += 1) {
    const shift = BigInt(bits - 1 - i);
    const xb = (x >> shift) & 1n;
    const yb = (y >> shift) & 1n;
    result = (result << 1n) | xb;
    result = (result << 1n) | yb;
  }
  return result;
};

const toHex = (value: bigint): string =>
  value.toString(16).padStart(MORTON_KEY_HEX_LENGTH, '0');

export const formatTileId = (zoom: number, x: number, y: number): string => (`${zoom}/${x}/${y}`);

export const buildTileIdByZoom = (
  longitude: number,
  latitude: number,
  minZoom = 0,
  maxZoom = 9,
): LocationTileIdByZoom => {
  const clampedMin = Math.max(0, Math.floor(minZoom));
  const clampedMax = Math.max(clampedMin, Math.floor(maxZoom));
  const result: LocationTileIdByZoom = {};
  for (let z = clampedMin; z <= clampedMax; z += 1) {
    const { x, y } = lonLatToTileXY(longitude, latitude, z);
    const key = `z${z}` as keyof LocationTileIdByZoom;
    result[key] = formatTileId(z, x, y);
  }
  return result;
};

export const mortonKeyFromLonLat = (longitude: number, latitude: number): string => {
  const { x, y } = lonLatToTileXY(longitude, latitude, MORTON_MAX_BITS);
  return toHex(interleaveBits(BigInt(x), BigInt(y), MORTON_MAX_BITS));
};

export const mortonRangeForTile = (
  x: number,
  y: number,
  zoom: number,
): { start: string; end: string } => {
  const bits = clampMortonZoom(zoom);
  const prefix = interleaveBits(BigInt(x), BigInt(y), bits);
  const shift = BigInt((MORTON_MAX_BITS - bits) * 2);
  const start = prefix << shift;
  const end = ((prefix + 1n) << shift) - 1n;
  return { start: toHex(start), end: toHex(end) };
};
