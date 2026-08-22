import type { NodeId } from '@hierarchidb/core-types';

type BuildSessionBroadcastPayload = {
  nodeId?: NodeId;
  status?: string;
};

type BuildSessionBroadcastMessage = {
  sourceId: string;
  type: string;
  payload?: BuildSessionBroadcastPayload;
  updatedAt: number;
  nodeId?: NodeId;
  status?: string;
};

type RuntimeBroadcastChannel<TPayload = unknown> = {
  publish: (message: { type: string; payload?: TPayload }) => void;
  subscribe: (handler: (message: BuildSessionBroadcastMessage) => void) => () => void;
};

const createSourceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const now = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2);
  return `${now}-${rand}`;
};

const createRuntimeBroadcastChannel = <TPayload = unknown>(
  channelName: string
): RuntimeBroadcastChannel<TPayload> => {
  const sourceId = createSourceId();
  let channel: BroadcastChannel | null = null;

  const getChannel = (): BroadcastChannel | null => {
    if (channel) return channel;
    if (typeof BroadcastChannel !== 'function') return null;
    channel = new BroadcastChannel(channelName);
    return channel;
  };

  return {
    publish: (message) => {
      const bc = getChannel();
      if (!bc) return;
      try {
        bc.postMessage({
          sourceId,
          type: message.type,
          payload: message.payload,
          updatedAt: Date.now(),
        });
      } catch {
        // ignore broadcast failures
      }
    },
    subscribe: (handler) => {
      const bc = getChannel();
      if (!bc) return () => {};
      const onMessage = (event: MessageEvent) => {
        const data = event.data as BuildSessionBroadcastMessage | undefined;
        if (!data || data.sourceId === sourceId) return;
        handler(data);
      };
      bc.addEventListener('message', onMessage);
      return () => {
        bc.removeEventListener('message', onMessage);
      };
    },
  };
};

const broadcastChannel = createRuntimeBroadcastChannel<BuildSessionBroadcastPayload>(
  'hdb:runtime-worker:build-sessions'
);

export const publishBuildSessionUpdate = (payload?: { nodeId?: NodeId; status?: string }): void => {
  broadcastChannel.publish({
    type: 'build-session-update',
    payload,
  });
};

export const subscribeToBuildSessionBroadcast = (
  handler: (message: BuildSessionBroadcastMessage) => void
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
