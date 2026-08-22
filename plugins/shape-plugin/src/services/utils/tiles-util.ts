export function packXY(x: number, y: number, z: number): number {
  return (x << z) | y;
}

export function tileBBox(z: number, x: number, y: number): [number, number, number, number] {
  const n = 2 ** z;
  const minLon = (x / n) * 360 - 180;
  const maxLon = ((x + 1) / n) * 360 - 180;

  const mercToLat = (t: number) => (Math.atan(Math.sinh(t)) * 180) / Math.PI;
  const maxLat = mercToLat(Math.PI * (1 - (2 * y) / n));
  const minLat = mercToLat(Math.PI * (1 - (2 * (y + 1)) / n));

  return [minLon, minLat, maxLon, maxLat];
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function lon2tileX(lon: number, z: number): number {
  const n = 2 ** z;
  return Math.floor(((lon + 180) / 360) * n);
}

export function lat2tileY(lat: number, z: number): number {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2;
  return Math.floor(y * n);
}

/**
 * source bbox が交差しうるタイル(x,y)を列挙（ズーム1–8なら十分軽い）
 */
export function enumerateTilesForBBox(
  bbox: [number, number, number, number],
  z: number
): Array<{ x: number; y: number; tileId: number }> {
  const [minLon0, minLat0, maxLon0, maxLat0] = bbox;

  const minLon = clamp(minLon0, -180, 180);
  const maxLon = clamp(maxLon0, -180, 180);
  const minLat = clamp(minLat0, -85.05112878, 85.05112878);
  const maxLat = clamp(maxLat0, -85.05112878, 85.05112878);

  const n = 2 ** z;
  const xMin = clamp(lon2tileX(minLon, z), 0, n - 1);
  const xMax = clamp(lon2tileX(maxLon, z), 0, n - 1);
  const yMin = clamp(lat2tileY(maxLat, z), 0, n - 1);
  const yMax = clamp(lat2tileY(minLat, z), 0, n - 1);

  const out = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      out.push({ x, y, tileId: packXY(x, y, z) });
    }
  }
  return out;
}
