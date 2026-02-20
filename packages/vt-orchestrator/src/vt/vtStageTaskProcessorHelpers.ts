import { unpackTileId } from '~/tiles/tileId';
import type { VTStageContext } from '~/contexts';
import type { BandConfig, StageHandlerResult, VtTaskInput } from '~/types/types';
import {
  buildAdminFeatureSummary,
  buildTilesByZoom,
  buildVtParentInputSummary,
} from './vtStageCore.js';
import { collectFeatures } from './vtStageFeatureCollector.js';
import {
  VT_PARENT_INPUT_SUMMARY_METADATA_KEY,
  tileToBBox,
} from './vtStageGeometry.js';
import { buildSkippedMessage, buildTileSummary } from './vtStageSummary.js';
import { resolveVtDebugFocusConfig } from './vtStageDebug.js';

type RawCollectedVtFeatures = Awaited<ReturnType<typeof collectFeatures>>;

export type TaskContextForVt = {
  taskId: string;
  nodeId: string;
  bandIndex?: number;
  tileId: number;
  bufferCount: number;
};

type VtTaskPreparationInput = {
  context: VTStageContext;
  task: {
    taskId: string;
    nodeId: string | number;
    inputData?: VtTaskInput | null;
  };
};

export type TopojsonSimplifyConfig = {
  enabled: boolean;
  toleranceK: number;
  retryToleranceStep: number;
  quantize?: number;
} | null;

export type VtTaskPreparationResult =
  | {
    kind: 'ready';
    taskContext: TaskContextForVt;
    band: BandConfig;
    parent: { z: number; x: number; y: number };
    debugCollect: boolean;
    debugFocusConfig: ReturnType<typeof resolveVtDebugFocusConfig>;
    groupByContinent: boolean;
    useTopojsonTileSimplify: boolean;
    topojsonSimplify: TopojsonSimplifyConfig;
    bufferIds: string[];
    bufferIdSample: string[];
  }
  | { kind: 'skipped'; result: StageHandlerResult };

export const prepareVtTaskExecution = (params: VtTaskPreparationInput): VtTaskPreparationResult => {
  const { context, task } = params;
  const { bands, vtConfig } = context;
  const layerSetName = vtConfig.layerSetName;
  if (!layerSetName) {
    throw new Error('vt stage requires layerSetName');
  }
  const input = task.inputData;
  if (!input) {
    return {
      kind: 'skipped',
      result: { status: 'failed', errorMessage: 'vt task input is missing' },
    };
  }

  const bufferIds = input.bufferIds ?? [];
  const bufferIdSample = bufferIds.length > 0 ? bufferIds.slice(0, Math.min(bufferIds.length, 3)) : [];
  const taskContext: TaskContextForVt = {
    taskId: task.taskId,
    nodeId: String(task.nodeId),
    bandIndex: input.bandIndex,
    tileId: input.tileId,
    bufferCount: bufferIds.length,
  };
  if (!input.bufferIds || input.bufferIds.length === 0) {
    return {
      kind: 'skipped',
      result: { status: 'completed', message: 'skipped: bufferIds is empty' },
    };
  }
  const band = bands.find((entry) => entry.bandIndex === input.bandIndex);
  if (!band) {
    return {
      kind: 'skipped',
      result: { status: 'failed', errorMessage: `Unknown bandIndex: ${input.bandIndex}` },
    };
  }
  const noOpBand0Topojson = input.bandIndex === 0 && band.zMin <= 2 && context.topojsonSource === true;
  if (noOpBand0Topojson) {
    return {
      kind: 'skipped',
      result: {
        status: 'completed',
        progress: 100,
        message: `skipped: topojson band0 no-op (zMin=${band.zMin})`,
        display: {
          kind: 'skip',
          key: 'stage.taskSkip.noOp',
          params: {
            bandIndex: input.bandIndex,
            bandMinZoom: band.zMin,
          },
        },
        outputData: {
          processedPolygons: 0,
          totalPolygons: 0,
        },
      },
    };
  }

  const parent = unpackTileId(input.tileId, band.zBase);
  const groupByContinent = Boolean(
    context.continentByCountry
    && parent.z === 0
    && parent.x === 0
    && parent.y === 0,
  );
  const useTopojsonTileSimplify = Boolean(context.topojsonSimplify?.enabled);
  const topojsonSimplify = useTopojsonTileSimplify && context.topojsonSimplify
    ? {
      enabled: true,
      toleranceK: context.topojsonSimplify.toleranceK,
      retryToleranceStep: context.topojsonSimplify.retryToleranceStep,
      quantize: context.topojsonSimplify.quantize,
    }
    : null;
  return {
    kind: 'ready',
    taskContext,
    band,
    parent,
    debugCollect: (globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true,
    debugFocusConfig: resolveVtDebugFocusConfig(vtConfig.debug),
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    bufferIds,
    bufferIdSample,
  };
};

export type CollectedVtFeatures = NonNullable<RawCollectedVtFeatures>;

export const collectTaskFeatures = async (
  context: VTStageContext,
  input: {
    nodeId: string;
    bufferIds: string[];
    groupByContinent: boolean;
    taskId: string;
    bandIndex: number;
  },
): Promise<CollectedVtFeatures | null> => {
  const collectPromise = collectFeatures(
    context,
    input.bufferIds,
    input.nodeId,
    { groupByContinent: input.groupByContinent, continentByCountry: context.continentByCountry },
  );
  const testTimeoutMs = (globalThis as { __HDB_VT_COLLECT_TIMEOUT_MS?: number }).__HDB_VT_COLLECT_TIMEOUT_MS;
  const collected = typeof testTimeoutMs === 'number' && testTimeoutMs > 0
    ? await new Promise<Awaited<typeof collectPromise>>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(
          `[vt] collect timeout after ${testTimeoutMs}ms (nodeId=${input.nodeId}, taskId=${input.taskId})`
        ));
      }, testTimeoutMs);
      collectPromise
        .then((value) => resolve(value))
        .catch((error) => reject(error))
        .finally(() => clearTimeout(timeoutId));
    })
    : await collectPromise;
  return collected;
};

export const buildVtParentMetadata = (
  band: BandConfig,
  parent: { z: number; x: number; y: number },
  collected: CollectedVtFeatures,
) => {
  const { collection, featureStats } = collected;
  const adminFeatureSummary = buildAdminFeatureSummary(collection);
  const tilesByZoom = buildTilesByZoom(band, parent);
  const tileSummary = buildTileSummary(tilesByZoom);
  const parentBBox = tileToBBox(parent.z, parent.x, parent.y);
  const parentInputSummary = buildVtParentInputSummary({
    featureStats,
    parentBBox,
    parentTile: parent,
  });
  const parentInputMetadata = {
    [VT_PARENT_INPUT_SUMMARY_METADATA_KEY]: parentInputSummary,
  };
  const totalTiles = Array.from(tilesByZoom.values()).reduce((sum, counts) => sum + counts.total, 0);
  return {
    adminFeatureSummary,
    tilesByZoom,
    totalTiles,
    tileSummary,
    featureStats,
    parentBBox,
    parentInputSummary,
    parentInputMetadata,
    buildCompletedResult: (message: string): StageHandlerResult => ({
      status: 'completed',
      message: buildSkippedMessage(adminFeatureSummary, tileSummary, message),
      metadata: parentInputMetadata,
    }),
  };
};
