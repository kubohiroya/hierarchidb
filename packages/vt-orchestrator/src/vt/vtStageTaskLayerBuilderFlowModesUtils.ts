import type { Tile } from 'geojson-vt';
import type { StageHandlerResult } from '~/types/types';
import type { GeojsonVtIndex } from './buildTileLayerIndexFromFeatures.js';
import type { VtLayerBuildResult, TaskLayerContext, LayerBuildBranchResult } from './vtStageTaskLayerBuilderTypes.js';
import { layerBuildSkipReason } from './vtStageTaskLayerBuilderPolicy.js';

type LayerBuildNoLayerLogInput = LayerBuildResultLogInput & {
  message: string;
  extra?: Record<string, unknown>;
};

type LayerBuildResultLogInput = {
  taskContext: TaskLayerContext;
  parent: { z: number; x: number; y: number };
  message: string;
  extra?: Record<string, unknown>;
};

const buildNoLayerResult = (
  message: string,
  completedWithParentInputSummary: (message: string) => StageHandlerResult,
): VtLayerBuildResult => ({
  kind: 'skipped',
  result: completedWithParentInputSummary(message),
});

const buildReadyLayerResult = (
  aggregatedLayersByTileId: Map<number, Record<string, Tile>> | null,
  indexes: Map<string, GeojsonVtIndex> | null,
): VtLayerBuildResult => ({
  kind: 'ready',
  aggregatedLayersByTileId,
  indexes,
});

const logNoLayerResult = ({
  taskContext,
  parent,
  message,
  extra,
}: LayerBuildResultLogInput): void => {
  if (!extra) {
    console.warn('[tileEmit] no layers', JSON.stringify({
      ...taskContext,
      parentTile: parent,
      reason: message,
    }));
    return;
  }

  console.warn(
    `[tileEmit] ${message}`,
    JSON.stringify({
      ...taskContext,
      parentTile: parent,
      ...extra,
    }),
  );
};

const isNoLayerBranch = (branchResult: LayerBuildBranchResult): boolean => {
  if (branchResult.aggregatedLayersByTileId === null) {
    return branchResult.indexes === null || branchResult.indexes.size === 0;
  }
  return branchResult.aggregatedLayersByTileId.size === 0;
};

export const buildNoLayerResultIfNeeded = ({
  branchResult,
  taskContext,
  parent,
  completedWithParentInputSummary,
  logInput,
}: {
  branchResult: LayerBuildBranchResult;
  taskContext: TaskLayerContext;
  parent: { z: number; x: number; y: number };
  completedWithParentInputSummary: (message: string) => StageHandlerResult;
  logInput?: LayerBuildNoLayerLogInput;
}): VtLayerBuildResult | null => {
  if (!isNoLayerBranch(branchResult)) {
    return null;
  }

  if (logInput) {
    logNoLayerResult({
      ...logInput,
      taskContext,
      parent,
    });
  }

  return buildNoLayerResult(layerBuildSkipReason.noLayers, completedWithParentInputSummary);
};

export const buildLayerResultFromBranch = ({
  branchResult,
  taskContext,
  parent,
  completedWithParentInputSummary,
  logInput,
}: {
  branchResult: LayerBuildBranchResult;
  taskContext: TaskLayerContext;
  parent: { z: number; x: number; y: number };
  completedWithParentInputSummary: (message: string) => StageHandlerResult;
  logInput?: LayerBuildNoLayerLogInput;
}): VtLayerBuildResult => {
  const skippedResult = buildNoLayerResultIfNeeded({
    branchResult,
    taskContext,
    parent,
    completedWithParentInputSummary,
    logInput,
  });
  if (skippedResult) {
    return skippedResult;
  }

  return buildReadyLayerResult(branchResult.aggregatedLayersByTileId, branchResult.indexes);
};
