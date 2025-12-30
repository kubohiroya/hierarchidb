import type { NodeId } from '@hierarchidb/common-types';
import type {
  DownloadTask,
  DownloadTaskInput,
  Extract1Task,
  Extract2Task,
  ExtractTaskInput,
} from '../../../common/types/index.js';

export type ShapeStageWorkerTaskResult = {
  status: 'completed' | 'failed' | 'skipped';
  errorMessage?: string;
  bytesWritten?: number;
  featureCount?: number;
};

export type DownloadTaskRequest = {
  nodeId: NodeId;
  task: DownloadTask;
  taskIndex: number;
  input: DownloadTaskInput;
};

export type ExtractTaskRequest<TTask> = {
  nodeId: NodeId;
  task: TTask;
  taskIndex: number;
  input: ExtractTaskInput;
};

export type ShapeStageWorkerAPI = {
  processDownloadTask: (request: DownloadTaskRequest) => Promise<ShapeStageWorkerTaskResult>;
  processExtract1Task: (request: ExtractTaskRequest<Extract1Task>) => Promise<ShapeStageWorkerTaskResult>;
  processExtract2Task: (request: ExtractTaskRequest<Extract2Task>) => Promise<ShapeStageWorkerTaskResult>;
  setAuthToken: (token: string, type?: 'Bearer' | 'Basic', expiresAt?: number) => Promise<void>;
};
