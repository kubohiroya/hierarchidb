import { useLayoutEffect, useRef } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildProgressEvent, BuildTaskSummary, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom, useAtomValue } from 'jotai';
import { dispatchBuildSessionEventAtom, buildSessionSnapshotHandshakeReceivedAtom } from '~/ui/atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '~/ui/atoms/buildSessionWorkerEventAdapter';
import type { ShapeStageId } from '~/ui/atoms/buildSessionStateAtoms';
import {
    UIEventBufferManager,
    ImmediateHeartbeatProcessor,
    logUIEventReception,
    type SequencedEvent,
    type NotificationType
} from './eventBufferingUI';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const SHAPE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const satisfies readonly ShapeStageId[];

type UiSyncPhase = 'ui-initializing' | 'running';
type TaskUpdateEvent = Extract<BuildTaskUpdateEvent, { type: 'update' }>;
type TaskSnapshotEvent = Extract<BuildTaskUpdateEvent, { type: 'snapshot' }> & {
    version?: unknown;
    stage?: unknown;
    seqNum?: number;
};

// Extended event types with seqNum support
interface SequencedBuildProgressEvent extends BuildProgressEvent {
    seqNum?: number;
}

interface SequencedSessionStateEvent {
    nodeId: string;
    sessionRecord?: Record<string, unknown> | null;
    seqNum?: number;
}

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

/**
 * Enhanced version with render-synchronized pub/sub initialization
 * Ensures channel establishment is part of component lifecycle
 */
/**
 * Enhanced bridge with SSOT state tree integration and seqNum-based event buffering
 */
