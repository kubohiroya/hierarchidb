import { useEffect } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildProgressEvent, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { dispatchBuildSessionEventAtom } from '~/ui/atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '~/ui/atoms/buildSessionWorkerEventAdapter';
import type { ShapeStageId } from '~/ui/atoms/buildSessionStateAtoms';
import { UIEventBufferManager, type BufferedEvent } from './eventBufferingUI';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const SHAPE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const satisfies readonly ShapeStageId[];

type UiSyncPhase = 'ui-initializing' | 'running';

type TaskSnapshotEvent = Extract<BuildTaskUpdateEvent, { type: 'snapshot' }> & {
    version?: unknown;
    stage?: unknown;
};

interface VersionedBuildProgressEvent extends BuildProgressEvent {
    /** Distributed version number from Worker (task-progress ordering only) */
    version?: number;
}

interface SessionStateEvent {
    nodeId: string;
    sessionRecord?: Record<string, unknown> | null;
}

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

export const resolveSnapshotTargetStages = (event: TaskSnapshotEvent): ShapeStageId[] => {
    const snapshotStages = new Set<ShapeStageId>();
    for (const task of event.tasks) {
        const stageId = resolveShapeStageId(task.stage);
        if (stageId) snapshotStages.add(stageId);
    }
    const stageFromEvent = resolveShapeStageId(event.stage);
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

const resolveUiSyncSignalFromSessionStageId = (
    value: unknown,
): { stageId: ShapeStageId; phase: UiSyncPhase } | undefined => {
    if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
        return { stageId: value, phase: 'running' };
    }
    if (value === 'source-stage') return { stageId: 'source', phase: 'running' };
    if (value === 'geometry-stage') return { stageId: 'geometry', phase: 'running' };
    if (value === 'tile-emit-stage') return { stageId: 'tileEmit', phase: 'running' };
    if (typeof value !== 'string') return undefined;
    if (!value.startsWith('ui-sync:')) return undefined;
    const [, rawStage, rawPhase] = value.split(':');
    const stageId = resolveShapeStageId(rawStage);
    if (!stageId) return undefined;
    if (rawPhase === 'ui-initializing' || rawPhase === 'running') {
        return { stageId, phase: rawPhase };
    }
    return undefined;
};

const resolveSnapshotVersion = (event: TaskSnapshotEvent): number => {
    if (event.type !== 'snapshot') {
        throw new Error('[shape buildSessionStateAtomBridge] resolveSnapshotVersion requires snapshot event');
    }
    if (event.tasks.length > 0) {
        return event.tasks.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER);
    }
    const explicitVersion = event.version;
    if (typeof explicitVersion !== 'number' || !Number.isFinite(explicitVersion) || explicitVersion < 0) {
        throw new Error('[shape buildSessionStateAtomBridge] empty snapshot requires finite snapshot version');
    }
    return Math.floor(explicitVersion);
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
        const progressBufferByStage: Record<ShapeStageId, BuildProgressEvent[]> = {
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
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                flushTimerId = window.requestAnimationFrame(flushProgressBuffer);
                return;
            }
            flushTimerId = window.setTimeout(flushProgressBuffer, 0);
        };

        const processTaskSnapshotEvent = (snapshotEvent: TaskSnapshotEvent): void => {
            const snapshotStages = new Set<ShapeStageId>();
            for (const task of snapshotEvent.tasks) {
                const stageId = resolveShapeStageId(task.stage);
                if (stageId) snapshotStages.add(stageId);
            }
            adapter.onTaskEvent({
                ...snapshotEvent,
                version: resolveSnapshotVersion(snapshotEvent),
            } as BuildTaskUpdateEvent);
            for (const stageId of SHAPE_STAGE_IDS) {
                if (snapshotStages.size > 0 && !snapshotStages.has(stageId)) continue;
                dispatchUiSyncPhase(stageId, 'running');
            }
            scheduleFlush();
        };

        const processProgressEvent = (event: VersionedBuildProgressEvent): void => {
            const stageId = resolveShapeStageId(event.stage);
            if (!stageId) {
                adapter.onProgressEvent(event);
                return;
            }
            if (activeStageId !== stageId) {
                activeStageId = stageId;
                dispatchUiSyncPhase(stageId, 'ui-initializing');
            }
            progressBufferByStage[stageId].push(event);
            if (uiSyncByStage[stageId] !== 'running') return;
            scheduleFlush();
        };

        const processSessionStateEvent = (event: SessionStateEvent): void => {
            adapter.onSessionState(event);
            const signal = resolveUiSyncSignalFromSessionStageId(event.sessionRecord?.stageId);
            if (!signal) return;
            const stageId = signal.stageId;
            if (activeStageId !== stageId) {
                activeStageId = stageId;
            }
            dispatchUiSyncPhase(stageId, signal.phase);
            if (signal.phase === 'running') {
                scheduleFlush();
            }
        };

        // ---------------------------------------------------------------------------
        // Incoming event handlers — all events are enqueued immediately on arrival.
        // No seqNum-based gap detection; session-state and stage-snapshot are FIFO.
        // task-progress goes through version gating only.
        // ---------------------------------------------------------------------------

        const onTaskEvent = (event: BuildTaskUpdateEvent): void => {
            if (event.type === 'snapshot') {
                // Enqueue into FIFO queue, then flush immediately via rAF
                const buffered: BufferedEvent = {
                    version: undefined,
                    notificationType: 'stage-snapshot',
                    payload: event as TaskSnapshotEvent,
                    timestamp: Date.now(),
                };
                eventBufferManager.enqueue(buffered);
                flushFifoQueues();
                return;
            }
            adapter.onTaskEvent(event);
        };

        const onProgressEvent = (event: VersionedBuildProgressEvent): void => {
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

        const onSessionState = (event: SessionStateEvent): void => {
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
                processSessionStateEvent(ev.payload as SessionStateEvent);
            }
            // Drain stage-snapshot FIFO
            for (const ev of eventBufferManager.flushFifo('stage-snapshot')) {
                processTaskSnapshotEvent(ev.payload as TaskSnapshotEvent);
            }
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
                    onTaskEvent(event);
                },
                onProgressEvent: (event) => {
                    if (cancelled) return;
                    onProgressEvent(event as VersionedBuildProgressEvent);
                },
                onSessionState: (event) => {
                    if (cancelled) return;
                    onSessionState(event as SessionStateEvent);
                },
                onHeartbeat: (event) => {
                    if (cancelled) return;
                    adapter.onHeartbeat(event);
                },
                onWorkerLog: (event) => {
                    if (cancelled) return;
                    const level = event.level;
                    if (level === 'error') {
                        console.error('[Worker]', event.message, event.data);
                    } else if (level === 'warn') {
                        console.warn('[Worker]', event.message, event.data);
                    } else {
                        console.log('[Worker]', event.message, event.data);
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
                if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                    window.cancelAnimationFrame(flushTimerId);
                } else {
                    window.clearTimeout(flushTimerId);
                }
                flushTimerId = null;
            }
            adapter.onTaskStreamConnectionChanged(false);
            eventBufferManager.reset();
            unsubscribeAll?.();
        };
    }, [dispatch, nodeId]);
};
