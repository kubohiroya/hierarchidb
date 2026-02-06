import type { NodeId } from '@hierarchidb/core-types';

type BuildSessionBroadcastMessage = {
  sourceId: string;
  nodeId?: NodeId;
  status?: string;
  updatedAt: number;
};

const channelName = 'hierarchidb:shape-build-sessions:v1';
const sourceId = `build-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let channel: BroadcastChannel | null = null;

const getChannel = (): BroadcastChannel | null => {
  if (channel) return channel;
  if (typeof BroadcastChannel !== 'function') return null;
  channel = new BroadcastChannel(channelName);
  return channel;
};

export const publishBuildSessionUpdate = (payload?: {
  nodeId?: NodeId;
  status?: string;
}): void => {
  const bc = getChannel();
  if (!bc) return;
  try {
    bc.postMessage({
      sourceId,
      updatedAt: Date.now(),
      ...payload,
    } satisfies BuildSessionBroadcastMessage);
  } catch {
    // Ignore broadcast failures.
  }
};

export const subscribeToBuildSessionBroadcast = (
  handler: (message: BuildSessionBroadcastMessage) => void,
): (() => void) => {
  const bc = getChannel();
  if (!bc) return () => {};
  const onMessage = (event: MessageEvent) => {
    const data = event.data as BuildSessionBroadcastMessage | undefined;
    if (!data) return;
    if (data.sourceId === sourceId) return;
    handler(data);
  };
  bc.addEventListener('message', onMessage);
  return () => {
    bc.removeEventListener('message', onMessage);
  };
};
