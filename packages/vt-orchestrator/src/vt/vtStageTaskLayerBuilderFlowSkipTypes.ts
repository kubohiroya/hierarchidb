import type { StageHandlerResult } from '~/types/types';
import type { LayerBuildPolicy } from './vtStageTaskLayerBuilderPolicy.js';
import type { InputFeatureStats } from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';

export type SkipCheckInput = {
  taskContext: {
    taskId: string;
    nodeId: string;
  };
  parent: {
    z: number;
    x: number;
    y: number;
  };
  layerBuildPolicy: {
    mode: LayerBuildPolicy['mode'];
    skipReason?: string;
  };
  totalFeatures: number;
  featureStats: InputFeatureStats[];
  completedWithParentInputSummary: (message: string) => StageHandlerResult;
};
