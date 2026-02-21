import type { BandConfig, StageHandlerResult } from '~/types/types';
import { buildVtParentMetadata } from './vtStageTaskMetadata.js';
import type { CollectedVtFeatures } from './vtStageTaskTypes.js';

export type TaskCollectionMetadata = {
  adminFeatureSummary: string;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  totalTiles: number;
  parentInputMetadata: Record<string, unknown>;
  intersectingFeatureCount: number;
  parentInputSummary: ReturnType<typeof buildVtParentMetadata> extends {
    parentInputSummary: infer P
  } ? P : never;
  buildCompletedResult: (message: string) => StageHandlerResult;
};

export const buildTaskCollectionMetadata = (
  band: BandConfig,
  parent: { z: number; x: number; y: number },
  collected: CollectedVtFeatures,
): TaskCollectionMetadata => {
  const metadata = buildVtParentMetadata(band, parent, collected);
  return {
    adminFeatureSummary: metadata.adminFeatureSummary,
    tilesByZoom: metadata.tilesByZoom,
    totalTiles: metadata.totalTiles,
    parentInputMetadata: metadata.parentInputMetadata,
    intersectingFeatureCount: metadata.parentInputSummary.intersectingFeatureCount,
    parentInputSummary: metadata.parentInputSummary,
    buildCompletedResult: metadata.buildCompletedResult,
  };
};
