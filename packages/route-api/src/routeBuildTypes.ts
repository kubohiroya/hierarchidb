import type { NodeId } from '@hierarchidb/core-types';

export type RouteTileIndexRequest = {
  nodeId: NodeId;
  minZoom: number;
  maxZoom: number;
  zoomBandBoundaries?: number[];
  minDistanceMetersByBand?: number[];
  simplifyToleranceByBand?: number[];
};

export type RouteTileIndexResult = {
  tileCount: number;
  lineCount: number;
  minZoom: number;
  maxZoom: number;
};

export type RouteVectorTileBuildRequest = {
  nodeId: NodeId;
  minZoom: number;
  maxZoom: number;
  zoomBandBoundaries?: number[];
  bufferSize?: number;
  inputFormat?: 'geojson' | 'flatgeobuf';
  inputCompression?: 'gzip' | 'none';
};

export type RouteVectorTileBuildResult = {
  tilesGenerated: number;
  totalBytes: number;
  zoomMin?: number;
  zoomMax?: number;
};

export type RouteBuildError = {
  id: string;
  stage: 'fetch' | 'transform' | 'vt';
  message: string;
  sourceKey?: string;
  featureId?: string;
  createdAt: number;
};
