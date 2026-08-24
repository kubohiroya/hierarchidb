import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE } from '@hierarchidb/staged-folder-action';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStagedFolderActionBuildRuntimeAdapter,
  StagedFolderActionProgressStore,
} from '../../stagedFolderActionProgressStore.js';

describe('StagedFolderActionProgressStore', () => {
  let store: StagedFolderActionProgressStore;

  beforeEach(async () => {
    store = new StagedFolderActionProgressStore(`staged-action-progress-${crypto.randomUUID()}`);
    await store.open();
  });

  afterEach(async () => {
    await store.delete();
  });

  it('persists runner phases in IndexedDB and projects them as build runtime records', async () => {
    const run = await store.createRun({
      runId: 'run-1' as NodeId,
      sourceNodeId: 'source-1' as NodeId,
      now: 100,
    });

    await store.updateRun(run.runId, {
      status: 'running',
      phase: 'running-action',
      progress: {
        total: 1,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 40,
      },
      currentAction: {
        actionIndex: 0,
        actionType: 'build',
        phase: 'build-session-running',
        percentage: 40,
      },
      updatedAt: 120,
    });

    const adapter = createStagedFolderActionBuildRuntimeAdapter(store);
    const runtime = await adapter.getSession(run.runId);

    expect(runtime).toMatchObject({
      nodeType: STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE,
      nodeId: run.runId,
      status: 'running',
      isActive: true,
      progress: {
        total: 1,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 40,
      },
      revision: 1,
    });
  });

  it('keeps auth-required as a stored runner state while projecting it as paused', async () => {
    const run = await store.createRun({
      runId: 'run-2' as NodeId,
      sourceNodeId: 'source-2' as NodeId,
      now: 100,
    });
    await store.updateRun(run.runId, {
      status: 'auth-required',
      phase: 'auth-required',
      progress: run.progress,
      updatedAt: 110,
    });

    await expect(store.getRun(run.runId)).resolves.toMatchObject({
      status: 'auth-required',
      phase: 'auth-required',
    });
    await expect(
      createStagedFolderActionBuildRuntimeAdapter(store).getSession(run.runId)
    ).resolves.toMatchObject({
      status: 'paused',
      isActive: false,
    });
  });

  it('dispatches an initial snapshot when subscribing through the build runtime adapter', async () => {
    const run = await store.createRun({
      runId: 'run-4' as NodeId,
      sourceNodeId: 'source-4' as NodeId,
      now: 100,
    });
    const snapshots: string[][] = [];
    const unsubscribe = await createStagedFolderActionBuildRuntimeAdapter(store).subscribeSessions(
      { activeOnly: true },
      (sessions) => {
        snapshots.push(sessions.map((session) => String(session.nodeId)));
      }
    );

    await vi.waitFor(() => expect(snapshots).toEqual([[String(run.runId)]]));
    unsubscribe();
  });

  it('prevents deletion of active runs and allows deletion after terminal state', async () => {
    const run = await store.createRun({
      runId: 'run-3' as NodeId,
      sourceNodeId: 'source-3' as NodeId,
      now: 100,
    });

    await expect(store.deleteRun(run.runId)).rejects.toThrow(/Cannot delete active/);

    await store.updateRun(run.runId, {
      status: 'completed',
      phase: 'completed',
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 100,
      },
      completedAt: 120,
      updatedAt: 120,
    });

    await store.deleteRun(run.runId);
    await expect(store.getRun(run.runId)).resolves.toBeNull();
  });
});
