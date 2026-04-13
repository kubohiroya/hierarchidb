// ============================================================
// Type definitions for vector tile generation.
// ============================================================

import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import type { FeatureMetadataRow } from '@hierarchidb/vectortile-store';
import type { GeometryEngine } from '../configTypes.js';

export type GeojsonVtModule = typeof import('geojson-vt');
export type GeojsonVtData = Parameters<GeojsonVtModule>[0];

export type VTMetadataContext = {
  dataSource?: string;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
};

export type VTGenerateConfig = {
  format?: 'mvt';
  compression?: 'gzip' | 'none';
  buffer?: number;
  minZoom?: number;
  maxZoom?: number;
  inputFormat?: 'geojson' | 'flatgeobuf';
  metadataEnabled?: boolean;
  metadataReplace?: boolean;
  metadataContext?: VTMetadataContext;
  geometryEngine?: GeometryEngine;
  signal?: AbortSignal;
};

export type VTGenerateResult = {
  tilesGenerated: number;
  totalBytes: number;
  metadataCount?: number;
  tiles: VectorTileRow[];
  featureMetadata?: FeatureMetadataRow[];
};

export type VectorTileRow = {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
  size: number;
  contentType: 'application/vnd.mapbox-vector-tile';
  timestamp: number;
};

export type VectorTileProgress = {
  total: number;
  completed: number;
  percent: number;
  zoom: number;
  x: number;
  y: number;
};

export type FeatureCollectionLike = FeatureCollection<Geometry, GeoJsonProperties>;
