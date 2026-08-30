import type { BuildSessionStatus, BuildTaskSummary } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  ActiveProjectTask,
  IdeGsmCommand,
  TaskLogEvent,
  TaskResult,
} from '@hierarchidb/ide-gsm-client';
import {
  assertIdeGsmProjectRootNodeData,
  type IdeGsmProjectRootNodeData,
} from '@hierarchidb/idegsm-project-api';
import { IDEGSM_PROJECT_PLUGIN_NODE_TYPE } from '../common/constants.js';
import type {
  IdeGsmProjectBuildClient,
  IdeGsmProjectBuildCommandId,
  IdeGsmProjectBuildCoreDbPort,
  IdeGsmProjectBuildRuntimeLogRow,
  IdeGsmProjectBuildRuntimePort,
  IdeGsmProjectBuildSessionSnapshot,
  IdeGsmProjectBuildSessionState,
  StartIdeGsmProjectBuildSessionInput,
} from './externalBuildSessionTypes.js';

const ACTIVE_SESSION_STATUSES = new Set<BuildSessionStatus['status']>([
  'queued',
  'running',
  'canceling',
]);
const TERMINAL_TASK_STATUSES = new Set<TaskResult['status']>(['FINISHED', 'FAILED', 'CANCELED']);
const DEFAULT_LOG_ROW_LIMIT = 20_000;
const DEFAULT_LOG_BYTE_LIMIT = 8 * 1024 * 1024;

export type IdeGsmProjectExternalBuildSessionsOptions = {
  readonly maxLogRows?: number;
  readonly maxLogBytes?: number;
};

export class IdeGsmProjectExternalBuildSessions {
  private readonly sessions = new Map<string, IdeGsmProjectBuildSessionState>();
  private readonly clients = new Map<string, IdeGsmProjectBuildClient>();
  private readonly logRows = new Map<string, IdeGsmProjectBuildRuntimeLogRow[]>();
  private readonly logBytes = new Map<string, number>();
  private readonly logLimitReached = new Set<string>();
  private readonly logUnsubscribers = new Map<string, () => void>();
  private readonly logConnectionEpochs = new Map<string, number>();
  private readonly maxLogRows: number;
  private readonly maxLogBytes: number;

  constructor(
    private readonly coreDb: IdeGsmProjectBuildCoreDbPort,
    private readonly runtime: IdeGsmProjectBuildRuntimePort,
    options: IdeGsmProjectExternalBuildSessionsOptions = {}
  ) {
    this.maxLogRows = options.maxLogRows ?? DEFAULT_LOG_ROW_LIMIT;
    this.maxLogBytes = options.maxLogBytes ?? DEFAULT_LOG_BYTE_LIMIT;
  }

  async startBuildSession(input: StartIdeGsmProjectBuildSessionInput): Promise<BuildSessionStatus> {
    const rootData = await this.readReadyProjectRoot(input.nodeId, input.expectedNodeVersion);
    const existing = this.sessions.get(String(input.nodeId));
    if (existing && ACTIVE_SESSION_STATUSES.has(existing.status)) {
      throw new Error('IDEGSM_PROJECT_BUILD_SESSION_ALREADY_ACTIVE');
    }
    const client = await this.resolveClient(rootData.connectionName);
    const now = this.runtime.now();
    const command = createDefaultProjectCommand(input.commandId, rootData.projectRelativePath);
    const taskId = await client.executeCommand(command);
    this.clients.set(taskId, client);
    const session = this.installSession({
      nodeId: input.nodeId,
      taskId,
      commandId: input.commandId,
      status: 'queued',
      taskStatus: 'REGISTERED',
      progress: 0,
      startedAt: now,
      updatedAt: now,
      cancellationRequested: false,
    });
    this.subscribeLog(client, taskId, false);
    void client
      .awaitTask(taskId, (status) => this.applyTaskStatus(input.nodeId, status))
      .then((status) => this.applyTaskStatus(input.nodeId, status))
      .catch((error: unknown) => {
        const previous = this.sessions.get(String(input.nodeId));
        if (!previous || TERMINAL_TASK_STATUSES.has(previous.taskStatus as TaskResult['status'])) {
          return;
        }
        this.installSession({
          ...previous,
          status: 'failed',
          taskStatus: 'FAILED',
          progress: previous.progress,
          updatedAt: this.runtime.now(),
          completedAt: this.runtime.now(),
          stopReason: error instanceof Error ? error.name : 'IdeGsmTaskError',
        });
      });
    return this.toBuildSessionStatus(session);
  }

