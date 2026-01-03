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

export type VectorTileStageTaskRegistryPort<
  TTask = DefaultVectorTileTask,
  TInput = VectorTileTaskInputData,
> = {
  registerTasks: (
    stage: 'vectortile',
    tasks: TTask[],
    existingTaskIds: Set<string> | undefined,
    inputsByTaskId: Map<string, TInput>,
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
  TInput = VectorTileTaskInputData,
> = {
  nodeId: NodeId;
  metadataEnabled: boolean;

  tasks: TTask[];
  inputsByTaskId: Map<string, TInput>;

  taskRegistry: VectorTileStageTaskRegistryPort<TTask, TInput>;

  adapter: VectorTileStageAdapter<TTask, TProgress>;
  maxConcurrent?: number;

  waitIfPaused?: () => Promise<void>;
  getSignal?: () => AbortSignal;
  requestPause?: (message: string) => void | Promise<void>;

  progressCallback?: (progress: TProgress) => void;

  /**
   * Orchestrator が内部で生成した ProgressInfo を、呼び出し側の Progress 型（TProgress）へ変換する。
   *
   * - adapter が返す progress はすでに TProgress のため不要だが、
   *   runnableTasks=0 のように orchestrator が progress を合成する場合に必要。
   * - 未指定の場合は ProgressInfo をそのまま TProgress として扱う（構造互換が前提）。
   */
  progressFactory?: (progress: ProgressInfo) => TProgress;

  postprocess: VectorTileStagePostprocessPort;

  afterRun: (summary: VectorTileStageSummary) => Promise<void>;
};
