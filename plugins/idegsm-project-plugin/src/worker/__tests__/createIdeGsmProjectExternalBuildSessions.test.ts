import type { BuildSessionStatus } from '@hierarchidb/build-api';
import { type NodeId, type NodeType, toNodeId } from '@hierarchidb/core-types';
import type {
  ActiveProjectTask,
  IdeGsmCommand,
  TaskCancelResult,
  TaskLogEvent,
  TaskLogListener,
  TaskResult,
} from '@hierarchidb/ide-gsm-client';
import { createIdeGsmProjectRootNodeData } from '@hierarchidb/idegsm-project-api';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it, vi } from 'vitest';
import { IdeGsmProjectExternalBuildSessions } from '../createIdeGsmProjectExternalBuildSessions.js';
import type {
  IdeGsmProjectBuildClient,
  IdeGsmProjectBuildCoreDbPort,
  IdeGsmProjectBuildRuntimePort,
} from '../externalBuildSessionTypes.js';

const nodeId = toNodeId('project-root');
const projectRelativePath = 'group/project';

const createRoot = (overrides: Partial<TreeNode> = {}): TreeNode => ({
  id: nodeId,
  parentId: toNodeId('parent'),
  nodeType: 'idegsm-project' as NodeType,
  depth: 1,
  createdAt: 1,
  updatedAt: 2,
  version: 7,
  metadata: { name: 'Project', description: '', tags: [] },
  draftMetadata: null,
  data: {
    ...createIdeGsmProjectRootNodeData({
      connectionName: 'local',
      projectRelativePath,
    }),
    activeSyncGenerationId: 'gen-1',
    syncState: 'synced',
    syncedAt: '2026-08-30T00:00:00Z',
  },
  visible: true,
  hasChildren: true,
  ...overrides,
});

class MemoryCoreDb implements IdeGsmProjectBuildCoreDbPort {
  constructor(private readonly node: TreeNode | undefined = createRoot()) {}

  async getNode(targetNodeId: NodeId) {
    if (targetNodeId !== nodeId) return undefined;
    return this.node;
  }
}

class FakeClient implements IdeGsmProjectBuildClient {
  readonly executeCommand = vi.fn(async (_command: IdeGsmCommand) => 'task-1');
  readonly activeProjectTasks = vi.fn(
    async (_projectRelativePath: string): Promise<ActiveProjectTask[]> => []
  );
  readonly cancelTask = vi.fn(
    async (taskId: string): Promise<TaskCancelResult> => ({
      taskId,
      accepted: true,
    })
  );
  readonly awaitTask = vi.fn(
    async (taskId: string, onStatus?: (result: TaskResult) => void): Promise<TaskResult> => {
      onStatus?.({ id: taskId, status: 'LEASED', paramsJson: '{}', resultJson: null });
      return { id: taskId, status: 'FINISHED', paramsJson: '{}', resultJson: null };
    }
  );
  private logListener: TaskLogListener | null = null;

  subscribeTaskLog(taskId: string, onLog: TaskLogListener): () => void {
    this.logListener = onLog;
    return vi.fn(() => {
      if (this.logListener === onLog) this.logListener = null;
    });
  }

  emitLog(event: TaskLogEvent): void {
    this.logListener?.(event);
  }
}

const createRuntime = (client: FakeClient | null): IdeGsmProjectBuildRuntimePort => {
  let now = 100;
  return {
    resolveClient: vi.fn(async () => client),
    now: () => {
      now += 1;
      return now;
    },
  };
};

