export type {
  ShapeProcessingState,
  ShapeProcessingStatus,
  ShapeTileLayerInfo,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
  ShapeBuildProgressSummary,
  ShapeBuildSessionSummary,
  ShapeBuildTaskSummary,
} from './shapeTypes.js';
export type {
  ShapeDataSourceName,
  ShapeBuildStage,
  ShapeBuildTaskStatus,
  ShapeSourceTaskPayload,
  ShapeSourceTaskResult,
  ShapeGeometryTaskPayload,
  ShapeGeometryTaskResult,
  ShapeTileEmitTaskPayload,
  ShapeTileEmitTaskResult,
  ShapeBuildTaskPayload,
  ShapeBuildTaskResult,
  ShapeBuildTaskRecord,
  ShapeBuildTaskRecordInput,
  ShapeBuildTaskRecordUpdate,
  ShapeSourceCache,
  ShapeGeometryCache,
  ShapeTileEmitMetadata,
  ShapeFeatureMetadata,
  ShapeDataSourceMetadata,
  ShapeErrorLineString,
  ShapeErrorLineFeature,
  ShapeErrorLineFeatureCollection,
  ShapeGeometryErrorRecord,
} from './shapeBuildTypes.js';
export { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from './defaults.js';
export type {
  ShapeBuildStopReason,
  ShapeSourceStageMaxima,
  ShapeBuildSessionRecord,
  ShapeFeatureRecord,
  ShapeVectorTileRecord,
  ShapeTileIdToBufferRelation,
  ShapeEphemeralSessionRecord,
} from './shapeDbTypes.js';
export type { ShapeQueryAPI } from './ShapeQueryAPI.js';
export type { ShapeMutationAPI } from './ShapeMutationAPI.js';
