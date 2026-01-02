import type { NodeId } from '@hierarchidb/common-types';
import type { ProgressInfo, VectorTileTask } from '../../../../../common/types/index.js';
import type { ShapeVectorTileTaskInputData } from '@hierarchidb/plugin-service-api';

import type { VectorTileStageAdapter } from '../../../adapters/VectorTileStageAdapter.js';
import type { GeometryStatsSummary } from './types.js';

export type VectorTileStageSummary = {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
};

export type VectorTileStageTaskRegistryPort = {
  registerTasks: (
    stage: 'vectortile',
    tasks: VectorTileTask[],
    existingTaskIds: Set<string> | undefined,
    inputsByTaskId: Map<string, ShapeVectorTileTaskInputData>,
  ) => Promise<void>;

  resolveStageTasks: (
    stage: 'vectortile',
    tasks: VectorTileTask[],
  ) => Promise<{ runnableTasks: VectorTileTask[]; completedCount: number; failedCount: number; total: number }>;
};

export type VectorTileStagePostprocessPort = {
  persistPlaceholderMetadata: (replace: boolean) => Promise<number>;
  syncVectorTilesToShapeStore: () => Promise<void>;
  summarizeVectorTilesByOrigin: () => Promise<Map<string, GeometryStatsSummary>>;
  updateSourceMetadataStage: (stage: 'vectorTile', statsByOrigin: Map<string, GeometryStatsSummary>) => Promise<void>;
  clearFeatureCache?: () => Promise<void> | void;
};

export type RunVectorTileStageOrchestratorParams = {
  nodeId: NodeId;
  metadataEnabled: boolean;

  tasks: VectorTileTask[];
  inputsByTaskId: Map<string, ShapeVectorTileTaskInputData>;

  taskRegistry: VectorTileStageTaskRegistryPort;

  adapter: VectorTileStageAdapter;
  maxConcurrent?: number;

  waitIfPaused?: () => Promise<void>;
  getSignal?: () => AbortSignal;
  requestPause?: (message: string) => void | Promise<void>;

  progressCallback?: (progress: ProgressInfo) => void;

  postprocess: VectorTileStagePostprocessPort;

  afterRun: (summary: VectorTileStageSummary) => Promise<void>;
};
