import type { VTStageContext } from '~/contextTypes';
import { assertNotAborted } from './vtStageCoreUtils.js';
import { logVtTaskOutputCompletion } from './logVtTaskOutputCompletion.js';
import { buildFinalTileCompletionSummary } from './buildFinalTileCompletionSummary.js';
import { buildTileOutputResult } from './buildTileOutputResult.js';
import type { VtTileBandRange, VtTileParent, VtTileProgressReporter, VtTileTaskContext } from './vtStageTaskOutputTypes.js';
import type { StageHandlerResult } from '~/types/types';
import type { VtTileOutputAggregates } from './vtStageTaskOutputStats.js';

type VtTileOutputFinalizeInput = {
  context: VTStageContext;
  taskContext: VtTileTaskContext;
  parent: VtTileParent;
  band: VtTileBandRange;
  totalTiles: number;
  processedTiles: number;
  generatedTiles: number;
  totals: VtTileOutputAggregates;
  tilingStartedAt: number;
  adminFeatureSummary: string;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  parentInputMetadata: Record<string, unknown>;
  reportTileProgress: VtTileProgressReporter;
};

export const finalizeVtTileOutput = async ({
  context,
  taskContext,
  parent,
  band,
  totalTiles,
  processedTiles,
  generatedTiles,
  totals,
  tilingStartedAt,
  adminFeatureSummary,
  tilesByZoom,
  parentInputMetadata,
  reportTileProgress,
}: VtTileOutputFinalizeInput): Promise<StageHandlerResult> => {
  const { abortSignal } = context;
  const { finalTileSummary, message } = buildFinalTileCompletionSummary({
    adminFeatureSummary,
    tilesByZoom,
    generatedTiles,
  });

  assertNotAborted(abortSignal);
  logVtTaskOutputCompletion({
    taskContext,
    parent,
    band,
    totalTiles,
    processedTiles,
    generatedTiles,
    totals,
    tilingStartedAt,
    finalTileSummary,
  });
  await reportTileProgress({
    processedTiles,
    generatedTiles,
    force: true,
    message,
  });

  return buildTileOutputResult({
    generatedTiles,
    totalTiles,
    parentInputMetadata,
    finalMessage: message,
  });
};
