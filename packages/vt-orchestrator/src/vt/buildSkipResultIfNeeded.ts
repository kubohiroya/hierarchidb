import type { StageHandlerResult } from '~/types/types';
import type { VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';
import {
  isLayerBuildSkipMode,
  layerBuildSkipReason,
} from './vtStageTaskLayerBuilderPolicy.js';
import type { SkipCheckInput } from './vtStageTaskLayerBuilderFlowSkipTypes.js';

const resolveNoLayerSkipResult = (
  input: SkipCheckInput,
): { kind: 'skipped'; result: StageHandlerResult } | null => {
  const {
    taskContext,
    parent,
    layerBuildPolicy,
    totalFeatures,
    featureStats,
    completedWithParentInputSummary,
  } = input;
  const completed = (reason: string): StageHandlerResult => completedWithParentInputSummary(reason);

  if (layerBuildPolicy.mode === 'skipNoTiles') {
    return {
      kind: 'skipped',
      result: completed(layerBuildPolicy.skipReason ?? layerBuildSkipReason.noTiles),
    };
  }

  if (layerBuildPolicy.mode === 'skipNoIntersectingFeatures') {
    const sample = featureStats.slice(0, 3).map((stats) => ({
      bbox: stats.bbox,
      vertexCount: stats.vertexCount,
      polygonCount: stats.polygonCount,
      lineStringCount: stats.lineStringCount,
      bufferId: stats.bufferId,
      featureId: stats.featureId,
      geojsonByteSize: stats.geojsonByteSize,
    }));
    console.warn(layerBuildSkipReason.noIntersectingFeatures, JSON.stringify({
      ...taskContext,
      parentTile: parent,
      totalFeatures,
      featureStatsCount: featureStats.length,
      sample,
    }));
    return {
      kind: 'skipped',
      result: completed(layerBuildPolicy.skipReason ?? layerBuildSkipReason.noIntersectingFeatures),
    };
  }

  return null;
};

export const buildSkipResultIfNeeded = (
  input: SkipCheckInput,
): VtLayerBuildResult | null => {
  if (isLayerBuildSkipMode(input.layerBuildPolicy.mode)) {
    const skipped = resolveNoLayerSkipResult(input);
    if (skipped) {
      return skipped;
    }
  }
  if (input.layerBuildPolicy.mode !== 'skipNoLayers') {
    return null;
  }
  return {
    kind: 'skipped',
    result: input.completedWithParentInputSummary(input.layerBuildPolicy.skipReason ?? layerBuildSkipReason.noLayers),
  };
};
