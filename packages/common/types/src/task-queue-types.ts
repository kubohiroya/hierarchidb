import type { NodeId } from './id-types.js';

export type TaskStage = 'fetch' | 'transform' | 'vt';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export type TaskQueueRecord<TInput = unknown, TOutput = unknown> = {
  taskId: string;
  nodeId: NodeId;
  stage: TaskStage;
  status: TaskStatus;
  index: number;
  stagePriority?: number;
  progress: number;
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
  message?: string;
  progress?: number;
  outputData?: TOutput;
  errorMessage?: string;
};

export type StageHandler<TInput = unknown, TOutput = unknown> = (
  task: TaskQueueRecord<TInput, TOutput>
) => Promise<StageHandlerResult<TOutput>>;
