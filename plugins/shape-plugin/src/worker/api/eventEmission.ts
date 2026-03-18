/**
 * Event Emission
 *
 * Emits the 4 canonical Worker→UI events defined in
 * docs/build-session-worker-ui-event-spec.md:
 *   sessionStatusUpdated, stageSnapshotUpdated, taskProgressUpdated, heartbeat
 *
 * taskProgressUpdated and heartbeat are plugin-agnostic and are re-exported
 * from @hierarchidb/build-runtime-services.
 * sessionStatusUpdated and stageSnapshotUpdated depend on shape-plugin-specific
 * types (ShapeBuildSessionRecord, VtTaskQueueDb) and remain here.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import type {
    SessionPhase,
    SessionStatusUpdatedEvent,
    StageSnapshotUpdatedEvent,
} from '~/common/types/session-events';
import { VtTaskQueueDb, listTasksByStage } from '@hierarchidb/vt-orchestrator';
import { unconditionalEventStreamer } from './eventBuffering.js';
import { mapTaskQueueRecordToTaskSummary } from './taskSummaryMapping.js';

export {
    emitTaskProgressUpdated,
    emitHeartbeat,
} from '@hierarchidb/build-runtime-services';

/**
 * Maps ShapeBuildSessionRecord status to the canonical SessionPhase.
 * Unknown values throw immediately — no fallback.
 */
export const mapStatusToSessionPhase = (
    status: ShapeBuildSessionRecord['status'],
): SessionPhase => {
    switch (status) {
        case 'idle': return 'idle';
        case 'running': return 'running';
        case 'paused': return 'paused';
        case 'completed': return 'completed';
        case 'failed': return 'failed';
        default: {
            const _exhaustive: never = status;
            throw new Error(`[eventEmission] unknown session status: ${String(_exhaustive)}`);
        }
    }
};

/**
 * Emits sessionStatusUpdated.
 * Called whenever the session lifecycle phase changes.
 */
export const emitSessionStatusUpdated = (
    nodeId: NodeId,
    sessionRecord: ShapeBuildSessionRecord,
): void => {
    const phase = mapStatusToSessionPhase(sessionRecord.status);
    const event: SessionStatusUpdatedEvent = {
        type: 'sessionStatusUpdated',
        payload: {
            nodeId,
            phase,
            isActive: sessionRecord.status === 'running',
            startedAt: sessionRecord.startedAt,
            completedAt: sessionRecord.completedAt,
            stopReason: sessionRecord.stopReason,
            stageId: sessionRecord.stageId,
            inactiveMs: sessionRecord.inactiveMs,
            stageStartedAt: sessionRecord.stageStartedAt,
            stageInactiveMs: sessionRecord.stageInactiveMs,
        },
    };
    unconditionalEventStreamer.emitEvent(nodeId, 'session-state', event);
};

/**
 * Emits stageSnapshotUpdated for a stage that has already started.
 * Must NOT be called for stages that have not yet started (stageStartedAt required).
 */
export const emitStageSnapshotUpdated = async (
    nodeId: NodeId,
    stage: TaskQueueRecord['stage'],
    stageStartedAt: number,
    stageInactiveMs: number,
    stageCompletedAt?: number,
): Promise<void> => {
    if (!Number.isFinite(stageStartedAt)) {
        throw new Error(`[eventEmission] stageStartedAt must be finite, received ${String(stageStartedAt)}`);
    }
    if (!Number.isFinite(stageInactiveMs)) {
        throw new Error(`[eventEmission] stageInactiveMs must be finite, received ${String(stageInactiveMs)}`);
    }
    const taskQueue = new VtTaskQueueDb();
    const rawTasks = await listTasksByStage(taskQueue, nodeId, stage);
    const tasks = rawTasks.map((task) => mapTaskQueueRecordToTaskSummary(task));

    const event: StageSnapshotUpdatedEvent = {
        type: 'stageSnapshotUpdated',
        payload: {
            stageId: stage,
            tasks,
            stageStartedAt,
            stageInactiveMs,
            stageCompletedAt,
        },
    };
    unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', event);
};
