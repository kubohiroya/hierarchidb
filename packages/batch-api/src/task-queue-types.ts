import type { NodeId } from '@hierarchidb/core-types';

export type TaskStage = 'fetch' | 'transform' | 'vt';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'regression';

export type TaskDisplayKind = 'phase' | 'summary' | 'skip' | 'error' | 'info';

export type TaskDisplayMetric = {
  input: number;
  output: number;
};

export type TaskDisplayPayload = {
  kind: TaskDisplayKind;
  key?: string;
  params?: Record<string, string | number | boolean>;
  phaseCode?: string;
  phaseState?: 'start' | 'progress' | 'done';
  metrics?: Partial<Record<'features' | 'polygons' | 'vertices', TaskDisplayMetric>>;
};

export type TaskQueueRecord<TInput = unknown, TOutput = unknown> = {
  taskId: string;
  nodeId: NodeId;
  stage: TaskStage;
  status: TaskStatus;
  index: number;
  stagePriority?: number;
  progress: number;
  display?: TaskDisplayPayload;
  message?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  sequence?: number;
  retryCount?: number;
  inputData?: TInput;
  outputData?: TOutput;
  errorMessage?: string;
};

export type TaskQueueEvent =
  | { nodeId: NodeId; task: TaskQueueRecord; type?: 'update' }
  | { nodeId: NodeId; taskId: string; type: 'delete' };

export type StageHandlerResult<TOutput = unknown> = {
  status?: TaskStatus;
  display?: TaskDisplayPayload;
  message?: string;
  progress?: number;
  outputData?: TOutput;
  errorMessage?: string;
  taskUpdated?: boolean;
};

export type StageHandler<TInput = unknown, TOutput = unknown> = (
  task: TaskQueueRecord<TInput, TOutput>
) => Promise<StageHandlerResult<TOutput>>;
