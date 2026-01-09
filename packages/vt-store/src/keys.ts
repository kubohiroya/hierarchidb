export const DEFAULT_VT_TILE_KEY_SEPARATOR = '|';

export const buildVtTileKey = (tileId: number, bufferSetHash: string): string => {
  return `${tileId}${DEFAULT_VT_TILE_KEY_SEPARATOR}${bufferSetHash}`;
};