  async discoverActiveProjectTasks(nodeId: NodeId): Promise<BuildSessionStatus | null> {
    const rootData = await this.readReadyProjectRoot(nodeId);
    const client = await this.resolveClient(rootData.connectionName);
    const activeTasks = await client.activeProjectTasks(rootData.projectRelativePath);
    const supportedTasks = activeTasks.filter((task) => isBuildCommandId(task.commandId));
    if (supportedTasks.length > 1) {
      throw new Error('IDEGSM_PROJECT_BUILD_SESSION_ALREADY_ACTIVE');
    }
    const task = supportedTasks[0];
    if (!task) return null;
    const session = this.installSession(fromActiveProjectTask(nodeId, task, this.runtime.now()));
    this.clients.set(task.taskId, client);
    this.logRows.set(task.taskId, []);
    this.logBytes.set(task.taskId, 0);
    this.subscribeLog(client, task.taskId, false);
    return this.toBuildSessionStatus(session);
  }

  async cancelBuildSession(nodeId: NodeId): Promise<BuildSessionStatus> {
    const session = this.sessions.get(String(nodeId));
    if (!session || !ACTIVE_SESSION_STATUSES.has(session.status)) {
      throw new Error('IDEGSM_PROJECT_BUILD_SESSION_NOT_ACTIVE');
    }
    if (!session.cancellationRequested) {
      const client = this.clients.get(session.taskId);
      if (!client) {
        throw new Error('IDEGSM_PROJECT_BUILD_SESSION_CLIENT_MISSING');
      }
      const result = await client.cancelTask(session.taskId);
      if (!result.accepted || result.taskId !== session.taskId) {
        throw new Error('IDEGSM_PROJECT_BUILD_SESSION_CANCEL_REJECTED');
      }
    }
    const next = this.installSession({
      ...session,
      status: 'canceling',
      taskStatus: 'CANCELING',
      updatedAt: this.runtime.now(),
      cancellationRequested: true,
    });
    return this.toBuildSessionStatus(next);
  }

  reconnectTaskLog(taskId: string): void {
    const client = this.clients.get(taskId);
    if (!client) {
      throw new Error('IDEGSM_PROJECT_BUILD_SESSION_CLIENT_MISSING');
    }
    this.subscribeLog(client, taskId, true);
  }

  getBuildSessionStatus(nodeId: NodeId): BuildSessionStatus | null {
    const session = this.sessions.get(String(nodeId));
    return session ? this.toBuildSessionStatus(session) : null;
  }

  getBuildTasks(nodeId: NodeId): BuildTaskSummary[] {
    const session = this.sessions.get(String(nodeId));
    if (!session) return [];
    return [this.toBuildTaskSummary(session)];
  }

  getSnapshot(nodeId: NodeId): IdeGsmProjectBuildSessionSnapshot | null {
    const session = this.sessions.get(String(nodeId));
    if (!session) return null;
    return {
      session: this.toBuildSessionStatus(session),
      task: this.toBuildTaskSummary(session),
      logRows: this.logRows.get(session.taskId) ?? [],
    };
  }

  private async readReadyProjectRoot(
    nodeId: NodeId,
    expectedNodeVersion?: number
  ): Promise<IdeGsmProjectRootNodeData> {
    const node = await this.coreDb.getNode(nodeId);
    if (!node || node.nodeType !== IDEGSM_PROJECT_PLUGIN_NODE_TYPE) {
      throw new Error('IDEGSM_PROJECT_BUILD_NODE_MISSING');
    }
    if (expectedNodeVersion !== undefined && node.version !== expectedNodeVersion) {
      throw new Error('IDEGSM_PROJECT_BUILD_NODE_STALE');
    }
    assertIdeGsmProjectRootNodeData(node.data);
    const rootData = node.data;
    if (rootData.syncState !== 'synced' || rootData.activeSyncGenerationId === null) {
      throw new Error('IDEGSM_PROJECT_BUILD_NODE_NOT_SYNCED');
    }
    return rootData;
  }

