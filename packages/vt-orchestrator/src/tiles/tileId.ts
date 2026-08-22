export type TileCoord = { x: number; y: number; z: number };

// Keep in sync with maximum supported zoom (MapLibre maxZoom=22).
const TILE_INDEX_BITS = 22;
const TILE_INDEX_SCALE = 2 ** TILE_INDEX_BITS;
const TILE_INDEX_STRIDE = TILE_INDEX_SCALE * TILE_INDEX_SCALE;

export const packTileId = (x: number, y: number, z: number): number => {
  return z * TILE_INDEX_STRIDE + x * TILE_INDEX_SCALE + y;
};

export const unpackTileId = (tileId: number, z: number): TileCoord => {
  const offset = tileId - z * TILE_INDEX_STRIDE;
  const x = Math.floor(offset / TILE_INDEX_SCALE);
  const y = offset - x * TILE_INDEX_SCALE;
  return { x, y, z };
};

export const parentToChildRange = (
  parent: TileCoord,
  zTarget: number
): { xStart: number; xEnd: number; yStart: number; yEnd: number } => {
  if (zTarget < parent.z) {
    throw new Error(`zTarget must be >= parent z (${parent.z})`);
  }
  if (zTarget === parent.z) {
    return { xStart: parent.x, xEnd: parent.x, yStart: parent.y, yEnd: parent.y };
  }
  const scale = 1 << (zTarget - parent.z);
  const xStart = parent.x * scale;
  const xEnd = (parent.x + 1) * scale - 1;
  const yStart = parent.y * scale;
  const yEnd = (parent.y + 1) * scale - 1;
  return { xStart, xEnd, yStart, yEnd };
};
