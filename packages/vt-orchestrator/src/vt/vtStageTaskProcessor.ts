import type { StageHandlerResult, VtTaskInput } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import {
  buildLayersForVtTask,
} from './vtStageTaskLayerBuilder.js';
import { writeVtTiles } from './vtStageTaskOutput.js';
import {
  assertNotAborted,
  getHeapSnapshot,
} from './vtStageCore.js';
import { loadVtPbf } from './vtStageFeatureCollector.js';
import {
  buildVtParentMetadata,
  collectTaskFeatures,
  prepareVtTaskExecution,
} from './vtStageTaskProcessorHelpers.js';

export const executeVtTask = async (
  context: VTStageContext,
  task: {
    taskId: string;
    nodeId: string | number;
    inputData?: VtTaskInput | null;
  },
): Promise<StageHandlerResult> => {
  const preparation = prepareVtTaskExecution({ context, task });
  if (preparation.kind === 'skipped') {
    return preparation.result;
  }

  const {
    taskContext,
    band,
    parent,
    debugCollect,
    debugFocusConfig,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    bufferIds,
    bufferIdSample,
  } = preparation;
  const input = task.inputData;
  const { abortSignal } = context;

  if (!input) {
    return { status: 'failed', errorMessage: 'vt task input is missing' };
  }

  const { vtConfig } = context;
  const layerSetName = vtConfig.layerSetName;
  if (!layerSetName) {
    throw new Error('vt stage requires layerSetName');
  }
  if (groupByContinent) {
    console.info('[vt] continent grouping enabled', JSON.stringify({
      ...taskContext,
      zRange: [band.zMin, band.zMax],
    }));
  }

  console.info('[vt] task start', JSON.stringify({
    ...taskContext,
    zRange: [band.zMin, band.zMax],
    layerSetName,
    bufferIdSample,
  }));
  if (debugFocusConfig.enabled) {
    console.info('[vt][focus] enabled', JSON.stringify({
      ...taskContext,
      logAll: debugFocusConfig.logAll,
      tileFilters: Array.from(debugFocusConfig.tileKeys).slice(0, 20),
      featureFilters: Array.from(debugFocusConfig.featureIds).slice(0, 20),
    }));
  }

  try {
    assertNotAborted(abortSignal);
    const collectStartedAt = Date.now();
    console.info('[vt] collect start', JSON.stringify({
      ...taskContext,
      bufferCount: input.bufferIds.length,
      heap: getHeapSnapshot(),
    }));
    const collected = await collectTaskFeatures(context, {
      nodeId: taskContext.nodeId,
      bufferIds,
      groupByContinent,
      taskId: task.taskId,
      bandIndex: input.bandIndex,
    });
    console.info('[vt] collect done', JSON.stringify({
      ...taskContext,
      bufferCount: input.bufferIds.length,
      duration: Date.now() - collectStartedAt,
      collected: Boolean(collected),
      heap: getHeapSnapshot(),
    }));

    if (!collected) {
      return { status: 'completed', message: 'skipped: no features' };
    }
    const {
      collection,
      featureStats,
      bufferSizes,
      featuresByContinent,
    } = collected;

    const {
      adminFeatureSummary,
      tilesByZoom,
      totalTiles,
      parentInputMetadata,
      buildCompletedResult,
      parentInputSummary,
    } = buildVtParentMetadata(band, parent, collected);
    const totalBufferBytes = Array.from(bufferSizes.values()).reduce((sum, size) => sum + size, 0);
    const maxBufferBytes = Array.from(bufferSizes.values()).reduce(
      (max, size) => (size > max ? size : max),
      0,
    );

    console.info('[vt] feature collection ready', JSON.stringify({
      ...taskContext,
      features: collection.features.length,
      bufferBytes: totalBufferBytes,
      maxBufferBytes,
      duration: Date.now() - collectStartedAt,
      heap: getHeapSnapshot(),
    }));
    const layerResult = await buildLayersForVtTask({
      context,
      taskContext,
      band,
      parent,
      collection,
      featuresByContinent,
      featureStats,
      debugCollect,
      debugFocusConfig,
      groupByContinent,
      useTopojsonTileSimplify,
      topojsonSimplify,
      totalTiles,
      intersectingFeatureCount: parentInputSummary.intersectingFeatureCount,
      completedWithParentInputSummary: buildCompletedResult,
    });
    if (layerResult.kind === 'skipped') {
      return layerResult.result;
    }
    console.info('[vt] vtpbf load start', JSON.stringify({
      ...taskContext,
      heap: getHeapSnapshot(),
    }));
    const vtpbfStartedAt = Date.now();
    const vtpbf = await loadVtPbf();
    console.info('[vt] vtpbf load done', JSON.stringify({
      ...taskContext,
      duration: Date.now() - vtpbfStartedAt,
      heap: getHeapSnapshot(),
    }));

    return writeVtTiles({
      context,
      task,
      input,
      taskContext,
      parent,
      band: {
        zMin: band.zMin,
        zMax: band.zMax,
      },
      parentInputMetadata,
      featureStats,
      bufferSizes,
      tilesByZoom,
      totalTiles,
      adminFeatureSummary,
      aggregatedLayersByTileId: layerResult.aggregatedLayersByTileId,
      indexes: layerResult.indexes,
      vtpbf,
      debugCollect,
    });
  } catch (error) {
    console.error('[vt] task failed', JSON.stringify({
      ...taskContext,
      stage: 'task',
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
};
