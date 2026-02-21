import { resolveTileLayersForOutput } from './vtStageTaskOutputTileLayers.js';
import { visitTilesForOutput } from './vtStageTaskOutputTraversal.js';
import type { VtTileOutputCounts } from './vtStageTaskOutputTypes.js';
import type { VtTileOutputWriterInput } from './vtStageTaskOutputTypes.js';
import { writeVtTileForOutput } from './vtStageTaskOutputWriterActions.js';

export const writeVtTileOutputs = async (
  input: VtTileOutputWriterInput,
): Promise<VtTileOutputCounts> => {
  return visitTilesForOutput({
    parent: input.parent,
    band: input.band,
    abortSignal: input.context.abortSignal,
    onVisitTile: async ({ z, x, y, processedTiles, generatedTiles }) => {
      const layers = resolveTileLayersForOutput({
        z,
        x,
        y,
        aggregatedLayersByTileId: input.aggregatedLayersByTileId,
        indexes: input.indexes,
      });
      const { generated } = await writeVtTileForOutput({
        context: input,
        tile: {
          z,
          x,
          y,
          processedTiles,
          generatedTiles,
        },
        layers,
      });
      return { generated };
    },
  });
};
