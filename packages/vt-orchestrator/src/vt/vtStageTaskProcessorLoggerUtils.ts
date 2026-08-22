import type { getHeapSnapshot as getHeapSnapshotType } from './vtStageCoreUtils.js';
import type { TaskContextForVt, VtTaskRunInput } from './vtStageTaskTypes.js';

type VtTaskProcessorLogContext = {
  taskContext: TaskContextForVt;
  band: VtTaskRunInput['band'];
  layerSetName: string;
  bufferIdSample: string[];
  groupByContinent: boolean;
};

export const logVtTaskStart = (input: VtTaskProcessorLogContext): void => {
  const { taskContext, band, layerSetName, bufferIdSample, groupByContinent } = input;

  if (groupByContinent) {
    console.info(
      '[tileEmit] continent grouping enabled',
      JSON.stringify({
        ...taskContext,
        zRange: [band.zMin, band.zMax],
      })
    );
  }
  console.info(
    '[tileEmit] task start',
    JSON.stringify({
      ...taskContext,
      zRange: [band.zMin, band.zMax],
      layerSetName,
      bufferIdSample,
    })
  );
};

export const logVtTaskFocusConfig = (
  taskContext: TaskContextForVt,
  debugFocusConfig: VtTaskRunInput['debugFocusConfig']
): void => {
  if (!debugFocusConfig.enabled) {
    return;
  }
  console.info(
    '[tileEmit][focus] enabled',
    JSON.stringify({
      ...taskContext,
      logAll: debugFocusConfig.logAll,
      tileFilters: Array.from(debugFocusConfig.tileKeys).slice(0, 20),
      featureFilters: Array.from(debugFocusConfig.featureIds).slice(0, 20),
    })
  );
};

export const logVtCollectStart = (
  taskContext: TaskContextForVt,
  bufferCount: number,
  heap?: ReturnType<typeof getHeapSnapshotType> | string | null
): void => {
  console.info(
    '[tileEmit] collect start',
    JSON.stringify({
      ...taskContext,
      bufferCount,
      ...(heap === undefined ? {} : { heap }),
    })
  );
};

export const logVtCollectDuration = (taskContext: TaskContextForVt, durationMs: number): void => {
  console.info(
    '[tileEmit] collect duration',
    JSON.stringify({
      ...taskContext,
      duration: durationMs,
    })
  );
};

export const logVtTaskFailure = (taskContext: TaskContextForVt, error: unknown): void => {
  console.error(
    '[tileEmit] task failed',
    JSON.stringify({
      ...taskContext,
      stage: 'task',
      error: error instanceof Error ? error.message : String(error),
    })
  );
};
