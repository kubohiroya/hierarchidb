import type { BuildSessionStatus } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeWorkerMocks = vi.hoisted(() => ({
  createStagedFolderActionCoreRunnerDependencies: vi.fn((input: Record<string, unknown>) => input),
  runStagedFolderAction: vi.fn(
    async (
      dependencies: {
        runBuildAction(input: {
          stagingRootNodeId: NodeId;
          action: { type: 'build'; mode: 'session-manager' };
          config: unknown;
          runId: NodeId;
        }): Promise<unknown>;
      },
      input: { runId: NodeId; sourceNodeId: NodeId; config: unknown }
    ) => {
      await dependencies.runBuildAction({
        stagingRootNodeId: 'stage-1' as NodeId,
        action: { type: 'build', mode: 'session-manager' },
        config: input.config,
        runId: input.runId,
      });
      return {
        runId: input.runId,
        sourceNodeId: input.sourceNodeId,
        status: 'completed',
        phase: 'completed',
        progress: { total: 1, completed: 1, failed: 0, skipped: 0, percentage: 100 },
        startedAt: 1,
        updatedAt: 2,
        completedAt: 2,
        revision: 1,
      };
    }
  ),
}));

vi.mock('@hierarchidb/runtime-worker', () => runtimeWorkerMocks);

const {
  collectStagedFolderActionBuildTargets,
  createStagedFolderActionWorkerExecutionHost,
  waitForStagedFolderActionBuildTerminal,
} = await import('../../createStagedFolderActionWorkerExecutionHost.js');

const createStatus = (
  status: BuildSessionStatus['status'],
  nodeId: NodeId = 'stage-1' as NodeId
): BuildSessionStatus => ({
  nodeId,
  status,
  progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 },
});

