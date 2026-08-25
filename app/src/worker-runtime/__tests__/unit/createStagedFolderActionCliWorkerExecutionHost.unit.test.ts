import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import { createStagedFolderActionCliWorkerExecutionHost } from '../../createStagedFolderActionCliWorkerExecutionHost.js';

describe('createStagedFolderActionCliWorkerExecutionHost', () => {
  it('connects CLI execution input to WorkerAPI runStagedFolderAction input', async () => {
    const runStagedFolderAction = vi.fn(async (input) => ({
      runId: input.runId,
      sourceNodeId: input.sourceNodeId,
      stagingRootNodeId: 'stage-1' as NodeId,
      status: 'completed' as const,
      phase: 'completed' as const,
      progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 100 },
      warnings: [],
      pendingReferences: [],
      startedAt: 100,
      completedAt: 110,
      updatedAt: 110,
      revision: 1,
    }));
    const host = createStagedFolderActionCliWorkerExecutionHost({
      runStagedFolderAction,
      createRunId: () => 'run-cli-worker',
      now: () => 110,
    });

    const result = await host.run({
      sourceNodeId: 'source-1',
      profileName: 'default',
      configPath: 'config.json',
      format: 'json',
      startedAt: 100,
      config: {
        version: 1,
        staging: { mode: 'temporary-copy', cleanup: 'retain' },
        overlay: { nodes: [] },
        actions: [],
      },
    });

    expect(runStagedFolderAction).toHaveBeenCalledWith({
      runId: 'run-cli-worker',
      sourceNodeId: 'source-1',
      config: {
        version: 1,
        staging: { mode: 'temporary-copy', cleanup: 'retain' },
        overlay: { nodes: [] },
        actions: [],
      },
    });
    expect(result).toMatchObject({
      ok: true,
      runId: 'run-cli-worker',
      stagingRootNodeId: 'stage-1',
      elapsedMs: 10,
    });
  });

  it('passes CLI browser mode to WorkerAPI runStagedFolderAction input', async () => {
    const runStagedFolderAction = vi.fn(async (input) => ({
      runId: input.runId,
      sourceNodeId: input.sourceNodeId,
      stagingRootNodeId: 'stage-1' as NodeId,
      status: 'completed' as const,
      phase: 'completed' as const,
      progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 100 },
      warnings: [],
      pendingReferences: [],
      startedAt: 100,
      completedAt: 110,
      updatedAt: 110,
      revision: 1,
    }));
    const host = createStagedFolderActionCliWorkerExecutionHost({
      runStagedFolderAction,
      createRunId: () => 'run-cli-worker-browser',
      now: () => 110,
    });

    await host.run({
      sourceNodeId: 'source-1',
      browserMode: 'headed',
      profileName: 'default',
      configPath: 'config.json',
      format: 'json',
      startedAt: 100,
      config: {
        version: 1,
        staging: { mode: 'temporary-copy', cleanup: 'retain' },
        overlay: { nodes: [] },
        actions: [
          { type: 'build', mode: 'session-manager' },
          {
            type: 'map-image-capture',
            mode: 'map-ui',
            output: { path: 'exports/map.png', width: 800, height: 600 },
            viewport: { bbox: [139, 35, 140, 36] },
            layers: [{ path: '.', visible: true }],
          },
        ],
      },
    });

    expect(runStagedFolderAction).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-cli-worker-browser',
        sourceNodeId: 'source-1',
        browserMode: 'headed',
      })
    );
  });
});
