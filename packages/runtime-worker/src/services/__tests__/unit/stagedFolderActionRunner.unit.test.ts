import 'fake-indexeddb/auto';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { StagedFolderActionConfig } from '@hierarchidb/staged-folder-action';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StagedFolderActionProgressStore } from '../../stagedFolderActionProgressStore.js';
import {
  runStagedFolderAction,
  type StagedFolderActionRunnerDependencies,
} from '../../runStagedFolderAction.js';

describe('runStagedFolderAction', () => {
  let store: StagedFolderActionProgressStore;
  let nowValue: number;

  beforeEach(async () => {
    store = new StagedFolderActionProgressStore(`staged-action-runner-${crypto.randomUUID()}`);
    await store.open();
    nowValue = 100;
  });

  afterEach(async () => {
    await store.delete();
  });

  it('completes after staging and overlay when actions is empty', async () => {
    const dependencies = createDependencies();
    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-empty' as NodeId,
      sourceNodeId: 'source-empty' as NodeId,
      config: createConfig({ actions: [] }),
    });

    expect(dependencies.prepareStaging).toHaveBeenCalledOnce();
    expect(dependencies.applyOverlays).toHaveBeenCalledOnce();
    expect(dependencies.runBuildAction).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'completed',
      phase: 'completed',
      progress: {
        total: 0,
        completed: 0,
        percentage: 100,
      },
    });
  });

  it('runs a build action through the injected build session handoff', async () => {
    const dependencies = createDependencies();
    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-build' as NodeId,
      sourceNodeId: 'source-build' as NodeId,
      config: createConfig({
        actions: [{ type: 'build', mode: 'session-manager' }],
      }),
    });

    expect(dependencies.runBuildAction).toHaveBeenCalledWith({
      action: { type: 'build', mode: 'session-manager' },
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-build',
    });
    expect(result).toMatchObject({
      status: 'completed',
      phase: 'completed',
      buildSession: {
        nodeType: 'shape',
        nodeId: 'staging-root',
        status: 'completed',
      },
      progress: {
        total: 1,
        completed: 1,
        percentage: 100,
      },
    });
  });

  it('runs map image capture only after the preceding build action completes', async () => {
    const order: string[] = [];
    const dependencies = createDependencies({
      runBuildAction: vi.fn(async () => {
        order.push('build');
        return {
          nodeType: 'shape' as NodeType,
          nodeId: 'staging-root' as NodeId,
          status: 'completed',
        };
      }),
      runMapImageCaptureAction: vi.fn(async () => {
        order.push('capture');
      }),
    });

    await runStagedFolderAction(dependencies, {
      runId: 'run-capture' as NodeId,
      sourceNodeId: 'source-capture' as NodeId,
      browserMode: 'headed',
      config: createConfig({
        actions: [
          { type: 'build', mode: 'session-manager' },
          {
            type: 'map-image-capture',
            mode: 'map-ui',
            output: { path: './out.png', width: 800, height: 600 },
            viewport: { bbox: [139, 35, 140, 36] },
            layers: [{ path: '.', visible: true }],
          },
        ],
      }),
    });

    expect(order).toEqual(['build', 'capture']);
    expect(dependencies.runMapImageCaptureAction).toHaveBeenCalledWith({
      intent: {
        intentId: 'run-capture:1',
        runId: 'run-capture',
        stagingRootNodeId: 'staging-root',
        browserMode: 'headed',
        mapRoute: {
          nodeId: 'staging-root',
          search: {
            captureIntentId: 'run-capture:1',
          },
        },
        viewport: {
          bbox: [139, 35, 140, 36],
          width: 800,
          height: 600,
        },
        layers: [{ path: '.', visible: true }],
        output: {
          path: './out.png',
        },
      },
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-capture',
      reportProgress: expect.any(Function),
    });
    await expect(store.getMapImageCaptureIntent('run-capture:1')).resolves.toMatchObject({
      intentId: 'run-capture:1',
      runId: 'run-capture',
      stagingRootNodeId: 'staging-root',
      browserMode: 'headed',
    });
    await expect(store.getRun('run-capture' as NodeId)).resolves.toMatchObject({
      status: 'completed',
      phase: 'completed',
      progress: {
        total: 2,
        completed: 2,
        percentage: 100,
      },
    });
  });

  it('lets the map image capture runner report action-specific phases to the run progress store', async () => {
    const observedPhases: string[] = [];
    const dependencies = createDependencies({
      runMapImageCaptureAction: vi.fn(async ({ reportProgress }) => {
        await reportProgress({ phase: 'opening-map-ui', percentage: 25 });
        observedPhases.push(
          (await store.getRun('run-capture-progress' as NodeId))?.currentAction?.phase ?? ''
        );
        await reportProgress({ phase: 'waiting-render-ready', percentage: 50 });
        observedPhases.push(
          (await store.getRun('run-capture-progress' as NodeId))?.currentAction?.phase ?? ''
        );
        await reportProgress({ phase: 'writing-output', percentage: 90 });
        observedPhases.push(
          (await store.getRun('run-capture-progress' as NodeId))?.currentAction?.phase ?? ''
        );
      }),
    });

    await runStagedFolderAction(dependencies, {
      runId: 'run-capture-progress' as NodeId,
      sourceNodeId: 'source-capture-progress' as NodeId,
      browserMode: 'headless',
      config: createConfig({
        actions: [
          { type: 'build', mode: 'session-manager' },
          {
            type: 'map-image-capture',
            mode: 'map-ui',
            output: { path: './out.png', width: 800, height: 600 },
            viewport: { bbox: [139, 35, 140, 36] },
            layers: [{ path: '.', visible: true }],
          },
        ],
      }),
    });

    expect(observedPhases).toEqual(['opening-map-ui', 'waiting-render-ready', 'writing-output']);
    await expect(store.getRun('run-capture-progress' as NodeId)).resolves.toMatchObject({
      status: 'completed',
      phase: 'completed',
      currentAction: undefined,
    });
  });

  it('requires browser mode before handing off map image capture', async () => {
    const dependencies = createDependencies({
      runMapImageCaptureAction: vi.fn(async () => {}),
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-capture-no-browser' as NodeId,
        sourceNodeId: 'source-capture-no-browser' as NodeId,
        config: createConfig({
          actions: [
            { type: 'build', mode: 'session-manager' },
            {
              type: 'map-image-capture',
              mode: 'map-ui',
              output: { path: './out.png', width: 800, height: 600 },
              viewport: { bbox: [139, 35, 140, 36] },
              layers: [{ path: '.', visible: true }],
            },
          ],
        }),
      })
    ).rejects.toThrow(/map-image-capture action requires browserMode/);
    expect(dependencies.runMapImageCaptureAction).not.toHaveBeenCalled();
  });

  it('records failure when map image capture has no configured runner', async () => {
    const dependencies = createDependencies();

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-missing-capture' as NodeId,
        sourceNodeId: 'source-missing-capture' as NodeId,
        browserMode: 'headless',
        config: createConfig({
          actions: [
            { type: 'build', mode: 'session-manager' },
            {
              type: 'map-image-capture',
              mode: 'map-ui',
              output: { path: './out.png', width: 800, height: 600 },
              viewport: { bbox: [139, 35, 140, 36] },
              layers: [{ path: '.', visible: true }],
            },
          ],
        }),
      })
    ).rejects.toThrow(/map-image-capture action runner is not configured/);
    await expect(store.getRun('run-missing-capture' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      phase: 'failed',
      error: 'map-image-capture action runner is not configured',
    });
  });

  it('runs cleanup on successful delete-on-success runs', async () => {
    const cleanup = vi.fn(async () => {});
    const dependencies = createDependencies({ cleanup });

    await runStagedFolderAction(dependencies, {
      runId: 'run-cleanup-success' as NodeId,
      sourceNodeId: 'source-cleanup-success' as NodeId,
      config: createConfig({ actions: [] }),
    });

    expect(cleanup).toHaveBeenCalledWith({
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-cleanup-success',
    });
  });

  it('runs cleanup after a failed action when cleanup is delete-always', async () => {
    const cleanup = vi.fn(async () => {});
    const dependencies = createDependencies({
      cleanup,
      runBuildAction: vi.fn(async () => {
        throw new Error('build failed');
      }),
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-cleanup-failure' as NodeId,
        sourceNodeId: 'source-cleanup-failure' as NodeId,
        config: {
          ...createConfig({ actions: [{ type: 'build', mode: 'session-manager' }] }),
          staging: {
            mode: 'temporary-copy',
            cleanup: 'delete-always',
          },
        },
      })
    ).rejects.toThrow(/build failed/);

    expect(cleanup).toHaveBeenCalledWith({
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-cleanup-failure',
    });
    await expect(store.getRun('run-cleanup-failure' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      error: 'build failed',
    });
  });

  it('surfaces cleanup failure in both the rejected error and the run record', async () => {
    const dependencies = createDependencies({
      cleanup: vi.fn(async () => {
        throw new Error('cleanup failed');
      }),
      runBuildAction: vi.fn(async () => {
        throw new Error('build failed');
      }),
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-cleanup-rejection' as NodeId,
        sourceNodeId: 'source-cleanup-rejection' as NodeId,
        config: {
          ...createConfig({ actions: [{ type: 'build', mode: 'session-manager' }] }),
          staging: {
            mode: 'temporary-copy',
            cleanup: 'delete-always',
          },
        },
      })
    ).rejects.toThrow(/build failed; cleanup failed: cleanup failed/);

    await expect(store.getRun('run-cleanup-rejection' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      error: 'build failed; cleanup failed: cleanup failed',
    });
  });

  const createDependencies = (
    overrides: Partial<StagedFolderActionRunnerDependencies> = {}
  ): StagedFolderActionRunnerDependencies => ({
    progressStore: store,
    now: () => nowValue++,
    prepareStaging: vi.fn(async () => ({
      stagingRootNodeId: 'staging-root' as NodeId,
    })),
    applyOverlays: vi.fn(async () => {}),
    runBuildAction: vi.fn(async () => ({
      nodeType: 'shape' as NodeType,
      nodeId: 'staging-root' as NodeId,
      status: 'completed',
    })),
    ...overrides,
  });
});

const createConfig = ({
  actions,
}: Pick<StagedFolderActionConfig, 'actions'>): StagedFolderActionConfig => ({
  version: 1,
  staging: {
    mode: 'temporary-copy',
    cleanup: 'delete-on-success',
  },
  overlay: {
    nodes: [],
  },
  actions,
});
