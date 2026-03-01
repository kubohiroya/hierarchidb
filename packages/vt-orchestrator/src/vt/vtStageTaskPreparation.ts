import { unpackTileId } from '~/tiles/tileId';
import type { VTStageContext } from '~/contexts';
import type { BandConfig, StageHandlerResult, VtTaskInput } from '~/types/types';
import { resolveVtDebugFocusConfig } from './vtStageDebug.js';
import type { TaskContextForVt, VtTaskExecutionInput } from './vtStageTaskTypes.js';

type VtTaskPreparationInput = {
  context: VTStageContext;
  task: VtTaskExecutionInput;
};

type TopojsonSimplifyConfig = {
  enabled: boolean;
  toleranceK: number;
  retryToleranceStep: number;
  quantize?: number;
} | null;

export type VtTaskPreparationResult =
  | {
    kind: 'ready';
    input: VtTaskInput;
    taskContext: TaskContextForVt;
    band: BandConfig;
    parent: { z: number; x: number; y: number };
    layerSetName: string;
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
  const { bands, tileEmitConfig } = context;
  const layerSetName = tileEmitConfig.layerSetName;
  if (!layerSetName) {
    return {
      kind: 'skipped',
      result: { status: 'failed', errorMessage: 'tileEmit stage requires layerSetName' },
    };
  }
  const input = task.inputData;
  if (!input) {
    return {
      kind: 'skipped',
      result: { status: 'failed', errorMessage: 'tileEmit task input is missing' },
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
    input,
    taskContext,
    band,
    parent,
    layerSetName,
    debugCollect: (globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true,
    debugFocusConfig: resolveVtDebugFocusConfig(tileEmitConfig.debug),
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    bufferIds,
    bufferIdSample,
  };
};
