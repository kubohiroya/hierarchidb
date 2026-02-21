import type { Tile } from 'geojson-vt';

const canonicalLineKey = (coords: number[][]): string => {
  const toKey = (points: number[][]): string => (
    points
      .map((point) => {
        const x = point[0] ?? 0;
        const y = point[1] ?? 0;
        return ((x << 16) ^ y).toString();
      })
      .join(',')
  );
  const forward = toKey(coords);
  const reverse = toKey([...coords].reverse());
  return forward < reverse ? forward : reverse;
};

export const dedupeTileLines = (tile: Tile): Tile => {
  const seen = new Set<string>();
  const out: Tile['features'] = [];

  for (const feature of tile.features) {
    if (feature.type !== 2) {
      out.push(feature);
      continue;
    }
    const newGeom: number[][][] = [];
    const lines = (feature.geometry ?? []) as unknown as number[][][];
    for (const line of lines) {
      const key = canonicalLineKey(line);
      if (!seen.has(key)) {
        seen.add(key);
        newGeom.push(line);
      }
    }
    if (newGeom.length > 0) {
      out.push({ ...feature, geometry: newGeom as unknown as Tile['features'][number]['geometry'] });
    }
  }

  return { ...tile, features: out };
};
