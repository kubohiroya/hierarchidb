export type TileCoord = { x: number; y: number; z: number };

export const packTileId = (x: number, y: number, z: number): number => {
  return (x << z) | y;
};

export const unpackTileId = (tileId: number, z: number): TileCoord => {
  const mask = (1 << z) - 1;
  const y = tileId & mask;
  const x = tileId >> z;
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
