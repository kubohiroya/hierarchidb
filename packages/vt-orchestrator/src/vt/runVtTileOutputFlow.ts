import type { StageHandlerResult } from '~/types/types';
import { finalizeVtTileOutput } from './finalizeVtTileOutput.js';
import { runVtTileOutputWriter } from './runVtTileOutputWriter.js';
import { getHeapSnapshot } from './vtStageCoreUtils.js';
import type { VtTileOutputContext } from './vtStageTaskOutputTypes.js';

type VtTaskOutputFlowInput = VtTileOutputContext;

export const runVtTileOutputFlow = async (
  outputContext: VtTaskOutputFlowInput
): Promise<StageHandlerResult> => {
  const {
    context,
    input,
    taskContext,
    parent,
    band,
    parentInputMetadata,
    tilesByZoom,
    totalTiles,
    adminFeatureSummary,
  } = outputContext;

  console.info(
    '[tileEmit] encode/store start',
    JSON.stringify({
      ...taskContext,
      totalTiles,
      bufferCount: input.bufferIds.length,
      heap: getHeapSnapshot(),
    })
  );

  const tileOutputSession = await runVtTileOutputWriter(outputContext);

  return finalizeVtTileOutput({
    context,
    taskContext,
    parent,
    band,
    totalTiles,
    processedTiles: tileOutputSession.processedTiles,
    generatedTiles: tileOutputSession.generatedTiles,
    totals: tileOutputSession.totals,
    tilingStartedAt: tileOutputSession.tilingStartedAt,
    adminFeatureSummary,
    tilesByZoom,
    parentInputMetadata,
    reportTileProgress: tileOutputSession.reportTileProgress,
  });
};
