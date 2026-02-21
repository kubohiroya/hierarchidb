import type { StageHandlerResult } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import { assertNotAborted } from './vtStageCore.js';
import type { VtTileOutputAggregates } from './vtStageTaskOutputStats.js';
import { logVtTaskOutputCompletion } from './vtStageTaskOutputCompletion.js';
import { buildCompletedMessage } from './vtStageTaskOutputLogging.js';
import { buildTileSummary } from './vtStageSummary.js';
import type { VtTileBandRange, VtTileParent, VtTileProgressReporter, VtTileTaskContext } from './vtStageTaskOutputTypes.js';

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

type VtTileCompletionSummary = {
  finalTileSummary: string;
  message: string;
};

type VtFinalOutputInput = {
  generatedTiles: number;
  totalTiles: number;
  parentInputMetadata: Record<string, unknown>;
  finalMessage: string;
};

const buildFinalTileCompletionSummary = ({
  adminFeatureSummary,
  tilesByZoom,
  generatedTiles,
}: {
  adminFeatureSummary: string;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  generatedTiles: number;
}): VtTileCompletionSummary => {
  const finalTileSummary = buildTileSummary(tilesByZoom);
  const message = buildCompletedMessage(
    adminFeatureSummary,
    finalTileSummary,
    generatedTiles,
  );
  return { finalTileSummary, message };
};

const buildTileOutputResult = ({
  generatedTiles,
  totalTiles,
  parentInputMetadata,
  finalMessage,
}: VtFinalOutputInput): StageHandlerResult => ({
  status: 'completed',
  progress: 100,
  message: finalMessage,
  metadata: parentInputMetadata,
  outputData: {
    tilesGenerated: generatedTiles,
    totalTiles,
  },
});

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
