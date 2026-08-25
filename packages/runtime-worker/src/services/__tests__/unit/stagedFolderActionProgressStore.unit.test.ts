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
      currentAction: {
        actionIndex: 0,
        actionType: 'build',
        phase: 'build-session-running',
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

  it('persists reference warnings and pending references on run records', async () => {
    const run = await store.createRun({
      runId: 'run-references' as NodeId,
      sourceNodeId: 'source-references' as NodeId,
      now: 100,
    });

    await store.updateRun(run.runId, {
      status: 'running',
      phase: 'resolving-references',
      warnings: [
        {
          category: 'reference',
          code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
          message: 'lazy reference is unresolved',
          dependentNodeId: 'dependent-1',
          referencePath: 'imports/shape-a',
        },
      ],
      pendingReferences: [
        {
          status: 'pending',
          code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
          dependentNodeId: 'dependent-1',
          referencePath: 'imports/shape-a',
          expectedTargetType: 'shape',
        },
        {
          status: 'resolved',
          code: 'STAGED_FOLDER_ACTION_REFERENCE_RESOLVED',
          dependentNodeId: 'dependent-2',
          referencePath: 'imports/shape-b',
          resolvedTargetNodeId: 'target-shape-b',
        },
      ],
      updatedAt: 120,
    });

    await expect(store.getRun(run.runId)).resolves.toMatchObject({
      phase: 'resolving-references',
      warnings: [
        {
          category: 'reference',
          code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
          referencePath: 'imports/shape-a',
        },
      ],
      pendingReferences: [
        {
          status: 'pending',
          referencePath: 'imports/shape-a',
        },
        {
          status: 'resolved',
          referencePath: 'imports/shape-b',
          resolvedTargetNodeId: 'target-shape-b',
        },
      ],
    });
  });

  it('rejects invalid pending reference contracts', async () => {
    const run = await store.createRun({
      runId: 'run-invalid-reference' as NodeId,
      sourceNodeId: 'source-invalid-reference' as NodeId,
      now: 100,
    });

    await expect(
      store.updateRun(run.runId, {
        pendingReferences: [
          {
            status: 'pending',
            code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
            referencePath: '',
          },
        ],
        updatedAt: 120,
      })
    ).rejects.toThrow(/pendingReferences\[0\]\.referencePath/);
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

  it('treats cleanup and output writing phases as active finalizing runtime records', async () => {
    const run = await store.createRun({
      runId: 'run-finalizing' as NodeId,
      sourceNodeId: 'source-finalizing' as NodeId,
      now: 100,
    });
    await store.updateRun(run.runId, {
      status: 'completed',
      phase: 'cleanup',
      progress: {
        total: 1,
        completed: 1,
        failed: 0,
        skipped: 0,
        percentage: 100,
      },
      updatedAt: 120,
    });

    const adapter = createStagedFolderActionBuildRuntimeAdapter(store);

    await expect(adapter.getSession(run.runId)).resolves.toMatchObject({
      status: 'finalizing',
      isActive: true,
    });
    await expect(adapter.listSessions({ activeOnly: true })).resolves.toEqual([
      expect.objectContaining({ nodeId: run.runId, status: 'finalizing' }),
    ]);
    await expect(store.deleteRun(run.runId)).rejects.toThrow(/Cannot delete active/);
  });

  it('stores map image capture intents and removes them with the terminal run', async () => {
    const run = await store.createRun({
      runId: 'run-capture' as NodeId,
      sourceNodeId: 'source-capture' as NodeId,
      now: 100,
    });
    await store.putMapImageCaptureIntent(
      {
        intentId: 'run-capture:1',
        runId: run.runId,
        stagingRootNodeId: 'staging-root' as NodeId,
        browserMode: 'headless',
        mapRoute: {
          nodeId: 'staging-root' as NodeId,
          search: { captureIntentId: 'run-capture:1' },
        },
        viewport: {
          bbox: [139, 35, 140, 36],
          width: 800,
          height: 600,
        },
        layers: [{ path: '.', visible: true }],
        output: { path: 'exports/out.png' },
      },
      120
    );

    await expect(store.getMapImageCaptureIntent('run-capture:1')).resolves.toMatchObject({
      intentId: 'run-capture:1',
      runId: 'run-capture',
      createdAt: 120,
      updatedAt: 120,
    });

    await store.updateRun(run.runId, {
      status: 'completed',
      phase: 'completed',
      progress: {
        total: 1,
        completed: 1,
        failed: 0,
        skipped: 0,
        percentage: 100,
      },
      completedAt: 130,
      updatedAt: 130,
    });
    await store.deleteRun(run.runId);

    await expect(store.getMapImageCaptureIntent('run-capture:1')).resolves.toBeNull();
  });
});
