import type { SessionStatusUpdatedEvent } from '@hierarchidb/build-api';
import { validateSessionStatusUpdatedPayload } from './canonicalSessionEventValidatorsUtils.js';
import { unconditionalEventStreamer } from './eventStreamer.js';

export const emitSessionStatusUpdated = (payload: SessionStatusUpdatedEvent['payload']): void => {
  validateSessionStatusUpdatedPayload(payload);
  const event: SessionStatusUpdatedEvent = {
    type: 'sessionStatusUpdated',
    payload,
  };
  unconditionalEventStreamer.emitEvent(payload.nodeId, 'session-state', event);
};
