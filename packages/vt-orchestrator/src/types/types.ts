import type {
  StageHandler as CommonStageHandler,
  StageHandlerResult as CommonStageHandlerResult,
  TaskQueueEvent as CommonTaskQueueEvent,
  TaskQueueRecord as CommonTaskQueueRecord,
  TaskStage as CommonTaskStage,
  TaskStatus as CommonTaskStatus,
} from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';

export type StageHandlerResult<TOutput = unknown> = CommonStageHandlerResult<TOutput>;
export type StageHandler<TInput = unknown, TOutput = unknown> = CommonStageHandler<TInput, TOutput>;
export type TaskQueueRecord<TInput = unknown, TOutput = unknown> = CommonTaskQueueRecord<
  TInput,
  TOutput
>;
export type TaskQueueEvent = CommonTaskQueueEvent;
export type TaskStage = CommonTaskStage;
export type TaskStatus = CommonTaskStatus;
export type CanonicalStageId = 'source-stage' | 'geometry-stage' | 'tile-emit-stage';
export type StageCapability = 'io' | 'geometry' | 'tile-emit';

export type FailureHandling = 'continue' | 'stop' | 'skip';

export type TaskFilter<TInput = unknown, TOutput = unknown> = (
  task: TaskQueueRecord<TInput, TOutput>
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

export type DomainType = 'shape' | 'route' | 'location';

/*
export type GeometryStageConfig = {
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

const TASK_STAGE_TO_STAGE_ID = {
  source: 'source-stage',
  geometry: 'geometry-stage',
  tileEmit: 'tile-emit-stage',
} as const satisfies Record<TaskStage, CanonicalStageId>;

const STAGE_ID_TO_TASK_STAGE = {
  'source-stage': 'source',
  'geometry-stage': 'geometry',
  'tile-emit-stage': 'tileEmit',
} as const satisfies Record<CanonicalStageId, TaskStage>;

const STAGE_ID_TO_CAPABILITY = {
  'source-stage': 'io',
  'geometry-stage': 'geometry',
  'tile-emit-stage': 'tile-emit',
} as const satisfies Record<CanonicalStageId, StageCapability>;

const normalizeStageId = (
  stage: TaskStage | undefined,
  stageId: CanonicalStageId | undefined
): CanonicalStageId => {
  if (stageId !== undefined && stage !== undefined) {
    const expected = STAGE_ID_TO_TASK_STAGE[stageId];
    if (expected !== stage) {
      throw new Error(
        `Mismatched runStageTasks stage identity: stage=${stage}, stageId=${stageId}, expectedStage=${expected}`
      );
    }
  }
  if (stageId !== undefined) return stageId;
  if (stage === undefined) {
    throw new Error('runStageTasks requires either stage or stageId');
  }
  return TASK_STAGE_TO_STAGE_ID[stage];
};

const normalizeCapability = (
  stageId: CanonicalStageId,
  capability: StageCapability | undefined
): StageCapability => {
  const expected = STAGE_ID_TO_CAPABILITY[stageId];
  if (capability !== undefined && capability !== expected) {
    throw new Error(
      `Mismatched runStageTasks capability: stageId=${stageId}, capability=${capability}, expectedCapability=${expected}`
    );
  }
  return expected;
};

export const resolveRunStageIdentity = (options: {
  stage?: TaskStage;
  stageId?: CanonicalStageId;
  capability?: StageCapability;
}): { stage: TaskStage; stageId: CanonicalStageId; capability: StageCapability } => {
  const stageId = normalizeStageId(options.stage, options.stageId);
  const stage = STAGE_ID_TO_TASK_STAGE[stageId];
  const capability = normalizeCapability(stageId, options.capability);
  return { stage, stageId, capability };
};

export type GeometryStageTaskInput = {
  sourceCacheId: string;
  sourceCacheFormat?: 'flatgeobuf' | 'topojson' | 'geojson';
  sourceCacheCompression?: 'gzip' | 'none';
  bandIndex: number;
  bandMinZoom?: number;
  bandMaxZoom?: number;
  sourceBaseTolerance?: number;
  inputVertexCount?: number;
  inputPolygonCount?: number;
  domainType: DomainType;
  sourceKey: string;
  stagePriority?: number;
  countryCode?: string;
  adminLevel?: number;
  dataSource?: string;
  sourceUrl?: string;
  sourceCountryCode?: string;
};

export type TransformByBandTaskInput = GeometryStageTaskInput;

export type VtTaskInput = {
  bandIndex: number;
  zBase: number;
  tileId: number;
  bufferIds: string[];
  domainType: DomainType;
  sourceKey: string;
};

export interface RunStageOptions<TInput = unknown, TOutput = unknown> {
  nodeId: TaskQueueRecord['nodeId'];
  //db: VtTaskQueueDb;
  stage?: TaskStage;
  stageId?: CanonicalStageId;
  capability?: StageCapability;
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
  TGeometryStageInput = GeometryStageTaskInput,
  TVtInput = VtTaskInput,
> = {
  nodeId: NodeId;
  // taskQueue: VtTaskQueueDb;
  geometryStageHandler?: StageHandler<TGeometryStageInput>;
  vtHandler?: StageHandler<TVtInput>;
  //geometryStageContext?: GeometryStageContext;
  //vtContext?: VTStageContext;
};
