import type { EphemeralShapeDB } from '@hierarchidb/shape-store';
import type { VtShapeDb } from '@hierarchidb/vt-shape-store';
import type { VtDb } from '@hierarchidb/vt-store';
import type { TransformConfig, VTConfig } from '@hierarchidb/gis-sdk';
import type { BandConfig } from './types/types.js';

export type TransformByBandStageContext = {
  shapeDB: VtShapeDb;
  ephemeralDB: EphemeralShapeDB;
  transformConfig: TransformConfig;
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