describe('createStagedFolderActionWorkerExecutionHost', () => {
  beforeEach(() => {
    runtimeWorkerMocks.createStagedFolderActionCoreRunnerDependencies.mockClear();
    runtimeWorkerMocks.runStagedFolderAction.mockClear();
  });

  it('starts a canonical build session for the staging root node type', async () => {
    const startBuildSession = vi.fn(async () => createStatus('completed'));
    const getBuildSessionStatus = vi.fn(async () => createStatus('completed'));
    const host = createStagedFolderActionWorkerExecutionHost({
      coreDB: {} as never,
      progressStore: {} as never,
      getNode: vi.fn(
        async () =>
          ({
            id: 'stage-1',
            nodeType: 'shape' as NodeType,
            metadata: { buildMetadata: { buildRequired: true } },
          }) as never
      ),
      listDescendants: vi.fn(async () => []),
      canBuildNodeType: (nodeType) => nodeType === 'shape',
      startBuildSession,
      getBuildSessionStatus,
      now: () => 1,
    });

    const result = await host({
      runId: 'run-1' as NodeId,
      sourceNodeId: 'source-1' as NodeId,
      config: {
        version: 1,
        staging: { mode: 'patch-source', cleanup: 'retain' },
        overlay: { nodes: [] },
        actions: [{ type: 'build', mode: 'session-manager' }],
      },
    });

    expect(result.status).toBe('completed');
    expect(startBuildSession).toHaveBeenCalledWith('shape', 'stage-1', 'committed');
    expect(getBuildSessionStatus).not.toHaveBeenCalled();
  });

  it('passes an injected map image capture runner to the core runner dependencies', async () => {
    const runMapImageCaptureAction = vi.fn(async () => {});
    const host = createStagedFolderActionWorkerExecutionHost({
      coreDB: {} as never,
      progressStore: {} as never,
      getNode: vi.fn(
        async () =>
          ({
            id: 'stage-1',
            nodeType: 'shape' as NodeType,
            metadata: { buildMetadata: { buildRequired: true } },
          }) as never
      ),
      listDescendants: vi.fn(async () => []),
      canBuildNodeType: (nodeType) => nodeType === 'shape',
      startBuildSession: vi.fn(async () => createStatus('completed')),
      getBuildSessionStatus: vi.fn(async () => createStatus('completed')),
      runMapImageCaptureAction,
      now: () => 1,
    });

    await host({
      runId: 'run-1' as NodeId,
      sourceNodeId: 'source-1' as NodeId,
      config: {
        version: 1,
        staging: { mode: 'patch-source', cleanup: 'retain' },
        overlay: { nodes: [] },
        actions: [{ type: 'build', mode: 'session-manager' }],
      },
    });

    expect(runtimeWorkerMocks.createStagedFolderActionCoreRunnerDependencies).toHaveBeenCalledWith(
      expect.objectContaining({
        runMapImageCaptureAction,
      })
    );
  });

  it('fails when the canonical build reaches a non-completed terminal state', async () => {
    const host = createStagedFolderActionWorkerExecutionHost({
      coreDB: {} as never,
      progressStore: {} as never,
      getNode: vi.fn(
        async () =>
          ({
            id: 'stage-1',
            nodeType: 'shape' as NodeType,
            metadata: { buildMetadata: { buildRequired: true } },
          }) as never
      ),
      listDescendants: vi.fn(async () => []),
      canBuildNodeType: (nodeType) => nodeType === 'shape',
      startBuildSession: vi.fn(async () => createStatus('failed')),
      getBuildSessionStatus: vi.fn(async () => createStatus('failed')),
      now: () => 1,
    });

    await expect(
      host({
        runId: 'run-1' as NodeId,
        sourceNodeId: 'source-1' as NodeId,
        config: {
          version: 1,
          staging: { mode: 'patch-source', cleanup: 'retain' },
          overlay: { nodes: [] },
          actions: [{ type: 'build', mode: 'session-manager' }],
        },
      })
    ).rejects.toThrow('staged-folder-action build did not complete: status=failed');
  });

  it('completes a build action without starting a session when the staging root is buildable but build is not required', async () => {
    const startBuildSession = vi.fn(async () => createStatus('completed'));
    const host = createStagedFolderActionWorkerExecutionHost({
      coreDB: {} as never,
      progressStore: {} as never,
      getNode: vi.fn(
        async () =>
          ({
            id: 'stage-1',
            nodeType: 'shape' as NodeType,
            metadata: { buildMetadata: { buildRequired: false } },
          }) as never
      ),
      listDescendants: vi.fn(async () => []),
      canBuildNodeType: (nodeType) => nodeType === 'shape',
      startBuildSession,
      getBuildSessionStatus: vi.fn(async () => createStatus('completed')),
      now: () => 1,
    });

    const result = await host({
      runId: 'run-1' as NodeId,
      sourceNodeId: 'source-1' as NodeId,
      config: {
        version: 1,
        staging: { mode: 'patch-source', cleanup: 'retain' },
        overlay: { nodes: [] },
        actions: [{ type: 'build', mode: 'session-manager' }],
      },
    });

    expect(result.status).toBe('completed');
    expect(startBuildSession).not.toHaveBeenCalled();
  });

  it('fails a build action when no canonical build candidate exists under the staging root', async () => {
    const host = createStagedFolderActionWorkerExecutionHost({
      coreDB: {} as never,
      progressStore: {} as never,
      getNode: vi.fn(
        async () =>
          ({
            id: 'stage-1',
            nodeType: 'folder' as NodeType,
          }) as never
      ),
      listDescendants: vi.fn(async () => [{ id: 'folder-2', nodeType: 'folder' as NodeType }]),
      canBuildNodeType: (nodeType) => nodeType === 'shape',
      startBuildSession: vi.fn(async () => createStatus('completed')),
      getBuildSessionStatus: vi.fn(async () => createStatus('completed')),
      now: () => 1,
    });

    await expect(
      host({
        runId: 'run-1' as NodeId,
        sourceNodeId: 'source-1' as NodeId,
        config: {
          version: 1,
          staging: { mode: 'patch-source', cleanup: 'retain' },
          overlay: { nodes: [] },
          actions: [{ type: 'build', mode: 'session-manager' }],
        },
      })
    ).rejects.toThrow('staged-folder-action build target candidate was not found');
  });
});