export const useShapeBuildSessionStateAtomBridge = (nodeId: NodeId | undefined): void => {
    const dispatch = useSetAtom(dispatchBuildSessionEventAtom);
    const buildSessionSnapshotHandshakeReceived = useAtomValue(buildSessionSnapshotHandshakeReceivedAtom);
    // Keep a ref so the effect closure always reads the latest value without
    // re-running the entire channel setup when the handshake flag flips.
    const buildSessionSnapshotHandshakeReceivedRef = useRef(buildSessionSnapshotHandshakeReceived);
    useLayoutEffect(() => {
        buildSessionSnapshotHandshakeReceivedRef.current = buildSessionSnapshotHandshakeReceived;
    });

    // Use useLayoutEffect for synchronous channel establishment
    useLayoutEffect(() => {
        if (!nodeId) {
            dispatch({ type: 'reset' });
            return;
        }

        const nodeIdText = String(nodeId);
        const bridge = getBuildWorkerBridge();
        const adapter = createBuildSessionWorkerEventAdapter(nodeIdText, (event) => {
            // Always dispatch events - let SSOT state tree handle the logic
            dispatch(event);
        });

        // Initialize seqNum-based buffering
        const eventBufferManager = new UIEventBufferManager();
        const heartbeatProcessor = new ImmediateHeartbeatProcessor((event) => {
            // Heartbeat events can be processed immediately
            adapter.onHeartbeat(event as { nodeId: string; heartbeatAt?: number });
        });

        let cancelled = false;
        const unsubscribers: Array<() => void> = [];
        const uiSyncByStage: Record<ShapeStageId, UiSyncPhase> = {
            source: 'ui-initializing',
            geometry: 'ui-initializing',
            tileEmit: 'ui-initializing',
        };
        const snapshotTaskIdsByStage: Record<ShapeStageId, Set<string>> = {
            source: new Set<string>(),
            geometry: new Set<string>(),
            tileEmit: new Set<string>(),
        };
        const snapshotVersionMaxByStage: Record<ShapeStageId, number | null> = {
            source: null,
            geometry: null,
            tileEmit: null,
        };

        const pendingTaskUpdatesBeforeInitialSnapshot: TaskUpdateEvent[] = [];
        const lastAppliedVersionByTaskId = new Map<string, number>();
        const lastAppliedFingerprintByTaskVersion = new Map<string, string>();
        let fatalContractError = false;
        let activeStageId: ShapeStageId = 'source';
        let flushTimerId: number | null = null;

        const buildTaskFingerprint = (event: TaskUpdateEvent): string => JSON.stringify({
            taskId: event.task.taskId,
            version: event.task.version,
            stage: event.task.stage,
            status: event.task.status,
            progress: event.task.progress,
            sequence: event.task.sequence,
            display: event.task.display,
            metadata: event.task.metadata,
        });

        const stopWithContractError = (message: string): never => {
            fatalContractError = true;
            for (const unsubscribe of unsubscribers) {
                try {
                    unsubscribe();
                } catch {
                    // no-op
                }
            }
            throw new Error(message);
        };

        const resolveStageOrStop = (value: unknown, message: string): ShapeStageId => {
            const stageId = resolveShapeStageId(value);
            if (!stageId) {
                stopWithContractError(message);
            }
            return stageId as ShapeStageId;
        };

        const dispatchUiSyncPhase = (stageId: ShapeStageId, phase: UiSyncPhase): void => {
            if (uiSyncByStage[stageId] === phase) return;
            uiSyncByStage[stageId] = phase;

            // Always dispatch - let SSOT state tree handle the logic
            dispatch({
                type: 'uiSyncPhaseChanged',
                payload: {
                    stageId,
                    phase,
                },
            });
        };

        const flushBufferedEvents = (): void => {
            flushTimerId = null;

            // Process buffered events in seqNum order for each notification type
            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];

            for (const notificationType of notificationTypes) {
                const readyEvents = eventBufferManager.flushBuffer(notificationType);
                if (readyEvents.length === 0) continue;

                let processingError: unknown;
                try {
                    for (const sequencedEvent of readyEvents) {
                        switch (notificationType) {
                            case 'session-state': {
                                const sessionEvent = sequencedEvent.payload as SequencedSessionStateEvent;
                                processSessionStateEvent(sessionEvent);
                                break;
                            }
                            case 'stage-snapshot': {
                                const snapshotEvent = sequencedEvent.payload as TaskSnapshotEvent;
                                processTaskSnapshotEvent(snapshotEvent);
                                break;
                            }
                            case 'task-progress': {
                                const progressEvent = sequencedEvent.payload as SequencedBuildProgressEvent;
                                processProgressEvent(progressEvent);
                                break;
                            }
                        }
                    }
                    logUIEventReception(readyEvents, 'success');
                } catch (error) {
                    processingError = error;
                    logUIEventReception(readyEvents, 'error', processingError);
                    throw error;
                }
            }
        };

        const scheduleEventFlush = (): void => {
            if (fatalContractError) return;
            if (flushTimerId !== null) return;
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                flushTimerId = window.requestAnimationFrame(flushBufferedEvents);
                return;
            }
            flushTimerId = window.setTimeout(flushBufferedEvents, 0);
        };

        const processTaskSnapshotEvent = (snapshotEvent: TaskSnapshotEvent): void => {
            console.log('[shape buildSessionStateAtomBridge] processTaskSnapshotEvent', {
                nodeId: nodeIdText,
                taskCount: snapshotEvent.tasks.length,
                buildSessionSnapshotHandshakeReceived: buildSessionSnapshotHandshakeReceivedRef.current,
                snapshotEvent
            });

            const snapshotVersion = resolveSnapshotVersion(snapshotEvent);
            const snapshotStages = new Set<ShapeStageId>(resolveSnapshotTargetStages(snapshotEvent));

            console.log('[shape buildSessionStateAtomBridge] snapshot processing', {
                snapshotVersion,
                snapshotStages: Array.from(snapshotStages),
                nodeId: nodeIdText
            });

            for (const stageId of snapshotStages) {
                snapshotVersionMaxByStage[stageId] = snapshotVersion;
                snapshotTaskIdsByStage[stageId].clear();
            }

            for (const task of snapshotEvent.tasks) {
                const stageId = resolveStageOrStop(
                    task.stage,
                    `[shape buildSessionStateAtomBridge] task snapshot stage is unsupported: ${String(task.stage)}`,
                );
                snapshotTaskIdsByStage[stageId].add(task.taskId);
                lastAppliedVersionByTaskId.set(task.taskId, task.version);
                lastAppliedFingerprintByTaskVersion.set(
                    `${task.taskId}:${task.version}`,
                    buildTaskFingerprint({ type: 'update', task } as TaskUpdateEvent),
                );
            }

            adapter.onTaskEvent({
                ...snapshotEvent,
                version: snapshotVersion,
            } as BuildTaskUpdateEvent);

            for (const stageId of SHAPE_STAGE_IDS) {
                if (snapshotStages.size > 0 && !snapshotStages.has(stageId)) continue;
                dispatchUiSyncPhase(stageId, 'running');
            }

            if (!buildSessionSnapshotHandshakeReceivedRef.current) {
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

            if (uiSyncByStage[stageId] === 'running') {
                adapter.onProgressEvent(event);
            }
        };

        const processSessionStateEvent = (event: SequencedSessionStateEvent): void => {
            adapter.onSessionState(event);
            const signal = resolveUiSyncSignalFromSessionStageId(event.sessionRecord?.stageId);
            if (!signal) {
                return;
            }

            const stageId = signal.stageId;
            if (activeStageId !== stageId) {
                activeStageId = stageId;
            }

            dispatchUiSyncPhase(stageId, signal.phase);
            if (signal.phase === 'running') {
                scheduleEventFlush();
            }
        };

        const onTaskEvent = (event: BuildTaskUpdateEvent): void => {
            if (fatalContractError) return;

            console.log('[shape buildSessionStateAtomBridge] onTaskEvent', {
                nodeId: nodeIdText,
                eventType: event.type,
                hasSeqNum: typeof (event as any).seqNum === 'number',
                buildSessionSnapshotHandshakeReceived: buildSessionSnapshotHandshakeReceivedRef.current
            });

            if (event.type === 'snapshot') {
                const snapshotEvent = event as TaskSnapshotEvent;

                // Buffer stage-snapshot events with seqNum if available
                if (typeof snapshotEvent.seqNum === 'number') {
                    console.log('[shape buildSessionStateAtomBridge] buffering snapshot with seqNum', {
                        nodeId: nodeIdText,
                        seqNum: snapshotEvent.seqNum
                    });
                    const sequencedEvent: SequencedEvent = {
                        seqNum: snapshotEvent.seqNum,
                        notificationType: 'stage-snapshot',
                        payload: snapshotEvent,
                        timestamp: Date.now(),
                    };
                    eventBufferManager.bufferEvent(sequencedEvent);
                    scheduleEventFlush();
                    return;
                }

                // Fallback to immediate processing for events without seqNum
                console.log('[shape buildSessionStateAtomBridge] processing snapshot immediately (no seqNum)', {
                    nodeId: nodeIdText,
                    taskCount: snapshotEvent.tasks.length
                });
                processTaskSnapshotEvent(snapshotEvent);
                return;
            }

            if (event.type === 'update') {
                const updateEvent = event as TaskUpdateEvent;

                // Buffer task-progress events with seqNum if available
                if (typeof (updateEvent as any).seqNum === 'number') {
                    const sequencedEvent: SequencedEvent = {
                        seqNum: (updateEvent as any).seqNum,
                        notificationType: 'task-progress',
                        payload: updateEvent,
                        timestamp: Date.now(),
                    };
                    eventBufferManager.bufferEvent(sequencedEvent);
                    scheduleEventFlush();
                    return;
                }

                // Fallback to existing logic for events without seqNum
                const stageId = resolveStageOrStop(
                    updateEvent.task.stage,
                    `[shape buildSessionStateAtomBridge] task update stage is unsupported: ${String(updateEvent.task.stage)}`,
                );
                const snapshotVersionMax = snapshotVersionMaxByStage[stageId];
                if (snapshotVersionMax == null) {
                    if (!buildSessionSnapshotHandshakeReceivedRef.current) {
                        pendingTaskUpdatesBeforeInitialSnapshot.push(updateEvent);
                        return;
                    }
                    stopWithContractError(
                        `[shape buildSessionStateAtomBridge] task update arrived before snapshot handshake: ${updateEvent.task.taskId}`,
                    );
                }

                adapter.onTaskEvent(updateEvent);
                return;
            }

            // Other event types processed immediately
            adapter.onTaskEvent(event);
        };

        const onProgressEvent = (event: SequencedBuildProgressEvent): void => {
            // Buffer task-progress events with seqNum if available
            if (typeof event.seqNum === 'number') {
                const sequencedEvent: SequencedEvent = {
                    seqNum: event.seqNum,
                    notificationType: 'task-progress',
                    payload: event,
                    timestamp: Date.now(),
                };
                eventBufferManager.bufferEvent(sequencedEvent);
                scheduleEventFlush();
                return;
            }

            // Fallback to immediate processing for events without seqNum
            processProgressEvent(event);
        };

        const onSessionState = (event: SequencedSessionStateEvent): void => {
            // Buffer session-state events with seqNum if available
            if (typeof event.seqNum === 'number') {
                const sequencedEvent: SequencedEvent = {
                    seqNum: event.seqNum,
                    notificationType: 'session-state',
                    payload: event,
                    timestamp: Date.now(),
                };
                eventBufferManager.bufferEvent(sequencedEvent);
                scheduleEventFlush();
                return;
            }

            // Fallback to immediate processing for events without seqNum
            processSessionStateEvent(event);
        };

        // Synchronous channel establishment
        const establishChannels = async () => {
            try {
                await bridge.initialize();
                if (cancelled) return;

                const toSnapshotEvent = (tasks: BuildTaskSummary[]): TaskSnapshotEvent => ({
                    type: 'snapshot',
                    nodeId,
                    tasks,
                    version: tasks.length > 0
                        ? tasks.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER)
                        : 0,
                } as TaskSnapshotEvent);

                const runtime = await bridge.getBuildSessionRuntime(SHAPE_NODE_TYPE, nodeId);
                if (cancelled) return;
                if (runtime) {
                    adapter.onRuntimeRecord(runtime);
                }

                // Establish all channels synchronously
                const [unsubscribeTasks, unsubscribeProgress, unsubscribeSessionState, unsubscribeHeartbeat] = await Promise.all([
                    bridge.subscribeBuildTasks(SHAPE_NODE_TYPE, nodeId, (event) => {
                        onTaskEvent(event);
                    }),
                    bridge.subscribeBuildProgress(SHAPE_NODE_TYPE, nodeId, (event) => {
                        onProgressEvent(event as SequencedBuildProgressEvent);
                    }),
                    bridge.subscribeSessionState(SHAPE_NODE_TYPE, nodeId, (event) => {
                        onSessionState(event as SequencedSessionStateEvent);
                    }),
                    bridge.subscribeSessionHeartbeat(SHAPE_NODE_TYPE, nodeId, (event) => {
                        // Heartbeat events processed immediately without buffering
                        heartbeatProcessor.processHeartbeat(event as { nodeId: string; heartbeatAt?: number });
                    }),
                ]);

                if (cancelled) {
                    unsubscribeTasks();
                    unsubscribeProgress();
                    unsubscribeSessionState();
                    unsubscribeHeartbeat();
                    return;
                }

                adapter.onTaskStreamConnectionChanged(true);
                const tasks = await bridge.getBuildTasks(SHAPE_NODE_TYPE, nodeId);
                if (cancelled) {
                    unsubscribeTasks();
                    unsubscribeProgress();
                    unsubscribeSessionState();
                    unsubscribeHeartbeat();
                    return;
                }

                console.log('[shape buildSessionStateAtomBridge] fetched initial tasks', {
                    nodeId: nodeIdText,
                    taskCount: tasks.length,
                    tasks: tasks.slice(0, 3) // Log first 3 tasks for debugging
                });

                const snapshotEvent = toSnapshotEvent(tasks);
                console.log('[shape buildSessionStateAtomBridge] created snapshot event', {
                    nodeId: nodeIdText,
                    snapshotEvent
                });

                onTaskEvent(snapshotEvent);

                unsubscribers.push(unsubscribeTasks, unsubscribeProgress, unsubscribeSessionState, unsubscribeHeartbeat);
            } catch (error) {
                if (cancelled) return;
                console.warn('[shape buildSessionStateAtomBridge] failed to establish channels', error);
                // Dispatch error to SSOT state tree instead of local state
                dispatch({
                    type: 'channelError',
                    payload: {
                        error: error instanceof Error ? error : new Error(String(error))
                    }
                } as any);
            }
        };

        // Start channel establishment synchronously
        void establishChannels();

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
            for (const unsubscribe of unsubscribers) {
                unsubscribe();
            }
        };
    }, [dispatch, nodeId]);
};