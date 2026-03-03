import type { VtCollectionResult, VtLayerRunInput, VtTaskRunInput } from './vtStageTaskTypes.js';

export const buildLayerRunInput = ({
  runInput,
  collection,
}: {
  runInput: VtTaskRunInput;
  collection: Pick<VtCollectionResult, 'totalTiles' | 'intersectingFeatureCount'>;
}): VtLayerRunInput => ({
  ...runInput,
  totalTiles: collection.totalTiles,
  intersectingFeatureCount: collection.intersectingFeatureCount,
});
