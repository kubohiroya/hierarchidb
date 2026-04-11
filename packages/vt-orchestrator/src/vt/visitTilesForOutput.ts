import { assertNotAborted } from './vtStageCoreUtils.js';
import { parentToChildRange } from '~/tiles/tileId';
import type { VtTileBandRange, VtTileOutputCounts, VtTileParent } from './vtStageTaskOutputTypes.js';

type TileVisitState = {
  z: number;
  x: number;
  y: number;
  processedTiles: number;
  generatedTiles: number;
};

type TileVisitResult = {
  generated: boolean;
};

type TileTraversalInput = {
  parent: VtTileParent;
  band: VtTileBandRange;
  abortSignal?: AbortSignal;
  onVisitTile: (tile: TileVisitState) => Promise<TileVisitResult>;
};

export const visitTilesForOutput = async (
  input: TileTraversalInput,
): Promise<VtTileOutputCounts> => {
  const { parent, band, abortSignal, onVisitTile } = input;
  let processedTiles = 0;
  let generatedTiles = 0;

  for (let z = band.zMin; z <= band.zMax; z++) {
    assertNotAborted(abortSignal);
    const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
    for (let x = xStart; x <= xEnd; x++) {
      assertNotAborted(abortSignal);
      for (let y = yStart; y <= yEnd; y++) {
        assertNotAborted(abortSignal);
        processedTiles += 1;
        const { generated } = await onVisitTile({
          z,
          x,
          y,
          processedTiles,
          generatedTiles,
        });
        if (generated) {
          generatedTiles += 1;
        }
      }
    }
  }
  return { processedTiles, generatedTiles };
};
