import type { EphemeralShapeDB } from '@hierarchidb/shape-store';
import type { VtShapeDb } from '@hierarchidb/vt-shape-store';
import type { VtDb } from '@hierarchidb/vt-store';
import type { TransformByBandConfig, TransformByZoomConfig, VTConfig } from '@hierarchidb/gis-sdk';
import type { BandConfig } from './types/types.js';

export type TransformByBandStageContext = {
  shapeDB: VtShapeDb;
  ephemeralDB: EphemeralShapeDB;
  transformByBandConfig: TransformByBandConfig;
  bands: BandConfig[];
  abortSignal?: AbortSignal;
};

export type TransformByZoomStageContext = {
  ephemeralDB: EphemeralShapeDB;
  transformByZoomConfig: TransformByZoomConfig;
  bands: BandConfig[];
  abortSignal?: AbortSignal;
};

export type VTStageContext = {
  ephemeralDB: EphemeralShapeDB;
  vtDB: VtDb;
  vtConfig: VTConfig;
  bands: BandConfig[];
  abortSignal?: AbortSignal;
};
