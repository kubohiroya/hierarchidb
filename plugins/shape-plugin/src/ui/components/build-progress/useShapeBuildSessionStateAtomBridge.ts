import { useEffect } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { dispatchBuildSessionEventAtom } from '~/ui/atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '~/ui/atoms/buildSessionWorkerEventAdapter';
import type { ShapeStageId } from '~/ui/atoms/buildSessionStateAtoms';
import type { BuildTaskSummary, TaskStage, ProgressPhase, TaskProgressUpdatedEvent } from '@hierarchidb/build-api';
import type {
    SessionStatusUpdatedEvent,
    StageSnapshotUpdatedEvent,
    HeartbeatEvent,
} from '~/common/types/session-events';
import type { AdapterStageSnapshotUpdatedEvent } from '@hierarchidb/ui-build-sessions';
import { UIEventBufferManager, type BufferedEvent } from './eventBufferingUI';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const SHAPE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const satisfies readonly ShapeStageId[];

type UiSyncPhase = 'ui-initializing' | 'running';

// ---------------------------------------------------------------------------
// Exported pure functions (used by tests and internal logic)
// ---------------------------------------------------------------------------

export const isTaskUpdateVersionAfterSnapshot = (
    snapshotVersionMax: number,
    taskVersion: number,
): boolean => taskVersion > snapshotVersionMax;

export const resolveTaskVersionAction = (
    lastAppliedVersion: number | undefined,
    nextVersion: number,
): 'accept' | 'drop' | 'error' => {
    if (typeof lastAppliedVersion !== 'number') return 'accept';
    if (nextVersion > lastAppliedVersion) return 'accept';
    if (nextVersion === lastAppliedVersion) return 'drop';
    return 'error';
};

export const resolveTaskIdentityAction = (
    isKnownTaskId: boolean,
    snapshotVersionMax: number,
    taskVersion: number,
): 'accept-known' | 'accept-new' | 'drop-known-stale' | 'error-unknown-stale' => {
    if (isTaskUpdateVersionAfterSnapshot(snapshotVersionMax, taskVersion)) {
        return isKnownTaskId ? 'accept-known' : 'accept-new';
    }
    if (isKnownTaskId) return 'drop-known-stale';
    return 'error-unknown-stale';
};

const resolveShapeStageId = (value: unknown): ShapeStageId | undefined => {
    if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
        return value;
    }
    return undefined;
};

export const resolveSnapshotTargetStages = (event: StageSnapshotUpdatedEvent): ShapeStageId[] => {
    const snapshotStages = new Set<ShapeStageId>();
    for (const task of event.payload.tasks) {
        const stageId = resolveShapeStageId(task.stage);
        if (stageId) snapshotStages.add(stageId);
    }
    const stageFromEvent = resolveShapeStageId(event.payload.stageId);
    if (snapshotStages.size === 0 && stageFromEvent) {
        snapshotStages.add(stageFromEvent);
    }
    if (snapshotStages.size === 0) {
        for (const stageId of SHAPE_STAGE_IDS) {
            snapshotStages.add(stageId);
        }
    }
    return Array.from(snapshotStages);
};

