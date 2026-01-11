import type { NodeId } from '@hierarchidb/common-types';

export type ShapeDataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';
export type ShapeBuildStage =
  | 'fetch'
  | 'transform'
  | 'vt';
export type ShapeBuildTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'regression';

export type ShapeFetchTaskInputData = {
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

export type ShapeFetchTaskOutputData = {
  outputBufferId?: string;
  bytesWritten?: number;
  featureCount?: number;
};

export type ShapeTransformTaskInputData = {
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

export type ShapeTransformTaskOutputData = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
};
/*
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
*/

export type ShapeVTTaskInputData = {
  inputBufferId: string;
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

export type ShapeVTTaskOutputData = {
  tileId: string;
  tileCount?: number;
  totalBytes?: number;
  retry?: number;
};

export type ShapeBuildTaskInputData =
  | ShapeFetchTaskInputData
  | ShapeTransformTaskInputData
  //| ShapeExtract2TaskInputData
  | ShapeVTTaskInputData;

export type ShapeBuildTaskOutputData =
  | ShapeFetchTaskOutputData
  | ShapeTransformTaskOutputData
  | ShapeVTTaskOutputData;

export interface ShapeBuildTaskRecord<
  TInput = ShapeBuildTaskInputData,
  TOutput = ShapeBuildTaskOutputData
> {
  taskId: string;
  nodeId: NodeId;
  taskType: ShapeBuildStage;
  status: ShapeBuildTaskStatus;
  index: number;
  progress: number;
  message?: string;
  retryCount?: number;
  inputData?: TInput;
  outputData?: TOutput;
  errorMessage?: string;
}

export interface ShapeFetchBufferRecord {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  timestamp: number;
}

export interface ShapeTransformSourceBufferRecord {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
  countryCode?: string;
  adminLevel?: number;
}

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
  fetchVertexCount?: number;
  fetchPolygonCount?: number;
  transformVertexCount?: number;
  transformPolygonCount?: number;
  vtVertexCount?: number;
  vtPolygonCount?: number;
  bbox?: [number, number, number, number];
}
