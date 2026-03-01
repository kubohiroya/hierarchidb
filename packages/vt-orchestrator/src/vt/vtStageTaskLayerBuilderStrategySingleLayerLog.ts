import type { BandConfig } from '~/types/types';
import type { TaskLayerContext } from './vtStageTaskLayerBuilderTypes.js';

type NoFeatureLayerInput = {
  taskContext: TaskLayerContext;
  parent: { z: number; x: number; y: number };
  band: BandConfig;
  layerName: string;
  featureCount: number;
};

export const logSingleLayerPerFeatureNoResult = ({
  taskContext,
  parent,
  band,
  layerName,
  featureCount,
}: NoFeatureLayerInput): void => {
  console.warn('[tileEmit] per-feature index produced no layers', JSON.stringify({
    ...taskContext,
    parentTile: parent,
    zRange: [band.zMin, band.zMax],
    layerName,
    featureCount,
  }));
};
