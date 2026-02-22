import type { NodeId } from '@hierarchidb/core-types';
import type {
  StageHandler as CommonStageHandler,
  StageHandlerResult as CommonStageHandlerResult,
  TaskQueueEvent as CommonTaskQueueEvent,
  TaskQueueRecord as CommonTaskQueueRecord,
  TaskStage as CommonTaskStage,
  TaskStatus as CommonTaskStatus,
} from '@hierarchidb/build-api';

export type StageHandlerResult<TOutput = unknown> = CommonStageHandlerResult<TOutput>;
export type StageHandler<TInput = unknown, TOutput = unknown> = CommonStageHandler<TInput, TOutput>;
export type TaskQueueRecord<TInput = unknown, TOutput = unknown> = CommonTaskQueueRecord<TInput, TOutput>;
export type TaskQueueEvent = CommonTaskQueueEvent;
export type TaskStage = CommonTaskStage;
export type TaskStatus = CommonTaskStatus;

export type FailureHandling = 'continue' | 'stop' | 'skip';

export type TaskFilter<TInput = unknown, TOutput = unknown> = (
  task: TaskQueueRecord<TInput, TOutput>,
) => boolean;

export type LaneExecutionPolicy<TInput = unknown, TOutput = unknown> = {
  enabled: boolean;
  laneOfTask: (task: TaskQueueRecord<TInput, TOutput>) => string;
  maxConcurrentForLane?: (lane: string, task: TaskQueueRecord<TInput, TOutput>) => number;
  defaultLane?: string;
};

export type DynamicConcurrencyConfig = {
  enabled: boolean;
  minConcurrent: number;
  maxConcurrent?: number;
  highWatermark: number;
  lowWatermark: number;
  adjustStep: number;
  sampleMs: number;
};

export type BandConfig = {
  bandIndex: number;
  zMin: number;
  zMax: number;
  zBase: number;
};

/*
export type TransformByBandStageConfig = {
  toleranceK: number;
};

export type TransformByZoomStageConfig = {
  tileIndex: {
    buffer: number;
    extent: number;
    promoteId?: string;
  };
};

export type VtStageConfig = {
  extent: number;
  buffer: number;
  tileSize: number;
  vtSimplificationTolerance: number;
  boundaryDedupe: boolean;
  layers: string[];
  layerSetName: string;
};
*/

export const DEFAULT_TASK_SPLIT = {
  maxBuffersPerTask: 128,
  maxVerticesPerTask: 100_000,
  maxBand3Reservations: 50_000,
} as const;

export type TransformByBandTaskInput = {
  fetchCacheId: string;
  bandIndex: number;
  bandMinZoom?: number;
  bandMaxZoom?: number;
  inputVertexCount?: number;
  inputPolygonCount?: number;
  domainType: 'shape' | 'route';
  sourceKey: string;
  stagePriority?: number;
  countryCode?: string;
  adminLevel?: number;
};

export type VtTaskInput = {
  bandIndex: number;
  zBase: number;
  tileId: number;
  bufferIds: string[];
  domainType: 'shape' | 'route';
  sourceKey: string;
};

export interface RunStageOptions<TInput = unknown, TOutput = unknown> {
  nodeId: TaskQueueRecord['nodeId'];
  //db: VtTaskQueueDb;
  stage: TaskStage;
  handler: StageHandler<TInput, TOutput>;
  waitIfPaused?: () => Promise<void>;
  maxConcurrent?: number;
  dynamicConcurrency?: DynamicConcurrencyConfig;
  failureHandling?: FailureHandling;
  abortController?: AbortController;
  lanePolicy?: LaneExecutionPolicy<TInput, TOutput>;
  taskFilter?: TaskFilter<TInput, TOutput>;
}

export type PipelineRunConfig<
  TTransformByBandInput = TransformByBandTaskInput,
  TVtInput = VtTaskInput
> = {
  nodeId: NodeId;
  // taskQueue: VtTaskQueueDb;
  transformByBandHandler?: StageHandler<TTransformByBandInput>;
  vtHandler?: StageHandler<TVtInput>;
  //transformByBandContext?: TransformByBandStageContext;
  //vtContext?: VTStageContext;
};
