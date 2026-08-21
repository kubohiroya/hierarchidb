import type { CanonicalSessionEvent } from '@hierarchidb/build-api';
import { unconditionalEventStreamer } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteBuildConfig } from '@hierarchidb/route-api';
import { deleteTasksByNode, listTasksByStatus, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { afterEach, describe, expect, it } from 'vitest';
import { RouteBuildSessionOrchestrator } from '../../../services/RouteBuildSessionOrchestrator';

const nodeId = 'route-canonical-events' as NodeId;
const taskQueue = new VtTaskQueueDb();

describe('RouteBuildSession canonical events', () => {
  afterEach(async () => {
    unconditionalEventStreamer.cleanup(nodeId);
    await deleteTasksByNode(taskQueue, nodeId);
  });

  it('emits the four canonical event types for all route stages', async () => {
    const events: CanonicalSessionEvent[] = [];
    const completed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        const canonicalEvent = event as CanonicalSessionEvent;
        events.push(canonicalEvent);
        if (
          canonicalEvent.type === 'sessionStatusUpdated' &&
          canonicalEvent.payload.phase === 'completed'
        ) {
          resolve();
        }
      });
    });
    for (const eventType of ['stage-snapshot', 'task-progress', 'heartbeat'] as const) {
      unconditionalEventStreamer.subscribe(nodeId, eventType, (event) => {
        events.push(event as CanonicalSessionEvent);
      });
    }

    const config: RouteBuildConfig = {
      routeGeneration: {
        method: 'direct',
        parallel: false,
        maxConcurrent: 1,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const orchestrator = new RouteBuildSessionOrchestrator({
      session: {
        generator: {
          generate: async () => ({ lineGeometry: [], distance: 0, duration: 0 }),
        },
      },
    });
    await orchestrator.prepareSession(nodeId, config, {
      routes: [
        {
          startCoordinates: [0, 0],
          endCoordinates: [1, 1],
          method: 'direct',
        },
      ],
    });
    await orchestrator.startBuildSession(nodeId);
    await completed;

    await expect(orchestrator.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      nodeId,
      status: 'completed',
    });

    const sessionEvents = events.filter((event) => event.type === 'sessionStatusUpdated');
    expect(sessionEvents.at(0)?.payload.phase).toBe('idle');
    expect(sessionEvents.at(-1)?.payload.phase).toBe('completed');
    expect(events.some((event) => event.type === 'heartbeat')).toBe(true);

    const stageSnapshots = events.filter((event) => event.type === 'stageSnapshotUpdated');
    expect(new Set(stageSnapshots.map((event) => event.payload.stageId))).toEqual(
      new Set(['source', 'geometry', 'tileEmit'])
    );
    for (const stageId of ['source', 'geometry', 'tileEmit']) {
      const stageEvents = stageSnapshots.filter((event) => event.payload.stageId === stageId);
      expect(stageEvents).toHaveLength(4);
      expect(stageEvents.at(-1)?.payload.tasks).toEqual([
        expect.objectContaining({ status: 'completed', progress: 100, version: 3 }),
      ]);
      expect(stageEvents.at(-1)?.payload.stageCompletedAt).toEqual(expect.any(Number));
    }

    const progressEvents = events.filter((event) => event.type === 'taskProgressUpdated');
    expect(progressEvents).toHaveLength(6);
    expect(
      progressEvents.every(
        (event) =>
          Number.isFinite(event.payload.value) &&
          event.payload.value >= 0 &&
          event.payload.value <= 100
      )
    ).toBe(true);
  });

  it('aborts the active route task before publishing paused state', async () => {
    let resolveGeneration: (() => void) | null = null;
    const generationStarted = new Promise<void>((resolve) => {
      resolveGeneration = resolve;
    });
    let finishGeneration: (() => void) | null = null;
    const generationResult = new Promise<{
      lineGeometry: [number, number][];
      distance: number;
      duration: number;
    }>((resolve) => {
      finishGeneration = () => resolve({ lineGeometry: [], distance: 0, duration: 0 });
    });
    const orchestrator = new RouteBuildSessionOrchestrator({
      session: {
        generator: {
          generate: async () => {
            const notifyGenerationStarted = resolveGeneration;
            if (!notifyGenerationStarted)
              throw new Error('Generation start resolver is unavailable');
            notifyGenerationStarted();
            return generationResult;
          },
        },
      },
    });
    const config: RouteBuildConfig = {
      routeGeneration: {
        method: 'direct',
        parallel: false,
        maxConcurrent: 1,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    await orchestrator.prepareSession(nodeId, config, {
      routes: [{ startCoordinates: [0, 0], endCoordinates: [1, 1], method: 'direct' }],
    });
    await orchestrator.startBuildSession(nodeId);
    await generationStarted;

    const pausePromise = orchestrator.pauseBuildSession(nodeId);
    const completeGeneration = finishGeneration;
    if (!completeGeneration) throw new Error('Generation completion resolver is unavailable');
    completeGeneration();
    await pausePromise;

    await expect(orchestrator.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'paused',
    });
    const runningTasks = await listTasksByStatus(taskQueue, nodeId, 'running');
    expect(runningTasks).toEqual([]);
    const queuedTasks = await listTasksByStatus(taskQueue, nodeId, 'queued');
    expect(queuedTasks).toHaveLength(3);
  });
});
