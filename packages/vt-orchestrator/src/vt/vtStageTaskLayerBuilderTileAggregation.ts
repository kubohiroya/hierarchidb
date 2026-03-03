import type { Tile } from 'geojson-vt';
import { iterateChildTiles } from './iterateChildTiles.js';
import { mergeLayerTiles } from './vtStageTaskLayerBuilderHelpers.js';

export type TileLayerCollector = (
  z: number,
  x: number,
  y: number,
) => Record<string, Tile> | null;

type TileAggregationInput = {
  parent: { z: number; x: number; y: number };
  band: {
    zMin: number;
    zMax: number;
  };
  assertNotAborted: (signal?: AbortSignal) => void;
  abortSignal: AbortSignal | undefined;
  collectLayersForTile: TileLayerCollector;
};

export const collectTileLayersToMap = async ({
  parent,
  band,
  assertNotAborted,
  abortSignal,
  collectLayersForTile,
}: TileAggregationInput): Promise<Map<number, Record<string, Tile>>> => {
  const aggregatedLayersByTileId = new Map<number, Record<string, Tile>>();
  for (const { z, x, y, tileId } of iterateChildTiles({
    parent,
    band,
    assertNotAborted,
    abortSignal,
  })) {
    const layerTiles = collectLayersForTile(z, x, y);
    if (!layerTiles) continue;
    const existing = aggregatedLayersByTileId.get(tileId);
    if (existing) {
      mergeLayerTiles(existing, layerTiles);
    } else {
      aggregatedLayersByTileId.set(tileId, layerTiles);
    }
  }
  return aggregatedLayersByTileId;
};

export const mergeAggregatedLayerMaps = (
  destination: Map<number, Record<string, Tile>>,
  source: Map<number, Record<string, Tile>>,
): void => {
  for (const [tileId, layers] of source.entries()) {
    const existing = destination.get(tileId);
    if (existing) {
      mergeLayerTiles(existing, layers);
    } else {
      destination.set(tileId, layers);
    }
  }
};
