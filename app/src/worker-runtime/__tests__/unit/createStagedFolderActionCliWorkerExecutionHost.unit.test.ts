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
});
