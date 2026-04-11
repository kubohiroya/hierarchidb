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
  context: import('~/contextTypes').VTStageContext;
  task: {
    taskId: string;
    nodeId: string | number;
  };
  input: import('~/types/types').VtTaskInput;
  taskContext: VtTileTaskContext;
  parent: VtTileParent;
  band: VtTileBandRange;
  parentInputMetadata: Record<string, unknown>;
  featureStats: import('./TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js').InputFeatureStats[];
  bufferSizes: Map<string, number>;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  totalTiles: number;
  adminFeatureSummary: string;
  aggregatedLayersByTileId: Map<number, Record<string, import('geojson-vt').Tile>> | null;
  indexes: Map<string, import('./buildTileLayerIndexFromFeatures.js').GeojsonVtIndex> | null;
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
  context: import('~/contextTypes').VTStageContext;
  taskContext: VtTileTaskContext;
  parent: VtTileParent;
  band: VtTileBandRange;
  featureStats: import('./TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js').InputFeatureStats[];
  bufferSizes: Map<string, number>;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  totalTiles: number;
  aggregatedLayersByTileId: Map<number, Record<string, import('geojson-vt').Tile>> | null;
  indexes: Map<string, import('./buildTileLayerIndexFromFeatures.js').GeojsonVtIndex> | null;
  tileEmitConfig: import('~/contextTypes').VTStageContext['tileEmitConfig'];
  tileWriter: import('~/contextTypes').VTStageContext['tileWriter'];
  vtpbf: typeof import('@maplibre/vt-pbf');
  debugCollect: boolean;
  bufferSetHash: string;
  reportTileProgress: VtTileProgressReporter;
  totals: import('./vtStageTaskOutputStats.js').VtTileOutputAggregates;
};
