import { useEffect } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildProgressEvent, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { dispatchBuildSessionEventAtom } from '~/ui/atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '~/ui/atoms/buildSessionWorkerEventAdapter';
import type { ShapeStageId } from '~/ui/atoms/buildSessionStateAtoms';
import {
    UIEventBufferManager,
    type SequencedEvent,
    type NotificationType,
} from './eventBufferingUI';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const SHAPE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const satisfies readonly ShapeStageId[];

type UiSyncPhase = 'ui-initializing' | 'running';

type TaskSnapshotEvent = Extract<BuildTaskUpdateEvent, { type: 'snapshot' }> & {
    version?: unknown;
    stage?: unknown;
    seqNum?: number;
};

interface SequencedBuildProgressEvent extends BuildProgressEvent {
    seqNum?: number;
}

interface SequencedSessionStateEvent {
    nodeId: string;
    sessionRecord?: Record<string, unknown> | null;
    seqNum?: number;
}

const resolveShapeStageId = (value: unknown): ShapeStageId | undefined => {
    if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
        return value;
    }
    return undefined;
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

        // seqNum-based buffer for events that carry sequence numbers
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

        const flushSeqNumBufferedEvents = (): void => {
            flushTimerId = null;
            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];
            for (const notificationType of notificationTypes) {
                const readyEvents = eventBufferManager.flushBuffer(notificationType);
                for (const sequencedEvent of readyEvents) {
                    switch (notificationType) {
                        case 'session-state':
                            processSessionStateEvent(sequencedEvent.payload as SequencedSessionStateEvent);
                            break;
                        case 'stage-snapshot':
                            processTaskSnapshotEvent(sequencedEvent.payload as TaskSnapshotEvent);
                            break;
                        case 'task-progress':
                            processProgressEvent(sequencedEvent.payload as SequencedBuildProgressEvent);
                            break;
                    }
                }
            }
        };

        const scheduleProgressFlush = (): void => {
            if (flushTimerId !== null) return;
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                flushTimerId = window.requestAnimationFrame(flushProgressBuffer);
                return;
            }
            flushTimerId = window.setTimeout(flushProgressBuffer, 0);
        };

        const scheduleSeqNumFlush = (): void => {
            if (flushTimerId !== null) return;
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                flushTimerId = window.requestAnimationFrame(flushSeqNumBufferedEvents);
                return;
            }
            flushTimerId = window.setTimeout(flushSeqNumBufferedEvents, 0);
        };

        const processTaskSnapshotEvent = (snapshotEvent: TaskSnapshotEvent): void => {
            const snapshotStages = new Set<ShapeStageId>();
            for (const task of snapshotEvent.tasks) {
                const stageId = resolveShapeStageId(task.stage);
                if (stageId) snapshotStages.add(stageId);
            }

            try {
                adapter.onTaskEvent({
                    ...snapshotEvent,
                    version: snapshotVersion,
                } as BuildTaskUpdateEvent);
            } catch (adapterError) {
                console.error('[shape buildSessionStateAtomBridge] adapter.onTaskEvent(snapshot) threw', {
                    nodeId: nodeIdText,
                    error: adapterError instanceof Error ? adapterError.message : String(adapterError),
                    snapshotVersion,
                    taskStages: snapshotEvent.tasks.map((t) => t.stage),
                });
                throw adapterError;
            }

            for (const stageId of SHAPE_STAGE_IDS) {
                if (snapshotStages.size > 0 && !snapshotStages.has(stageId)) continue;
                dispatchUiSyncPhase(stageId, 'running');
            }

            console.log('[shape buildSessionStateAtomBridge] after dispatchUiSyncPhase', {
                nodeId: nodeIdText,
                handshakeReceived: store.get(buildSessionSnapshotHandshakeReceivedAtom),
            });

            if (!store.get(buildSessionSnapshotHandshakeReceivedAtom)) {
                // Flush pending updates that arrived before the initial snapshot.
                // snapshotVersionMaxByStage is now set, so version checks apply.
                for (const pendingUpdate of pendingTaskUpdatesBeforeInitialSnapshot) {
                    const pendingStageId = resolveShapeStageId(pendingUpdate.task.stage);
                    if (!pendingStageId) continue;
                    const versionMax = snapshotVersionMaxByStage[pendingStageId];
                    if (versionMax == null) continue;
                    if (isTaskUpdateVersionAfterSnapshot(versionMax, pendingUpdate.task.version)) {
                        adapter.onTaskEvent(pendingUpdate);
                    }
                }
                pendingTaskUpdatesBeforeInitialSnapshot.length = 0;
                console.log('[shape buildSessionStateAtomBridge] initial snapshot applied', {
                    nodeId: nodeIdText,
                    taskCount: snapshotEvent.tasks.length
                });
            }
        };

        const processProgressEvent = (event: SequencedBuildProgressEvent): void => {
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
            scheduleProgressFlush();
        };

        const processSessionStateEvent = (event: SequencedSessionStateEvent): void => {
            adapter.onSessionState(event);
            const signal = resolveUiSyncSignalFromSessionStageId(event.sessionRecord?.stageId);
            if (!signal) return;
            const stageId = signal.stageId;
            if (activeStageId !== stageId) {
                activeStageId = stageId;
            }
            dispatchUiSyncPhase(stageId, signal.phase);
            if (signal.phase === 'running') {
                scheduleProgressFlush();
            }
        };

        const onTaskEvent = (event: BuildTaskUpdateEvent): void => {
            if (event.type === 'snapshot') {
                const snapshotEvent = event as TaskSnapshotEvent;
                if (typeof snapshotEvent.seqNum === 'number') {
                    const sequencedEvent: SequencedEvent = {
                        seqNum: snapshotEvent.seqNum,
                        notificationType: 'stage-snapshot',
                        payload: snapshotEvent,
                        timestamp: Date.now(),
                    };
                    eventBufferManager.bufferEvent(sequencedEvent);
                    scheduleSeqNumFlush();
                    return;
                }
                processTaskSnapshotEvent(snapshotEvent);
                return;
            }
            adapter.onTaskEvent(event);
        };

        const onProgressEvent = (event: SequencedBuildProgressEvent): void => {
            if (typeof event.seqNum === 'number') {
                const sequencedEvent: SequencedEvent = {
                    seqNum: event.seqNum,
                    notificationType: 'task-progress',
                    payload: event,
                    timestamp: Date.now(),
                };
                eventBufferManager.bufferEvent(sequencedEvent);
                scheduleSeqNumFlush();
                return;
            }
            processProgressEvent(event);
        };

        const onSessionState = (event: SequencedSessionStateEvent): void => {
            if (typeof event.seqNum === 'number') {
                const sequencedEvent: SequencedEvent = {
                    seqNum: event.seqNum,
                    notificationType: 'session-state',
                    payload: event,
                    timestamp: Date.now(),
                };
                eventBufferManager.bufferEvent(sequencedEvent);
                scheduleSeqNumFlush();
                return;
            }
            processSessionStateEvent(event);
        };

        // Synchronous channel establishment
        const establishChannels = async () => {
            try {
                await bridge.initialize();
                if (cancelled) return;

                const runtime = await bridge.getBuildSessionRuntime(SHAPE_NODE_TYPE, nodeId);
                if (cancelled) return;
                if (runtime) {
                    adapter.onRuntimeRecord(runtime);
                }

                // Establish all channels synchronously
                const [unsubscribeTasks, unsubscribeProgress, unsubscribeSessionState, unsubscribeHeartbeat, unsubscribeWorkerLog] = await Promise.all([
                    bridge.subscribeBuildTasks(SHAPE_NODE_TYPE, nodeId, (event) => {
                        onTaskEvent(event);
                    }),
                    bridge.subscribeBuildProgress(SHAPE_NODE_TYPE, nodeId, (event) => {
                        onProgressEvent(event as SequencedBuildProgressEvent);
                    }),
                    bridge.subscribeSessionState(SHAPE_NODE_TYPE, nodeId, (raw: unknown) => {
                        // unconditionalEventStreamer delivers SequencedEvent wrapper: { seqNum, notificationType, payload, timestamp }
                        const sequenced = raw as { seqNum?: number; payload?: unknown };
                        const inner = (typeof sequenced.seqNum === 'number' && sequenced.payload !== undefined)
                            ? sequenced.payload
                            : raw;
                        onSessionState(inner as SequencedSessionStateEvent);
                    }),
                    bridge.subscribeSessionHeartbeat(SHAPE_NODE_TYPE, nodeId, (raw: unknown) => {
                        // unconditionalEventStreamer delivers SequencedEvent wrapper for heartbeat
                        const sequenced = raw as { seqNum?: number; payload?: unknown };
                        const inner = (typeof sequenced.seqNum === 'number' && sequenced.payload !== undefined)
                            ? sequenced.payload
                            : raw;
                        heartbeatProcessor.processHeartbeat(inner as { nodeId: string; heartbeatAt?: number });
                    }),
                    bridge.subscribeWorkerLog(SHAPE_NODE_TYPE, nodeId, (raw: unknown) => {
                        // unconditionalEventStreamer delivers SequencedEvent wrapper: { seqNum, notificationType, payload, timestamp }
                        const sequenced = raw as { seqNum?: number; payload?: unknown };
                        const event = (typeof sequenced.seqNum === 'number' && sequenced.payload !== undefined)
                            ? sequenced.payload as { level?: string; message?: string; data?: unknown }
                            : raw as { level?: string; message?: string; data?: unknown };
                        const level = event.level;
                        if (level === 'error') {
                            console.error('[Worker]', event.message, event.data ?? '');
                        } else if (level === 'warn') {
                            console.warn('[Worker]', event.message, event.data ?? '');
                        } else {
                            console.log('[Worker]', event.message, event.data ?? '');
                        }
                    }),
                ]);

                if (cancelled) {
                    unsubscribeTasks();
                    unsubscribeProgress();
                    unsubscribeSessionState();
                    unsubscribeHeartbeat();
                    unsubscribeWorkerLog();
                    return;
                }

                adapter.onTaskStreamConnectionChanged(true);

                unsubscribers.push(unsubscribeTasks, unsubscribeProgress, unsubscribeSessionState, unsubscribeHeartbeat, unsubscribeWorkerLog);
            } catch (error) {
                if (cancelled) return;
                console.warn('[shape buildSessionStateAtomBridge] failed to establish channels', error);
                // Dispatch error to SSOT state tree instead of local state
                dispatch({
                    type: 'channelError',
                    payload: {
                        error: error instanceof Error ? error : new Error(String(error))
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
