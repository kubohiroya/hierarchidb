export type TileCoordinate = { z: number; x: number; y: number };

export function buildTileCoordinates(
  bbox: [number, number, number, number],
  zoomLevels: number[],
): TileCoordinate[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  const long2tile = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
  const lat2tile = (lat: number, z: number) => {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
  };

  const tiles: TileCoordinate[] = [];
  for (const z of zoomLevels) {
    const x1 = long2tile(minLon, z);
    const x2 = long2tile(maxLon, z);
    const y1 = lat2tile(maxLat, z);
    const y2 = lat2tile(minLat, z);

    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        tiles.push({ z, x, y });
      }
    }
  }

  return tiles;
}
