import type { NodeId } from '@hierarchidb/common-types';

export type ShapeDataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';
export type ShapeBatchTaskStage = 'download' | 'extract1' | 'extract2' | 'vectortile';
export type ShapeBatchTaskStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'regression';

export type ShapeDownloadTaskInputData = {
  url?: string;
  dataSource?: ShapeDataSourceName;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  endpoint?: string;
  bbox?: [number, number, number, number];
  tags?: Array<
    | string
    | {
      key: string;
      value?: string;
      operator?: 'eq' | 'ne' | 'exists' | 'not_exists';
      includeNodes?: boolean;
    }
  >;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
};

export type ShapeDownloadTaskOutputData = {
  outputBufferId?: string;
  bytesWritten?: number;
  featureCount?: number;
};

export type ShapeExtract1TaskInputData = {
  inputBufferId?: string;
  sourceUrl?: string;
  featureId?: string;
  featureLabel?: string;
  featureGroupId?: string;
  featureIndex?: number;
  originKey?: string;
  originLabel?: string;
  adminCode?: string;
  dataSource?: ShapeDataSourceName;
  countryCode?: string;
  adminLevel?: number;
  continent?: string;
  countryName?: string;
};

export type ShapeExtract1TaskOutputData = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
};

export type ShapeExtract2TaskInputData = {
  inputBufferId?: string;
  sourceTaskId?: string;
  sourceUrl?: string;
  featureId?: string;
  featureLabel?: string;
  featureGroupId?: string;
  featureIndex?: number;
  originKey?: string;
  originLabel?: string;
  adminCode?: string;
  dataSource?: ShapeDataSourceName;
  countryCode?: string;
  adminLevel?: number;
  continent?: string;
  countryName?: string;
  zoomLevels?: number[];
  zoomRange?: [number, number];
  zoomRangeLabel?: string;
  tolerance?: number;
  vectorTileBuffer?: number;
  vectorTileExtent?: number;
  vectorTileMaxZoom?: number;
};

export type ShapeExtract2TaskOutputData = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
  retry?: number;
};

export type ShapeVectorTileTaskInputData = {
  inputBufferId: string;
  minZoom?: number;
  maxZoom?: number;
  tileZ?: number;
  tileX?: number;
  tileY?: number;
  extent?: number;
  tileSize?: number;
  buffer?: number;
  compression?: boolean;
  format?: 'mvt' | 'pbf';
  inputFormat?: 'geojson' | 'flatgeobuf';
  inputCompression?: 'gzip' | 'none';
  layers?: unknown[];
  outputBufferId?: string;
  dataSource?: ShapeDataSourceName;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  metadataEnabled?: boolean;
  metadataReplace?: boolean;
  metadataContext?: {
    dataSource?: string;
    countryCode?: string;
    countryName?: string;
    adminLevel?: number;
  };
};

export type ShapeVectorTileTaskOutputData = {
  tileId: string;
  tileCount?: number;
  totalBytes?: number;
  retry?: number;
};

export type ShapeBatchTaskInputData =
  | ShapeDownloadTaskInputData
  | ShapeExtract1TaskInputData
  | ShapeExtract2TaskInputData
  | ShapeVectorTileTaskInputData;

export type ShapeBatchTaskOutputData =
  | ShapeDownloadTaskOutputData
  | ShapeExtract1TaskOutputData
  | ShapeExtract2TaskOutputData
  | ShapeVectorTileTaskOutputData;

export interface ShapeBatchTaskRecord<
  TInput = ShapeBatchTaskInputData,
  TOutput = ShapeBatchTaskOutputData
> {
  taskId: string;
  nodeId: NodeId;
  taskType: ShapeBatchTaskStage;
  status: ShapeBatchTaskStatus;
  index: number;
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  retryCount?: number;
  inputData?: TInput;
  outputData?: TOutput;
  errorMessage?: string;
}

export interface ShapeRawBufferRecord {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  timestamp: number;
}

export interface ShapeExtract1SourceBufferRecord {
  id: string;
  nodeId: NodeId;
  stage: 'extract1';
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
  countryCode?: string;
  adminLevel?: number;
}

export interface ShapeExtract2SourceBufferRecord {
  id: string;
  nodeId: NodeId;
  stage: 'extract2';
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
  countryCode?: string;
  adminLevel?: number;
}

export type ShapeExtractSourceBufferRecord = ShapeExtract1SourceBufferRecord | ShapeExtract2SourceBufferRecord;

export interface ShapeTileRow {
  key: string;
  nodeId: string;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  contentType: string;
  timestamp: number;
}

export interface ShapeFeatureMetadataRow {
  id: string;
  nodeId: string;
  featureId: string;
  countryName?: string;
  countryCode?: string;
  adminName?: string;
  adminLevel?: number;
  adminCode?: string;
  dataSource?: string;
  createdAt: number;
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
  area: number;
}

export interface ShapeSourceMetadataRow {
  id: string;
  nodeId: string;
  originKey: string;
  originLabel: string;
  dataSource?: string;
  countryName?: string;
  countryCode?: string;
  continent?: string;
  adminLevel?: number;
  featureGroupId?: string;
  featureLabel?: string;
  createdAt: number;
  updatedAt: number;
  rawVertexCount?: number;
  rawPolygonCount?: number;
  extract1VertexCount?: number;
  extract1PolygonCount?: number;
  extract2VertexCount?: number;
  extract2PolygonCount?: number;
  vectorTileVertexCount?: number;
  vectorTilePolygonCount?: number;
  bbox?: [number, number, number, number];
}
