import type { TaskLayerContext } from './vtStageTaskLayerBuilderTypes.js';

type LayerBuildLogInput = {
  taskContext: TaskLayerContext;
  debugCollect: boolean;
  extra?: Record<string, unknown>;
};

export const logLayerIndexBuildStart = ({
  taskContext,
  layerCount,
  debugCollect,
  extra,
}: LayerBuildLogInput & {
  layerCount: number;
}): void => {
  if (!debugCollect) {
    return;
  }
  console.info('[tileEmit][debug] buildLayerIndexes start', JSON.stringify({
    ...taskContext,
    ...extra,
    layerCount,
    heap: null,
  }));
};

export const logLayerIndexBuildDone = ({
  taskContext,
  indexCount,
  debugCollect,
  extra,
}: LayerBuildLogInput & {
  indexCount: number;
}): void => {
  if (!debugCollect) {
    return;
  }
  console.info('[tileEmit][debug] buildLayerIndexes done', JSON.stringify({
    ...taskContext,
    ...extra,
    indexCount,
    heap: null,
  }));
};
