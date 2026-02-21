import type { Feature, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { BandConfig, StageHandlerResult } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import type { InputFeatureStats } from './vtStageGeometryTypes.js';
import type { VtDebugFocusConfig } from './vtStageDebug.js';
import type { GeojsonVtIndex } from './vtStageTileIndex.js';

export type TaskLayerContext = {
  taskId: string;
  nodeId: string;
  bandIndex?: number;
  tileId: number;
  bufferCount: number;
};

export type LayerMap = Map<string, Feature<Geometry>[]>;

export type VtLayerBuildResult = {
  kind: 'ready';
  aggregatedLayersByTileId: Map<number, Record<string, Tile>> | null;
  indexes: Map<string, GeojsonVtIndex> | null;
} | {
  kind: 'skipped';
  result: StageHandlerResult;
};

export type BuildLayerIndexForTile = (
  layerName: string,
  features: Feature<Geometry>[],
  z: number,
  x: number,
  y: number,
) => Promise<Tile | null>;

export type LayerBuildBranchResult = {
  aggregatedLayersByTileId: Map<number, Record<string, Tile>> | null;
  indexes: Map<string, GeojsonVtIndex> | null;
};

export type VtLayerBuildInput = {
  context: VTStageContext;
  taskContext: TaskLayerContext;
  band: BandConfig;
  parent: {
    z: number;
    x: number;
    y: number;
  };
  collection: {
    type: 'FeatureCollection';
    features: Feature<Geometry>[];
  };
  featuresByContinent?: Map<string, Feature<Geometry>[]> | undefined;
  featureStats: InputFeatureStats[];
  debugCollect: boolean;
  debugFocusConfig: VtDebugFocusConfig;
  groupByContinent: boolean;
  useTopojsonTileSimplify: boolean;
  topojsonSimplify: {
    enabled: boolean;
    toleranceK: number;
    retryToleranceStep: number;
    quantize?: number;
  } | null;
  totalTiles: number;
  intersectingFeatureCount: number;
  completedWithParentInputSummary: (message: string) => StageHandlerResult;
};