  private async resolveClient(connectionName: string): Promise<IdeGsmProjectBuildClient> {
    const client = await this.runtime.resolveClient(connectionName);
    if (!client) {
      throw new Error('IDEGSM_PROJECT_BUILD_DISCONNECTED');
    }
    return client;
  }

  private subscribeLog(client: IdeGsmProjectBuildClient, taskId: string, insertGap: boolean): void {
    this.logUnsubscribers.get(taskId)?.();
    if (insertGap) {
      const currentEpoch = this.logConnectionEpochs.get(taskId) ?? 0;
      this.logConnectionEpochs.set(taskId, currentEpoch + 1);
      this.appendLogMarker(taskId, 'reconnect-gap');
    } else if (!this.logConnectionEpochs.has(taskId)) {
      this.logConnectionEpochs.set(taskId, 0);
    }
    const unsubscribe = client.subscribeTaskLog(taskId, (event) => this.appendLogEvent(event));
    this.logUnsubscribers.set(taskId, unsubscribe);
  }

  private appendLogEvent(event: TaskLogEvent): void {
    if (this.logLimitReached.has(event.taskId)) return;
    const rows = this.logRows.get(event.taskId) ?? [];
    const textBytes = new TextEncoder().encode(event.text).byteLength;
    const currentBytes = this.logBytes.get(event.taskId) ?? 0;
    if (rows.length + 1 > this.maxLogRows || currentBytes + textBytes > this.maxLogBytes) {
      this.appendLogMarker(event.taskId, 'limit-reached');
      this.logLimitReached.add(event.taskId);
      return;
    }
    this.logRows.set(event.taskId, [
      ...rows,
      {
        rowId: createLogRowId(
          event.taskId,
          this.logConnectionEpochs.get(event.taskId) ?? 0,
          rows.length
        ),
        taskId: event.taskId,
        connectionEpoch: this.logConnectionEpochs.get(event.taskId) ?? 0,
        ordinal: rows.length,
        event,
        marker: null,
      },
    ]);
    this.logBytes.set(event.taskId, currentBytes + textBytes);
  }

  private appendLogMarker(taskId: string, marker: IdeGsmProjectBuildRuntimeLogRow['marker']): void {
    const rows = this.logRows.get(taskId) ?? [];
    const connectionEpoch = this.logConnectionEpochs.get(taskId) ?? 0;
    this.logRows.set(taskId, [
      ...rows,
      {
        rowId: createLogRowId(taskId, connectionEpoch, rows.length),
        taskId,
        connectionEpoch,
        ordinal: rows.length,
        event: null,
        marker,
      },
    ]);
  }

  private applyTaskStatus(nodeId: NodeId, result: TaskResult): void {
    const session = this.sessions.get(String(nodeId));
    if (!session || result.id !== session.taskId) return;
    this.installSession({
      ...session,
      status: toBuildSessionStatus(result.status, session.cancellationRequested),
      taskStatus: result.status,
      progress: result.status === 'FINISHED' ? 100 : session.progress,
      updatedAt: this.runtime.now(),
      completedAt: TERMINAL_TASK_STATUSES.has(result.status) ? this.runtime.now() : undefined,
      stopReason: result.status === 'CANCELED' ? 'canceled' : session.stopReason,
    });
  }

  private installSession(session: IdeGsmProjectBuildSessionState): IdeGsmProjectBuildSessionState {
    this.sessions.set(String(session.nodeId), session);
    return session;
  }