describe('IdeGsmProjectExternalBuildSessions', () => {
  it('starts sim with server defaults from a committed ready project root', async () => {
    const client = new FakeClient();
    const service = new IdeGsmProjectExternalBuildSessions(
      new MemoryCoreDb(),
      createRuntime(client)
    );

    await expect(
      service.startBuildSession({ nodeId, expectedNodeVersion: 7, commandId: 'sim' })
    ).resolves.toMatchObject<Partial<BuildSessionStatus>>({
      nodeId,
      status: 'queued',
      inputSource: 'committed',
    });

    expect(client.executeCommand).toHaveBeenCalledWith({
      id: 'sim',
      input: { projectRelativePath },
    });
  });

  it('blocks stale or unsynchronized roots before command dispatch', async () => {
    const client = new FakeClient();
    await expect(
      new IdeGsmProjectExternalBuildSessions(
        new MemoryCoreDb(createRoot()),
        createRuntime(client)
      ).startBuildSession({ nodeId, expectedNodeVersion: 6, commandId: 'check' })
    ).rejects.toThrow('IDEGSM_PROJECT_BUILD_NODE_STALE');
    await expect(
      new IdeGsmProjectExternalBuildSessions(
        new MemoryCoreDb(createRoot({ data: { ...createRoot().data, syncState: 'stale' } })),
        createRuntime(client)
      ).startBuildSession({ nodeId, expectedNodeVersion: 7, commandId: 'check' })
    ).rejects.toThrow('IDEGSM_PROJECT_BUILD_NODE_NOT_SYNCED');
    expect(client.executeCommand).not.toHaveBeenCalled();
  });

  it('enforces one active server task per project node', async () => {
    const client = new FakeClient();
    client.awaitTask.mockImplementation(async () => {
      await new Promise(() => undefined);
      throw new Error('unreachable');
    });
    const service = new IdeGsmProjectExternalBuildSessions(
      new MemoryCoreDb(),
      createRuntime(client)
    );

    await service.startBuildSession({ nodeId, expectedNodeVersion: 7, commandId: 'check' });
    await expect(
      service.startBuildSession({ nodeId, expectedNodeVersion: 7, commandId: 'calib' })
    ).rejects.toThrow('IDEGSM_PROJECT_BUILD_SESSION_ALREADY_ACTIVE');
  });

  it('restores active current-process tasks with an empty browser-runtime log buffer', async () => {
    const client = new FakeClient();
    client.activeProjectTasks.mockResolvedValueOnce([
      {
        taskId: 'task-active',
        commandId: 'calib',
        status: 'LEASED',
        projectRelativePath,
        progress: 50,
        phase: 'running',
        registeredAt: '2026-08-30T00:00:00Z',
        startedAt: '2026-08-30T00:00:01Z',
        updatedAt: '2026-08-30T00:00:02Z',
      },
    ]);
    const service = new IdeGsmProjectExternalBuildSessions(
      new MemoryCoreDb(),
      createRuntime(client)
    );

    await expect(service.discoverActiveProjectTasks(nodeId)).resolves.toMatchObject({
      status: 'running',
      progress: { percentage: 50, stage: 'calib' },
    });
    expect(service.getSnapshot(nodeId)?.logRows).toEqual([]);
  });

  it('sends cancel once and waits for the server terminal status projection', async () => {
    const client = new FakeClient();
    let statusListener: ((result: TaskResult) => void) | undefined;
    client.awaitTask.mockImplementation(async (taskId, onStatus) => {
      statusListener = onStatus;
      await new Promise(() => undefined);
      return { id: taskId, status: 'CANCELED', paramsJson: '{}', resultJson: null };
    });
    const service = new IdeGsmProjectExternalBuildSessions(
      new MemoryCoreDb(),
      createRuntime(client)
    );

    await service.startBuildSession({ nodeId, expectedNodeVersion: 7, commandId: 'check' });
    await expect(service.cancelBuildSession(nodeId)).resolves.toMatchObject({
      status: 'canceling',
    });
    await expect(service.cancelBuildSession(nodeId)).resolves.toMatchObject({
      status: 'canceling',
    });
    expect(client.cancelTask).toHaveBeenCalledOnce();

    statusListener?.({ id: 'task-1', status: 'CANCELED', paramsJson: '{}', resultJson: null });
    expect(service.getBuildSessionStatus(nodeId)).toMatchObject({
      status: 'canceled',
      stopReason: 'canceled',
    });
    expect(service.getBuildTasks(nodeId)[0]).toMatchObject({
      status: 'canceled',
    });
  });

  it('rejects active task discovery with invalid server progress or timestamps', async () => {
    const invalidProgressClient = new FakeClient();
    invalidProgressClient.activeProjectTasks.mockResolvedValueOnce([
      {
        taskId: 'task-invalid-progress',
        commandId: 'check',
        status: 'LEASED',
        projectRelativePath,
        progress: null,
        phase: 'running',
        registeredAt: '2026-08-30T00:00:00Z',
        startedAt: '2026-08-30T00:00:01Z',
        updatedAt: '2026-08-30T00:00:02Z',
      },
    ]);
    await expect(
      new IdeGsmProjectExternalBuildSessions(
        new MemoryCoreDb(),
        createRuntime(invalidProgressClient)
      ).discoverActiveProjectTasks(nodeId)
    ).rejects.toThrow('IDEGSM_PROJECT_BUILD_INVALID_TASK_PROGRESS');

    const invalidTimestampClient = new FakeClient();
    invalidTimestampClient.activeProjectTasks.mockResolvedValueOnce([
      {
        taskId: 'task-invalid-timestamp',
        commandId: 'check',
        status: 'LEASED',
        projectRelativePath,
        progress: 10,
        phase: 'running',
        registeredAt: 'not-a-date',
        startedAt: null,
        updatedAt: '2026-08-30T00:00:02Z',
      },
    ]);
    await expect(
      new IdeGsmProjectExternalBuildSessions(
        new MemoryCoreDb(),
        createRuntime(invalidTimestampClient)
      ).discoverActiveProjectTasks(nodeId)
    ).rejects.toThrow('IDEGSM_PROJECT_BUILD_INVALID_STARTEDAT');
  });

  it('preserves log rows, inserts reconnect gaps, and stops capture at the hard limit', async () => {
    const client = new FakeClient();
    const service = new IdeGsmProjectExternalBuildSessions(
      new MemoryCoreDb(),
      createRuntime(client),
      { maxLogRows: 2, maxLogBytes: 1024 }
    );

    await service.startBuildSession({ nodeId, expectedNodeVersion: 7, commandId: 'check' });
    client.emitLog({
      taskId: 'task-1',
      sequence: 0,
      timestamp: '2026-08-30T00:00:00Z',
      stream: 'stdout',
      text: 'first',
    });
    service.reconnectTaskLog('task-1');
    client.emitLog({
      taskId: 'task-1',
      sequence: 1,
      timestamp: '2026-08-30T00:00:01Z',
      stream: 'stdout',
      text: 'second',
    });

    const snapshot = service.getSnapshot(nodeId);
    expect(snapshot?.logRows.map((row) => row.marker)).toEqual([
      null,
      'reconnect-gap',
      'limit-reached',
    ]);
    expect(JSON.stringify(snapshot?.task.metadata)).not.toContain('first');
  });
});
