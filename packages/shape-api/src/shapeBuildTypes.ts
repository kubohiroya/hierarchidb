import type { NodeId } from '@hierarchidb/core-types';

export type ShapeDataSourceName = 'naturalearth' | 'geoboundaries' | 'geoboundaries-topojson' | 'gadm' | 'openstreetmap';
export type ShapeBuildStage =
  | 'fetch'
  | 'transform'
  | 'vt';
export type ShapeBuildTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'regression';

export type ShapeFetchTaskPayload = {
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

export type ShapeFetchTaskResult = {
  outputBufferId?: string;
  bytesWritten?: number;
  featureCount?: number;
};

export type ShapeTransformTaskPayload = {
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

export type ShapeTransformTaskResult = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
  processedPolygons?: number;
  totalPolygons?: number;
};
/*
export type ShapeExtract2TaskPayload = {
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

export type ShapeExtract2TaskResult = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
  retry?: number;
};
*/

export type ShapeVTTaskPayload = {
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

export type ShapeVTTaskResult = {
  tileId: string;
  tileCount?: number;
  totalBytes?: number;
  retry?: number;
};

export type ShapeBuildTaskPayload =
  | ShapeFetchTaskPayload
  | ShapeTransformTaskPayload
  //| ShapeExtract2TaskPayload
  | ShapeVTTaskPayload;

export type ShapeBuildTaskResult =
  | ShapeFetchTaskResult
  | ShapeTransformTaskResult
  | ShapeVTTaskResult;

export interface ShapeBuildTaskRecord<
  TInput = ShapeBuildTaskPayload,
  TOutput = ShapeBuildTaskResult
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

export type ShapeBuildTaskRecordInput = Omit<ShapeBuildTaskRecord, 'taskType'> & {
  taskType: ShapeBuildStage;
};

export type ShapeBuildTaskRecordUpdate = Partial<Omit<ShapeBuildTaskRecord, 'taskType'>> & {
  taskType?: never;
};


export interface ShapeFetchCache {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  timestamp: number;
}

export interface ShapeTransformCache {
  id: string;
  nodeId: NodeId;
  bandIndex: number;
  domainType: 'shape' | 'route';
  sourceKey: string;
  data: ArrayBuffer;
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
  countryCode?: string;
  adminLevel?: number;
}

export interface ShapeVTMetadata {
  key: string;
  nodeId: string;
  z: number;
  x: number;
  y: number;
  size: number;
  contentType: string;
  timestamp: number;
}

export interface ShapeFeatureMetadata {
  id: string;
  nodeId: string;
  featureId: string;
  countryName?: string;
  countryCode?: string;
  adminLevel?: number;
  admin0Name?: string;
  admin0Code?: string;
  admin1Name?: string;
  admin1Code?: string;
  admin2Name?: string;
  admin2Code?: string;
  dataSource?: string;
  createdAt: number;
  vertexCount: number;
  polygonCount: number;
  fetchVertexCount?: number;
  fetchPolygonCount?: number;
  transformVertexCount?: number;
  transformPolygonCount?: number;
  geojsonByteSize?: number;
  bbox?: [number, number, number, number];
  area: number;
  recycling?: boolean;
}

export interface ShapeDataSourceMetadata {
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

export type ShapeErrorLineString = {
  type: 'LineString';
  coordinates: number[][];
};

export type ShapeErrorLineFeature = {
  type: 'Feature';
  id?: string | number;
  geometry: ShapeErrorLineString;
  properties?: Record<string, unknown>;
};

export type ShapeErrorLineFeatureCollection = {
  type: 'FeatureCollection';
  features: ShapeErrorLineFeature[];
};

export interface ShapeTransformErrorRecord {
  id: string;
  nodeId: NodeId;
  taskId: string;
  stage: ShapeBuildStage;
  issueStage?: string;
  issueKind?: string;
  bandIndex?: number;
  sourceKey?: string;
  countryCode?: string;
  countryName?: string;
  continentName?: string;
  adminLevel?: number;
  featureId?: string;
  featureIndex?: number;
  geometryType?: string;
  polygonCount: number;
  ringCount: number;
  polygonErrorCount: number;
  ringErrorCount: number;
  message?: string;
  createdAt: number;
  lineFeatures: ShapeErrorLineFeatureCollection;
}
