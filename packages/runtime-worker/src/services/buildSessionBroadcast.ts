import type { NodeId } from '@hierarchidb/core-types';
import {
  createSessionBroadcastChannel,
  type SessionBroadcastMessage,
} from '@hierarchidb/session-coordinator';

type BuildSessionBroadcastPayload = {
  nodeId?: NodeId;
  status?: string;
};

type BuildSessionBroadcastMessage = SessionBroadcastMessage<BuildSessionBroadcastPayload> &
  BuildSessionBroadcastPayload;

const broadcastChannel = createSessionBroadcastChannel<BuildSessionBroadcastPayload>({
  channelName: 'build-sessions',
});

export const publishBuildSessionUpdate = (payload?: {
  nodeId?: NodeId;
  status?: string;
}): void => {
  broadcastChannel.publish({
    type: 'build-session-update',
    payload,
  });
};

export const subscribeToBuildSessionBroadcast = (
  handler: (message: BuildSessionBroadcastMessage) => void,
): (() => void) => {
  return broadcastChannel.subscribe((message) => {
    if (message.type !== 'build-session-update') return;
    handler({
      sourceId: message.sourceId,
      updatedAt: message.updatedAt,
      nodeId: message.payload?.nodeId,
      status: message.payload?.status,
      type: message.type,
      payload: message.payload,
    });
  });
};
