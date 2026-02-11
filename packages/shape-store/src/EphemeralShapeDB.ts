import {
  EphemeralShapeDB as BaseEphemeralShapeDB,
  ephemeralShapeDB as sharedEphemeralShapeDB,
  type EphemeralBuildSessionRecord,
  type EphemeralTileIdToBufferRelation,
  type EphemeralTransformCacheRecord,
} from '@hierarchidb/gis-sdk';

export type BuildSessionMetadata = EphemeralBuildSessionRecord;
export type TransformCacheRecord = EphemeralTransformCacheRecord;
export type TileIdToBufferRelation = EphemeralTileIdToBufferRelation;

/**
 * Compatibility wrapper to keep shape-store public API stable.
 */
export class EphemeralShapeDB extends BaseEphemeralShapeDB {}

export const ephemeralShapeDB = sharedEphemeralShapeDB;
