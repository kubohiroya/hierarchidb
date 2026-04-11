import type { StageHandlerResult, VtTaskInput } from '~/types/types';
import type { VTStageContext } from '~/contextTypes';
import type { VtCollectionResult, VtTaskRunInput } from './vtStageTaskTypes.js';
import { logFeatureCollectionReady } from './logFeatureCollectionReady.js';
import { executeLayerBuild } from './executeLayerBuild.js';
import { writeVtTaskOutput } from './writeVtTaskOutput.js';
import { buildLayerRunInput } from './buildLayerRunInput.js';

export const buildAndWriteVtTiles = async (
  context: VTStageContext,
  task: {
    taskId: string;
    nodeId: string | number;
  },
  input: VtTaskInput,
  runInput: VtTaskRunInput,
  collection: VtCollectionResult,
): Promise<StageHandlerResult> => {
  const { taskContext } = runInput;

  logFeatureCollectionReady({
    taskContext,
    collection: collection.collection,
    bufferSizes: collection.bufferSizes,
  });

  const layerRunInput = buildLayerRunInput({ runInput, collection });
  const layerResult = await executeLayerBuild({
    context,
    runInput: layerRunInput,
    collection,
  });
  if (layerResult.kind === 'skipped') {
    return layerResult.result;
  }
  return writeVtTaskOutput({
    context,
    task,
    input,
    runInput,
    collection,
    layerResult,
  });
};
