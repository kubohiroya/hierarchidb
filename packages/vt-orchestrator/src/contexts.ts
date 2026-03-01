import type { EphemeralDB } from '@hierarchidb/gis-sdk';
import type { GeometryEngine, GeometryConfig, TileEmitConfig } from '@hierarchidb/gis-sdk';
import type { BandConfig } from './types/types.js';

export type TransformByBandStageContext = {
  ephemeralDB: EphemeralDB;
  geometryConfig: GeometryConfig;
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
  ephemeralDB: EphemeralDB;
  tileEmitConfig: TileEmitConfig;
  bands: BandConfig[];
  geometryEngine: GeometryEngine;
  topojsonSource?: boolean;
  topojsonSimplify?: {
    enabled: boolean;
    sourceKeys: Set<string>;
    toleranceK: number;
    retryToleranceStep: number;
    quantize?: number;
  };
  abortSignal?: AbortSignal;
  tileWriter: VtTileWriter;
  continentByCountry?: Map<string, string>;
  featureGeojsonByteSizeById?: Map<string, number>;
};
