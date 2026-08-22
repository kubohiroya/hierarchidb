import type { Tile } from 'geojson-vt';

const canonicalLineKey = (coords: number[][]): string => {
  const toKey = (points: number[][]): string =>
    points
      .map((point) => {
        const x = point[0] ?? 0;
        const y = point[1] ?? 0;
        return ((x << 16) ^ y).toString();
      })
      .join(',');
  const forward = toKey(coords);
  const reverse = toKey([...coords].reverse());
  return forward < reverse ? forward : reverse;
};

type TileLineGeometry = number[][][];

const isTileLineGeometry = (value: unknown): value is TileLineGeometry =>
  Array.isArray(value) &&
  value.every(
    (line) =>
      Array.isArray(line) &&
      line.every(
        (point) =>
          Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number'
      )
  );

export const dedupeTileLines = (tile: Tile): Tile => {
  const seen = new Set<string>();
  const out: Tile['features'] = [];

  for (const feature of tile.features) {
    if (feature.type !== 2) {
      out.push(feature);
      continue;
    }
    const lines = feature.geometry;
    if (!isTileLineGeometry(lines)) {
      out.push(feature);
      continue;
    }
    let writeIndex = 0;
    for (const line of lines) {
      const key = canonicalLineKey(line);
      if (!seen.has(key)) {
        seen.add(key);
        lines[writeIndex] = line;
        writeIndex += 1;
      }
    }
    lines.length = writeIndex;
    if (lines.length > 0) {
      out.push(feature);
    }
  }

  return { ...tile, features: out };
};