describe('collectStagedFolderActionBuildTargets', () => {
  it('uses a build-required staging root itself when it has a canonical build API', async () => {
    const root = {
      id: 'stage-1' as NodeId,
      nodeType: 'shape' as NodeType,
      metadata: { buildMetadata: { buildRequired: true } },
    } as never;
    const listDescendants = vi.fn(async () => []);

    const collection = await collectStagedFolderActionBuildTargets({
      stagingRoot: root,
      listDescendants,
      canBuildNodeType: (nodeType) => nodeType === 'shape',
    });

    expect(collection).toMatchObject({
      candidates: [root],
      targets: [root],
      availability: {
        status: 'build-required',
        canStartBuild: true,
      },
    });
    expect(listDescendants).not.toHaveBeenCalled();
  });

  it('keeps a buildable staging root as a candidate without starting a build when build is not required', async () => {
    const root = {
      id: 'stage-1' as NodeId,
      nodeType: 'shape' as NodeType,
      metadata: { buildMetadata: { buildRequired: false } },
    } as never;
    const listDescendants = vi.fn(async () => []);

    const collection = await collectStagedFolderActionBuildTargets({
      stagingRoot: root,
      listDescendants,
      canBuildNodeType: (nodeType) => nodeType === 'shape',
    });

    expect(collection).toMatchObject({
      candidates: [root],
      targets: [],
      availability: {
        status: 'build-not-required',
        canStartBuild: false,
      },
    });
    expect(listDescendants).not.toHaveBeenCalled();
  });

  it('collects build-required descendants when the staging root is not buildable', async () => {
    const root = { id: 'stage-1' as NodeId, nodeType: 'folder' as NodeType } as never;
    const buildRequiredShape = {
      id: 'shape-1' as NodeId,
      nodeType: 'shape' as NodeType,
      metadata: { buildMetadata: { buildRequired: true } },
    } as never;
    const notRequiredShape = {
      id: 'shape-2' as NodeId,
      nodeType: 'shape' as NodeType,
      metadata: { buildMetadata: { buildRequired: false } },
    } as never;
    const route = {
      id: 'route-1' as NodeId,
      nodeType: 'route' as NodeType,
      metadata: { buildMetadata: { buildRequired: true } },
    } as never;

    const collection = await collectStagedFolderActionBuildTargets({
      stagingRoot: root,
      listDescendants: vi.fn(async () => [buildRequiredShape, notRequiredShape, route]),
      canBuildNodeType: (nodeType) => nodeType === 'shape',
    });

    expect(collection).toMatchObject({
      candidates: [buildRequiredShape, notRequiredShape],
      targets: [buildRequiredShape],
      availability: {
        status: 'build-required',
        canStartBuild: true,
      },
    });
  });
});

describe('waitForStagedFolderActionBuildTerminal', () => {
  it('polls until a terminal status is observed', async () => {
    let now = 0;
    const getBuildSessionStatus = vi
      .fn()
      .mockResolvedValueOnce(createStatus('running'))
      .mockResolvedValueOnce(createStatus('completed'));

    const status = await waitForStagedFolderActionBuildTerminal({
      nodeType: 'shape' as NodeType,
      nodeId: 'stage-1' as NodeId,
      startedStatus: createStatus('running'),
      getBuildSessionStatus,
      now: () => now,
      delay: async () => {
        now += 10;
      },
      buildPollIntervalMs: 10,
      buildTimeoutMs: 100,
    });

    expect(status.status).toBe('completed');
    expect(getBuildSessionStatus).toHaveBeenCalledTimes(2);
  });
});
