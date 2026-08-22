import type { BandConfig } from '~/types/types';
import type { TaskLayerContext } from './vtStageTaskLayerBuilderTypes.js';

type LayerBuildStartInput = {
  taskContext: TaskLayerContext;
  band: BandConfig;
  parent: { z: number; x: number; y: number };
  totalTiles: number;
};

export const logLayerBuildStart = (input: LayerBuildStartInput): void => {
  const { taskContext, band, parent, totalTiles } = input;

  console.info(
    '[tileEmit] tiling start',
    JSON.stringify({
      ...taskContext,
      zRange: [band.zMin, band.zMax],
      totalTiles,
      parentTile: parent,
      heap: null,
    })
  );
};
