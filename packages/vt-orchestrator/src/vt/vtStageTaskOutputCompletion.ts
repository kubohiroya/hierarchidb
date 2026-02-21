import { getHeapSnapshot } from './vtStageCore.js';
import type { VtTileOutputAggregates } from './vtStageTaskOutputStats.js';
import type { VtTileBandRange, VtTileParent, VtTileTaskContext } from './vtStageTaskOutputTypes.js';

type VtTaskOutputCompletionInput = {
  taskContext: VtTileTaskContext;
  parent: VtTileParent;
  band: VtTileBandRange;
  totalTiles: number;
  processedTiles: number;
  generatedTiles: number;
  totals: VtTileOutputAggregates;
  tilingStartedAt: number;
};

export const logVtTaskOutputCompletion = ({
  taskContext,
  parent,
  band,
  totalTiles,
  processedTiles,
  generatedTiles,
  totals,
  tilingStartedAt,
  finalTileSummary,
}: VtTaskOutputCompletionInput & { finalTileSummary: string; }): void => {
  console.info('[vt] tiling done', JSON.stringify({
    ...taskContext,
    processedTiles,
    generatedTiles,
    totalTiles,
    inputTotals: totals.totalInputStats,
    outputTotals: totals.totalOutputStats,
    encodeStats: totals.encodeStats,
    storeStats: totals.storeStats,
    duration: Date.now() - tilingStartedAt,
    heap: getHeapSnapshot(),
  }));
  if (generatedTiles === 0) {
    console.warn('[vt] generated zero tiles', JSON.stringify({
      ...taskContext,
      parentTile: parent,
      zRange: [band.zMin, band.zMax],
      totalTiles,
      processedTiles,
      bufferCount: taskContext.bufferCount,
      tileSummary: finalTileSummary,
    }));
  }
  console.info('[vt] output tile totals', JSON.stringify({
    ...taskContext,
    generatedTiles,
    outputTotals: totals.totalOutputStats,
  }));
  console.info('[vt] task completed', JSON.stringify({
    ...taskContext,
    processedTiles,
    generatedTiles,
    totalTiles,
    outputTotals: totals.totalOutputStats,
    tilingDuration: Date.now() - tilingStartedAt,
    heap: getHeapSnapshot(),
  }));
};
