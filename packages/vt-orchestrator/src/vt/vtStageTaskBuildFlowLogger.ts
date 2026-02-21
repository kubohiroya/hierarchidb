import type { VtCollectionResult } from './vtStageTaskTypes.js';
import { getHeapSnapshot } from './vtStageCore.js';

export type FeatureCollectionBuildContext = {
  taskContext: {
    taskId: string;
    nodeId: string;
    bandIndex?: number;
    tileId: number;
    bufferCount: number;
  };
  collection: VtCollectionResult['collection'];
  bufferSizes: Map<string, number>;
};

export const logFeatureCollectionReady = ({
  taskContext,
  collection,
  bufferSizes,
}: FeatureCollectionBuildContext): void => {
  console.info('[vt] feature collection ready', JSON.stringify({
    ...taskContext,
    features: collection.features.length,
    bufferBytes: Array.from(bufferSizes.values()).reduce((sum, size) => sum + size, 0),
    maxBufferBytes: Array.from(bufferSizes.values()).reduce((max, size) => (size > max ? size : max), 0),
    heap: getHeapSnapshot(),
  }));
};