export const useShapeBuildSessionStateAtomBridge = (nodeId: NodeId | undefined): void => {
    const dispatch = useSetAtom(dispatchBuildSessionEventAtom);

    useEffect(() => {
        if (!nodeId) {
            dispatch({ type: 'reset' });
            return;
        }

        const nodeIdText = String(nodeId);
        const bridge = getBuildWorkerBridge();
        const adapter = createBuildSessionWorkerEventAdapter(nodeIdText, (event) => {
            dispatch(event);
        });

        let cancelled = false;
        let unsubscribeAll: (() => void) | null = null;

        const uiSyncByStage: Record<ShapeStageId, UiSyncPhase> = {
            source: 'ui-initializing',
            geometry: 'ui-initializing',
            tileEmit: 'ui-initializing',
        };
        const progressBufferByStage: Record<ShapeStageId, TaskProgressUpdatedEvent[]> = {
            source: [],
            geometry: [],
            tileEmit: [],
        };
        let activeStageId: ShapeStageId = 'source';
        let flushTimerId: number | null = null;

        // Per-stage buffer manager for task-progress version gating.
        // session-state and stage-snapshot use FIFO queues inside the manager.
        const eventBufferManager = new UIEventBufferManager();

        const dispatchUiSyncPhase = (stageId: ShapeStageId, phase: UiSyncPhase): void => {
            if (uiSyncByStage[stageId] === phase) return;
            uiSyncByStage[stageId] = phase;
            dispatch({
                type: 'uiSyncPhaseChanged',
                payload: { stageId, phase },
            });
        };

        const flushProgressBuffer = (): void => {
            flushTimerId = null;
            for (const stageId of SHAPE_STAGE_IDS) {
                if (uiSyncByStage[stageId] !== 'running') continue;
                const queue = progressBufferByStage[stageId];
                if (queue.length <= 0) continue;
                progressBufferByStage[stageId] = [];
                for (const progressEvent of queue) {
                    adapter.onProgressEvent(progressEvent);
                }
            }
        };

        const scheduleFlush = (): void => {
            if (flushTimerId !== null) return;
            // Always use requestAnimationFrame — this code runs exclusively in browser context
            // (inside useEffect). The setTimeout fallback was dead code that caused test/prod divergence.
            flushTimerId = window.requestAnimationFrame(flushProgressBuffer);
        };

        const resolveProgressPhase = (value: string): ProgressPhase => {
            if (
                value === 'idle' || value === 'queued' || value === 'running' ||
                value === 'paused' || value === 'completed' || value === 'failed' || value === 'recycled'
            ) {
                return value;
            }
            throw new Error(`[useShapeBuildSessionStateAtomBridge] unknown task status: ${value}`);
        };

        const toAdapterStageSnapshotEvent = (event: StageSnapshotUpdatedEvent): AdapterStageSnapshotUpdatedEvent => {
            const tasks: BuildTaskSummary[] = event.payload.tasks.map((task) => {
                const stage = resolveShapeStageId(task.stage);
                if (stage === undefined) {
                    throw new Error(`[useShapeBuildSessionStateAtomBridge] unknown stage in snapshot: ${String(task.stage)}`);
                }
                return {
                    taskId: task.taskId,
                    version: task.version,
                    stage: stage as TaskStage,
                    status: resolveProgressPhase(task.status),
                    progress: task.progress,
                    errorMessage: task.errorMessage,
                    metadata: task.metadata,
                };
            });
            return {
                type: 'stageSnapshotUpdated',
                payload: {
                    stageId: event.payload.stageId,
                    tasks,
                    stageStartedAt: event.payload.stageStartedAt,
                    stageInactiveMs: event.payload.stageInactiveMs,
                    stageCompletedAt: event.payload.stageCompletedAt,
                },
            };
        };

        const processStageSnapshotEvent = (event: StageSnapshotUpdatedEvent): void => {
            const snapshotStages = new Set<ShapeStageId>();
            for (const task of event.payload.tasks) {
                const stageId = resolveShapeStageId(task.stage);
                if (stageId) snapshotStages.add(stageId);
            }
            adapter.onTaskEvent(toAdapterStageSnapshotEvent(event));
            for (const stageId of SHAPE_STAGE_IDS) {
                if (snapshotStages.size > 0 && !snapshotStages.has(stageId)) continue;
                dispatchUiSyncPhase(stageId, 'running');
            }
            scheduleFlush();
        };

        const processProgressEvent = (event: TaskProgressUpdatedEvent): void => {
            const stageId = resolveShapeStageId(event.payload.stageId);
            if (!stageId) {
                throw new Error(`[useShapeBuildSessionStateAtomBridge] unknown stageId in taskProgressUpdated: ${String(event.payload.stageId)}`);
            }
            if (activeStageId !== stageId) {
                activeStageId = stageId;
                dispatchUiSyncPhase(stageId, 'ui-initializing');
            }
            progressBufferByStage[stageId].push(event);
            if (uiSyncByStage[stageId] !== 'running') return;
            scheduleFlush();
        };

        const processSessionStatusEvent = (event: SessionStatusUpdatedEvent): void => {
            adapter.onSessionState(event);
            // Derive UI sync signal from the canonical phase and stageId fields.
            // 'startup:*' and 'ui-sync:*' stageId values are not part of the spec
            // and must not be interpreted here.
            const stageId = resolveShapeStageId(event.payload.stageId);
            if (!stageId) return;
            if (activeStageId !== stageId) {
                activeStageId = stageId;
            }
            const phase = event.payload.phase;
            if (phase === 'running') {
                dispatchUiSyncPhase(stageId, 'running');
                scheduleFlush();
            }
        };

        // ---------------------------------------------------------------------------
        // Incoming event handlers — all events are enqueued immediately on arrival.
        // No seqNum-based gap detection; session-state and stage-snapshot are FIFO.
        // task-progress goes through version gating only.
        // ---------------------------------------------------------------------------

        const onTaskEvent = (event: StageSnapshotUpdatedEvent): void => {
            // Enqueue into FIFO queue, then flush immediately via rAF
            const buffered: BufferedEvent = {
                version: undefined,
                notificationType: 'stage-snapshot',
                payload: event,
                timestamp: Date.now(),
            };
            eventBufferManager.enqueue(buffered);
            flushFifoQueues();
        };

        const onProgressEvent = (event: TaskProgressUpdatedEvent & { version?: number }): void => {
            const buffered: BufferedEvent = {
                version: event.version,
                notificationType: 'task-progress',
                payload: event,
                timestamp: Date.now(),
            };
            const accepted = eventBufferManager.applyTaskProgress(buffered);
            if (accepted) {
                processProgressEvent(event);
            }
        };

        const onSessionState = (event: SessionStatusUpdatedEvent): void => {
            // Enqueue into FIFO queue, then flush immediately via rAF
            const buffered: BufferedEvent = {
                version: undefined,
                notificationType: 'session-state',
                payload: event,
                timestamp: Date.now(),
            };
            eventBufferManager.enqueue(buffered);
            flushFifoQueues();
        };

        const flushFifoQueues = (): void => {
            // Drain session-state FIFO
            for (const ev of eventBufferManager.flushFifo('session-state')) {
                processSessionStatusEvent(ev.payload as SessionStatusUpdatedEvent);
            }
            // Drain stage-snapshot FIFO
            for (const ev of eventBufferManager.flushFifo('stage-snapshot')) {
                processStageSnapshotEvent(ev.payload as StageSnapshotUpdatedEvent);
            }
        };

        const requireEventShape = <T extends { type: string }>(
            event: unknown,
            expectedType: string,
            context: string,
        ): T => {
            if (!event || typeof event !== 'object') {
                throw new Error(`[${context}] event must be an object, received ${JSON.stringify(event)}`);
            }
            const rec = event as Record<string, unknown>;
            if (rec.type !== expectedType) {
                throw new Error(`[${context}] unexpected event type: expected "${expectedType}", received ${JSON.stringify(rec.type)}`);
            }
            return event as T;
        };

        const run = async () => {
            await bridge.initialize();
            if (cancelled) return;

            const runtime = await bridge.getBuildSessionRuntime(SHAPE_NODE_TYPE, nodeId);
            if (cancelled) return;
            if (runtime) {
                adapter.onRuntimeRecord(runtime);
            }

            unsubscribeAll = await bridge.subscribeAll(SHAPE_NODE_TYPE, nodeId, {
                onTaskEvent: (event) => {
                    if (cancelled) return;
                    onTaskEvent(requireEventShape<StageSnapshotUpdatedEvent>(event, 'stageSnapshotUpdated', 'onTaskEvent'));
                },
                onProgressEvent: (event) => {
                    if (cancelled) return;
                    onProgressEvent(requireEventShape<TaskProgressUpdatedEvent & { version?: number }>(event, 'taskProgressUpdated', 'onProgressEvent'));
                },
                onSessionState: (event) => {
                    if (cancelled) return;
                    onSessionState(requireEventShape<SessionStatusUpdatedEvent>(event, 'sessionStatusUpdated', 'onSessionState'));
                },
                onHeartbeat: (event) => {
                    if (cancelled) return;
                    adapter.onHeartbeat(requireEventShape<HeartbeatEvent>(event, 'heartbeat', 'onHeartbeat'));
                },
                onWorkerLog: (event) => {
                    if (cancelled) return;
                    const level = (event as { level?: string }).level;
                    if (level === 'error') {
                        console.error('[Worker]', (event as { message?: string }).message, (event as { data?: unknown }).data);
                    } else if (level === 'warn') {
                        console.warn('[Worker]', (event as { message?: string }).message, (event as { data?: unknown }).data);
                    } else {
                        console.log('[Worker]', (event as { message?: string }).message, (event as { data?: unknown }).data);
                    }
                },
            });

            if (cancelled) {
                unsubscribeAll();
                unsubscribeAll = null;
                return;
            }

            adapter.onTaskStreamConnectionChanged(true);
        };

        void run().catch((error) => {
            if (cancelled) return;
            console.warn('[shape buildSessionStateAtomBridge] failed to start subscriptions', error);
        });

        return () => {
            cancelled = true;
            if (flushTimerId !== null) {
                window.cancelAnimationFrame(flushTimerId);
                flushTimerId = null;
            }
            adapter.onTaskStreamConnectionChanged(false);
            eventBufferManager.reset();
            unsubscribeAll?.();
        };
    }, [dispatch, nodeId]);
};
