import type { NodeId } from '@hierarchidb/common-types';

import type { ProgressInfo, VectorTileTask } from '../ports/sharedTypes.js';
import type { VectorTileStageAdapter } from '../ports/VectorTileStageAdapter.js';
import type { GeometryStatsSummary } from './types.js';

export type DefaultVectorTileTask = VectorTileTask;
export type DefaultProgressInfo = ProgressInfo;

/**
 * Stage task registry へ渡す入力データ。
 *
 * Orchestrator 自身は inputs を解釈しない（registry 側で永続化するだけ）ため、
 * plugin ごとの domain 型に依存しないよう opaque とする。
 */
export type VectorTileTaskInputData = unknown;

export type VectorTileStageSummary = {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
};

export type VectorTileStageTaskRegistryPort<TTask = DefaultVectorTileTask> = {
  registerTasks: (
    stage: 'vectortile',
    tasks: TTask[],
    existingTaskIds: Set<string> | undefined,
    inputsByTaskId: Map<string, VectorTileTaskInputData>,
  ) => Promise<void>;

  resolveStageTasks: (
    stage: 'vectortile',
    tasks: TTask[],
  ) => Promise<{ runnableTasks: TTask[]; completedCount: number; failedCount: number; total: number }>;
};

export type VectorTileStagePostprocessPort = {
  persistPlaceholderMetadata: (replace: boolean) => Promise<number>;
  syncVectorTilesToShapeStore: () => Promise<void>;
  summarizeVectorTilesByOrigin: () => Promise<Map<string, GeometryStatsSummary>>;
  updateSourceMetadataStage: (stage: 'vectorTile', statsByOrigin: Map<string, GeometryStatsSummary>) => Promise<void>;
  clearFeatureCache?: () => Promise<void> | void;
};

export type RunVectorTileStageOrchestratorParams<
  TTask = DefaultVectorTileTask,
  TProgress = DefaultProgressInfo,
> = {
  nodeId: NodeId;
  metadataEnabled: boolean;

  tasks: TTask[];
  inputsByTaskId: Map<string, VectorTileTaskInputData>;

  taskRegistry: VectorTileStageTaskRegistryPort<TTask>;

  adapter: VectorTileStageAdapter<TTask, TProgress>;
  maxConcurrent?: number;

  waitIfPaused?: () => Promise<void>;
  getSignal?: () => AbortSignal;
  requestPause?: (message: string) => void | Promise<void>;

  progressCallback?: (progress: TProgress) => void;

  postprocess: VectorTileStagePostprocessPort;

  afterRun: (summary: VectorTileStageSummary) => Promise<void>;
};