  private toBuildSessionStatus(session: IdeGsmProjectBuildSessionState): BuildSessionStatus {
    return {
      nodeId: session.nodeId,
      status: session.status,
      progress: {
        total: 1,
        completed: session.status === 'completed' ? 1 : 0,
        failed: session.status === 'failed' ? 1 : 0,
        skipped: 0,
        percentage: session.progress,
        stage: session.commandId,
      },
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      lastActivity: session.updatedAt,
      stopReason: session.stopReason,
      inputSource: 'committed',
    };
  }

  private toBuildTaskSummary(session: IdeGsmProjectBuildSessionState): BuildTaskSummary {
    return {
      taskId: session.taskId,
      version: toTaskVersion(session.updatedAt),
      stage: session.commandId,
      stageId: session.commandId,
      status: taskStatusToBuildTaskStatus(session.status),
      progress: session.progress,
      sequence: session.updatedAt,
      metadata: {
        commandId: session.commandId,
        logRowCount: this.logRows.get(session.taskId)?.length ?? 0,
        logLimitReached: this.logLimitReached.has(session.taskId),
      },
    };
  }
}

const createDefaultProjectCommand = (
  commandId: IdeGsmProjectBuildCommandId,
  projectRelativePath: string
): IdeGsmCommand => {
  switch (commandId) {
    case 'check':
      return { id: 'check', input: { projectRelativePath } };
    case 'sim':
      return { id: 'sim', input: { projectRelativePath } };
    case 'calib':
      return { id: 'calib', input: { projectRelativePath } };
  }
};

const isBuildCommandId = (commandId: string): commandId is IdeGsmProjectBuildCommandId =>
  commandId === 'check' || commandId === 'sim' || commandId === 'calib';

const fromActiveProjectTask = (
  nodeId: NodeId,
  task: ActiveProjectTask,
  now: number
): IdeGsmProjectBuildSessionState => {
  if (!isBuildCommandId(task.commandId)) {
    throw new Error('IDEGSM_PROJECT_BUILD_UNSUPPORTED_COMMAND');
  }
  return {
    nodeId,
    taskId: task.taskId,
    commandId: task.commandId,
    status: toBuildSessionStatus(task.status, false),
    taskStatus: task.status,
    progress: requireActiveTaskProgress(task.progress),
    startedAt: parseServerTimestamp(task.startedAt ?? task.registeredAt, 'startedAt'),
    updatedAt: task.updatedAt
      ? parseServerTimestamp(task.updatedAt, 'updatedAt')
      : toTaskVersion(now),
    completedAt: undefined,
    cancellationRequested: false,
  };
};

const parseServerTimestamp = (value: string, fieldName: string): number => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`IDEGSM_PROJECT_BUILD_INVALID_${fieldName.toUpperCase()}`);
  }
  return timestamp;
};

const toTaskVersion = (value: number): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('IDEGSM_PROJECT_BUILD_INVALID_TASK_VERSION');
  }
  return value;
};

const requireActiveTaskProgress = (value: number | null): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('IDEGSM_PROJECT_BUILD_INVALID_TASK_PROGRESS');
  }
  return value;
};

const toBuildSessionStatus = (
  status: TaskResult['status'] | ActiveProjectTask['status'],
  cancellationRequested: boolean
): BuildSessionStatus['status'] => {
  if (cancellationRequested && status !== 'CANCELED') return 'canceling';
  switch (status) {
    case 'REGISTERED':
    case 'READY':
      return 'queued';
    case 'LEASED':
      return 'running';
    case 'FINISHED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'CANCELED':
      return 'canceled';
    case 'DELETED':
      throw new Error('IDEGSM_PROJECT_BUILD_DELETED_TASK_NOT_ACTIVE');
  }
};

const taskStatusToBuildTaskStatus = (
  status: BuildSessionStatus['status']
): BuildTaskSummary['status'] => {
  switch (status) {
    case 'queued':
    case 'canceling':
      return 'queued';
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    case 'idle':
    case 'paused':
    case 'pausing':
    case 'recycled':
      return 'recycled';
  }
};

const createLogRowId = (taskId: string, connectionEpoch: number, ordinal: number): string =>
  `${taskId}:${connectionEpoch}:${ordinal}`;
