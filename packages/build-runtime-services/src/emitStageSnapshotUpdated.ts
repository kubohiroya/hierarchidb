import type { StageSnapshotUpdatedEvent } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import {
  requireNonEmptyString,
  validateStageSnapshotUpdatedPayload,
} from './canonicalSessionEventValidators.js';
import { unconditionalEventStreamer } from './eventStreamer.js';

export const emitStageSnapshotUpdated = (
  nodeId: NodeId,
  payload: StageSnapshotUpdatedEvent['payload']
): void => {
  requireNonEmptyString(nodeId, 'nodeId');
  validateStageSnapshotUpdatedPayload(payload);
  const event: StageSnapshotUpdatedEvent = {
    type: 'stageSnapshotUpdated',
    payload,
  };
  unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', event);
};
