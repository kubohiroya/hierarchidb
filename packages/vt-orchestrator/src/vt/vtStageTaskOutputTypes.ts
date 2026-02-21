export type VtTileTaskContext = {
  taskId: string;
  nodeId: string;
  bandIndex?: number;
  tileId: number;
  bufferCount: number;
};

export type VtTileParent = {
  z: number;
  x: number;
  y: number;
};

export type VtTileBandRange = {
  zMin: number;
  zMax: number;
};

export type VtTileOutputCounts = {
  processedTiles: number;
  generatedTiles: number;
};

export type VtTileOutputContext = {
  context: import('~/contexts').VTStageContext;
  task: {
    taskId: string;
    nodeId: string | number;
  };
  input: import('~/types/types').VtTaskInput;
  taskContext: VtTileTaskContext;
  parent: VtTileParent;
  band: VtTileBandRange;
  parentInputMetadata: Record<string, unknown>;
  featureStats: import('./vtStageGeometryTypes.js').InputFeatureStats[];
  bufferSizes: Map<string, number>;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  totalTiles: number;
  adminFeatureSummary: string;
  aggregatedLayersByTileId: Map<number, Record<string, import('geojson-vt').Tile>> | null;
  indexes: Map<string, import('./vtStageTileIndex.js').GeojsonVtIndex> | null;
  vtpbf: typeof import('@maplibre/vt-pbf');
  debugCollect: boolean;
};

export type VtTileProgressReporter = (state: {
  processedTiles: number;
  generatedTiles: number;
  force?: boolean;
  message?: string;
}) => Promise<unknown>;

export type VtTileOutputWriterInput = {
  context: import('~/contexts').VTStageContext;
  taskContext: VtTileTaskContext;
  parent: VtTileParent;
  band: VtTileBandRange;
  featureStats: import('./vtStageGeometryTypes.js').InputFeatureStats[];
  bufferSizes: Map<string, number>;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  totalTiles: number;
  aggregatedLayersByTileId: Map<number, Record<string, import('geojson-vt').Tile>> | null;
  indexes: Map<string, import('./vtStageTileIndex.js').GeojsonVtIndex> | null;
  vtConfig: import('~/contexts').VTStageContext['vtConfig'];
  tileWriter: import('~/contexts').VTStageContext['tileWriter'];
  vtpbf: typeof import('@maplibre/vt-pbf');
  debugCollect: boolean;
  bufferSetHash: string;
  reportTileProgress: VtTileProgressReporter;
  totals: import('./vtStageTaskOutputStats.js').VtTileOutputAggregates;
};
