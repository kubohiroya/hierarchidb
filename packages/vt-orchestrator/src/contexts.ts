import type { EphemeralShapeDB } from '@hierarchidb/gis-sdk';
import type { GeometryEngine, TransformConfig, VTConfig } from '@hierarchidb/gis-sdk';
import type { BandConfig } from './types/types.js';

export type TransformByBandStageContext = {
  ephemeralDB: EphemeralShapeDB;
  transformConfig: TransformConfig;
  bands: BandConfig[];
  featureIdAllowlist?: Set<string>;
  abortSignal?: AbortSignal;
};

export type VtTileWriter = (tile: {
  tileId: number;
  z: number;
  x: number;
  y: number;
  bufferSetHash: string;
  data: ArrayBuffer;
  layers: Record<string, import('geojson-vt').Tile>;
}) => Promise<void>;

export type VTStageContext = {
  ephemeralDB: EphemeralShapeDB;
  vtConfig: VTConfig;
  bands: BandConfig[];
  geometryEngine: GeometryEngine;
  abortSignal?: AbortSignal;
  tileWriter: VtTileWriter;
  continentByCountry?: Map<string, string>;
  featureGeojsonByteSizeById?: Map<string, number>;
};
