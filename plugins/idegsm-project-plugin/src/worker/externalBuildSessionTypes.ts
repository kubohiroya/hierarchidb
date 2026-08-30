import type { BuildSessionStatus, BuildTaskSummary } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  ActiveProjectTask,
  IdeGsmCommand,
  TaskCancelResult,
  TaskLogEvent,
  TaskLogListener,
  TaskResult,
} from '@hierarchidb/ide-gsm-client';
import type { TreeNode } from '@hierarchidb/tree-api';

export type IdeGsmProjectBuildCommandId = 'check' | 'sim' | 'calib';

export type IdeGsmProjectBuildStageId = IdeGsmProjectBuildCommandId;

export interface IdeGsmProjectBuildClient {
  executeCommand(command: IdeGsmCommand): Promise<string>;
  activeProjectTasks(projectRelativePath: string): Promise<ActiveProjectTask[]>;
  cancelTask(taskId: string): Promise<TaskCancelResult>;
  awaitTask(taskId: string, onStatus?: (result: TaskResult) => void): Promise<TaskResult>;
  subscribeTaskLog(taskId: string, onLog: TaskLogListener): () => void;
}

export interface IdeGsmProjectBuildCoreDbPort {
  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;
}

export interface IdeGsmProjectBuildRuntimePort {
  resolveClient(connectionName: string): Promise<IdeGsmProjectBuildClient | null>;
  now(): number;
}

export interface StartIdeGsmProjectBuildSessionInput {
  readonly nodeId: NodeId;
  readonly expectedNodeVersion: number;
  readonly commandId: IdeGsmProjectBuildCommandId;
}

export interface IdeGsmProjectBuildRuntimeLogRow {
  readonly rowId: string;
  readonly taskId: string;
  readonly connectionEpoch: number;
  readonly ordinal: number;
  readonly event: TaskLogEvent | null;
  readonly marker: 'reconnect-gap' | 'limit-reached' | null;
}

export interface IdeGsmProjectBuildSessionState {
  readonly nodeId: NodeId;
  readonly taskId: string;
  readonly commandId: IdeGsmProjectBuildCommandId;
  readonly status: BuildSessionStatus['status'];
  readonly taskStatus: TaskResult['status'] | ActiveProjectTask['status'] | 'CANCELING';
  readonly progress: number;
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly completedAt?: number;
  readonly stopReason?: string;
  readonly cancellationRequested: boolean;
}

export interface IdeGsmProjectBuildSessionSnapshot {
  readonly session: BuildSessionStatus;
  readonly task: BuildTaskSummary;
  readonly logRows: readonly IdeGsmProjectBuildRuntimeLogRow[];
}
