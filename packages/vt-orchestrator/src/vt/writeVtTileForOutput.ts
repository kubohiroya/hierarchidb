import type { Tile } from 'geojson-vt';
import type { VtTileOutputWriterInput } from './vtStageTaskOutputTypes.js';
import type { TileVisitResult } from './vtStageTaskOutputWriterActionsHandle.js';
import {
  handleTileWithLayers,
  handleTileWithoutLayers,
} from './vtStageTaskOutputWriterActionsHandle.js';

export const writeVtTileForOutput = async ({
  context,
  tile,
  layers,
}: {
  context: VtTileOutputWriterInput;
  tile: {
    z: number;
    x: number;
    y: number;
    processedTiles: number;
    generatedTiles: number;
  };
  layers: Record<string, Tile> | null;
}): Promise<TileVisitResult> => {
  if (!layers) {
    return handleTileWithoutLayers({ context, tile });
  }
  return handleTileWithLayers({
    context,
    tile,
    layers,
  });
};
