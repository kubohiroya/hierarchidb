import type { GeojsonVtIndex } from './vtStageTileIndex.js';
import { packTileId } from '~/tiles/tileId';
import { collectLayersForTileFromIndexes } from './vtStageTaskOutputHelpers.js';
import type { Tile } from 'geojson-vt';

type TileLayersById = Map<number, Record<string, Tile>>;

type TileLayerSourceInput = {
  z: number;
  x: number;
  y: number;
  aggregatedLayersByTileId: TileLayersById | null;
  indexes: Map<string, GeojsonVtIndex> | null;
};

export const resolveTileLayersForOutput = (input: TileLayerSourceInput): Record<string, Tile> | null => {
  const { z, x, y, aggregatedLayersByTileId, indexes } = input;
  if (aggregatedLayersByTileId) {
    return aggregatedLayersByTileId.get(packTileId(x, y, z)) ?? null;
  }
  return indexes ? collectLayersForTileFromIndexes(indexes, z, x, y) : null;
};

