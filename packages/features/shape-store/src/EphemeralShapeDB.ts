import { getDBName } from '@hierarchidb/util';
import type { BatchProcessConfig } from './ShapeDB.js';
import {
  EphemeralGisDB,
  type BatchSessionMetadata as BaseBatchSessionMetadata,
  type EphemeralStage as BaseEphemeralStage,
  type ProcessingCache as BaseProcessingCache,
  type RawFeatureBuffer as BaseRawFeatureBuffer,
  type SimplifiedFeatureBuffer as BaseSimplifiedFeatureBuffer,
  type VectorTileData as BaseVectorTileData,
} from '@hierarchidb/gis-sdk';

export type RawFeatureBuffer = BaseRawFeatureBuffer;
export type SimplifiedFeatureBuffer = BaseSimplifiedFeatureBuffer;
export type VectorTileData = BaseVectorTileData;
export type EphemeralStage = BaseEphemeralStage;
export type ProcessingCache = BaseProcessingCache;
export type BatchSessionMetadata = BaseBatchSessionMetadata<BatchProcessConfig>;

export class EphemeralShapeDB extends EphemeralGisDB<BatchProcessConfig> {
  constructor() {
    super(getDBName('shape-ephemeral'));
  }
}

let ephemeralDBInstance: EphemeralShapeDB | null = null;

export function getEphemeralShapeDB(): EphemeralShapeDB {
  if (!ephemeralDBInstance) {
    ephemeralDBInstance = new EphemeralShapeDB();
  }
  return ephemeralDBInstance;
}

export async function closeEphemeralShapeDB(): Promise<void> {
  if (ephemeralDBInstance) {
    await ephemeralDBInstance.close();
    ephemeralDBInstance = null;
  }
}
