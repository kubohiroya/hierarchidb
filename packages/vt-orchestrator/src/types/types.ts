import type {
  NodeId,
  StageHandler as CommonStageHandler,
  StageHandlerResult as CommonStageHandlerResult,
  TaskQueueEvent as CommonTaskQueueEvent,
  TaskQueueRecord as CommonTaskQueueRecord,
  TaskStage as CommonTaskStage,
  TaskStatus as CommonTaskStatus,
} from '@hierarchidb/common-types';

export type StageHandlerResult<TOutput = unknown> = CommonStageHandlerResult<TOutput>;
export type StageHandler<TInput = unknown, TOutput = unknown> = CommonStageHandler<TInput, TOutput>;
export type TaskQueueRecord<TInput = unknown, TOutput = unknown> = CommonTaskQueueRecord<TInput, TOutput>;
export type TaskQueueEvent = CommonTaskQueueEvent;
export type TaskStage = CommonTaskStage;
export type TaskStatus = CommonTaskStatus;

export type FailureHandling = 'continue' | 'stop' | 'skip';

export type BandConfig = {
  bandId: number;
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
  bandId: number;
  domainType: 'shape' | 'route';
  sourceKey: string;
  stagePriority?: number;
  countryCode?: string;
  adminLevel?: number;
};

export type VtTaskInput = {
  bandId: number;
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
  failureHandling?: FailureHandling;
  abortController?: AbortController;
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
