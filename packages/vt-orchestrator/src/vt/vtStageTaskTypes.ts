import type { BandConfig, VtTaskInput } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import type { FeatureCollection, Feature } from 'geojson';
import type { InputFeatureStats } from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';

export type TaskContextForVt = {
  taskId: string;
  nodeId: string;
  bandIndex?: number;
  tileId: number;
  bufferCount: number;
};

export type VtTaskRunInput = {
  context: VTStageContext;
  taskContext: TaskContextForVt;
  band: BandConfig;
  parent: { z: number; x: number; y: number };
  debugCollect: boolean;
  debugFocusConfig: {
    enabled: boolean;
    logAll: boolean;
    tileKeys: Set<string>;
    featureIds: Set<string>;
  };
  groupByContinent: boolean;
  useTopojsonTileSimplify: boolean;
  topojsonSimplify: {
    enabled: boolean;
    toleranceK: number;
    retryToleranceStep: number;
    quantize?: number;
  } | null;
};

export type VtTaskCollectInput = VtTaskRunInput & {
  input: {
    bufferIds: string[];
  };
};

export type VtTaskExecutionInput = {
  taskId: string;
  nodeId: string | number;
  inputData?: VtTaskInput | null;
};

export type VtTaskRunMetadata = Pick<VtTaskExecutionInput, 'taskId' | 'nodeId'>;

export type CollectedVtFeatures = {
  collection: FeatureCollection;
  featureStats: InputFeatureStats[];
  bufferSizes: Map<string, number>;
  featuresByContinent?: Map<string, Feature[]>;
};

export type VtCollectionResult = Omit<
  CollectedVtFeatures,
  'collection' | 'featureStats' | 'bufferSizes' | 'featuresByContinent'
> & {
  collection: CollectedVtFeatures['collection'];
  featureStats: CollectedVtFeatures['featureStats'];
  bufferSizes: CollectedVtFeatures['bufferSizes'];
  featuresByContinent?: CollectedVtFeatures['featuresByContinent'];
  adminFeatureSummary: string;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  totalTiles: number;
  parentInputMetadata: Record<string, unknown>;
  intersectingFeatureCount: number;
  buildCompletedResult: (message: string) => import('~/types/types').StageHandlerResult;
};

export type VtLayerRunInput = VtTaskRunInput & {
  totalTiles: number;
  intersectingFeatureCount: number;
};
