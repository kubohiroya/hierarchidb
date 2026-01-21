import type { EphemeralShapeDB } from '@hierarchidb/shape-store';
import type { TransformConfig, VTConfig } from '@hierarchidb/gis-sdk';
import type { BandConfig } from './types/types.js';

export type TransformByBandStageContext = {
  ephemeralDB: EphemeralShapeDB;
  transformConfig: TransformConfig;
  bands: BandConfig[];
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
  abortSignal?: AbortSignal;
  tileWriter: VtTileWriter;
  continentByCountry?: Map<string, string>;
};
