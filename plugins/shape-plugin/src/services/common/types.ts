/**
 * @file services/common/types.ts
 * @description Type re-exports for service-layer modules. This file acts as a
 * stable bridge so legacy imports like `../common/types.js` continue to work
 * after consolidating shared definitions under `common/shared`.
 */

export type {
  BatchSession,
  BatchStatus,
  BatchProcessConfig,
  CacheStrategy,
  CacheStatistics,
  DataSourceConfig,
  ErrorInfo,
  ProgressInfo,
  ResourceUsage,
  StageStatus,
  TaskInfo,
  ProcessingStage,
  TileMetadata,
  LayerConfig,
  BoundingBox,
} from '../types.js';

export type {
  DownloadTask,
  DownloadTaskConfig,
  Simplify1Task,
  Simplify2Task,
  SimplifyTask,
  VectorTileTask,
  VectorTileTaskConfig,
  BatchSession as SharedBatchSession,
  BatchStatus as SharedBatchStatus,
  ProgressInfo as SharedProgressInfo,
  StageStatus as SharedStageStatus,
  ProcessingConfig,
  UrlMetadata,
  ShapeBatchCommandMap,
  TaskStatus,
} from '../../common/shared/types.js';

export type {
  BatchTaskLike,
  BatchTaskStatus,
  BatchStage,
} from '../../common/types/BatchTaskLike.js';
