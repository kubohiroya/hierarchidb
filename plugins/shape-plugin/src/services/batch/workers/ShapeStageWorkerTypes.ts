import type { NodeId } from '@hierarchidb/common-types';
import type { DownloadTask, Simplify1Task, Simplify2Task } from '../../../common/types/index.js';

export type ShapeStageWorkerTaskResult = {
  status: 'completed' | 'failed' | 'skipped';
  errorMessage?: string;
  bytesWritten?: number;
  featureCount?: number;
};

export type DownloadTaskRequest = {
  sessionId: string;
  nodeId: NodeId;
  task: DownloadTask;
  taskIndex: number;
};

export type SimplifyTaskRequest<TTask> = {
  sessionId: string;
  task: TTask;
  taskIndex: number;
};

export type ShapeStageWorkerAPI = {
  processDownloadTask: (request: DownloadTaskRequest) => Promise<ShapeStageWorkerTaskResult>;
  processSimplify1Task: (request: SimplifyTaskRequest<Simplify1Task>) => Promise<ShapeStageWorkerTaskResult>;
  processSimplify2Task: (request: SimplifyTaskRequest<Simplify2Task>) => Promise<ShapeStageWorkerTaskResult>;
  setAuthToken: (token: string, type?: 'Bearer' | 'Basic', expiresAt?: number) => Promise<void>;
};
