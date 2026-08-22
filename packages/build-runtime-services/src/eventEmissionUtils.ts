/**
 * Plugin-agnostic event emission helpers for the 4 canonical Worker→UI events.
 * Defined in docs/build-session-worker-ui-event-spec.md.
 *
 * Session and stage emitters are defined alongside these helpers and consume
 * the canonical payload types directly. Shape-specific persistence adapters
 * remain responsible for constructing those payloads.
 */

import type { HeartbeatEvent, TaskProgressUpdatedEvent } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { requireNonEmptyString } from './canonicalSessionEventValidatorsUtils.js';
import { unconditionalEventStreamer } from './eventStreamer.js';

/**
 * Emits taskProgressUpdated for a single task's progress value.
 * value must be finite and in [0, 100] — violation throws.
 * version must be a finite positive integer — violation throws.
 */
export const emitTaskProgressUpdated = (
  nodeId: NodeId,
  taskId: string,
  version: number,
  stageId: string,
  value: number,
  message?: string,
  metadata?: Record<string, unknown>
): void => {
  requireNonEmptyString(nodeId, 'nodeId');
  requireNonEmptyString(taskId, 'taskId');
  requireNonEmptyString(stageId, 'stageId');
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(
      `[eventEmission] taskProgressUpdated value must be finite 0..100, received ${String(value)}`
    );
  }
  if (!Number.isFinite(version) || version < 1 || !Number.isInteger(version)) {
    throw new Error(
      `[eventEmission] taskProgressUpdated version must be a finite positive integer, received ${String(version)}`
    );
  }
  const event: TaskProgressUpdatedEvent = {
    type: 'taskProgressUpdated',
    payload: { taskId, version, stageId, value, message, metadata },
  };
  unconditionalEventStreamer.emitEvent(nodeId, 'task-progress', event);
};

/**
 * Emits heartbeat. heartbeatAt must be finite — violation throws.
 */
export const emitHeartbeat = (nodeId: NodeId, heartbeatAt: number): void => {
  requireNonEmptyString(nodeId, 'nodeId');
  if (!Number.isFinite(heartbeatAt)) {
    throw new Error(`[eventEmission] heartbeatAt must be finite, received ${String(heartbeatAt)}`);
  }
  const event: HeartbeatEvent = {
    type: 'heartbeat',
    payload: { nodeId, heartbeatAt },
  };
  unconditionalEventStreamer.emitHeartbeat(nodeId, event);
};
