import 'fake-indexeddb/auto';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { StagedFolderActionConfig } from '@hierarchidb/staged-folder-action';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StagedFolderActionProgressStore } from '../../stagedFolderActionProgressStore.js';
import {
  runStagedFolderAction,
  type StagedFolderActionRunnerDependencies,
} from '../../stagedFolderActionRunner.js';

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

  it('records failure when map image capture has no configured runner', async () => {
    const dependencies = createDependencies();

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-missing-capture' as NodeId,
        sourceNodeId: 'source-missing-capture' as NodeId,
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
