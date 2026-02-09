export type SessionBroadcastMessage<TPayload = unknown> = {
  sourceId: string;
  type: string;
  payload?: TPayload;
  updatedAt: number;
};

export type SessionBroadcastChannel<TPayload = unknown> = {
  channelName: string;
  publish: (message: Omit<SessionBroadcastMessage<TPayload>, 'sourceId' | 'updatedAt'> & {
    sourceId?: string;
    updatedAt?: number;
  }) => void;
  subscribe: (
    handler: (message: SessionBroadcastMessage<TPayload>) => void
  ) => () => void;
  close: () => void;
};

const createSourceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const now = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2);
  return `${now}-${rand}`;
};

const resolveBroadcastChannelName = (channelName?: string): string => {
  const base = channelName && channelName.trim().length > 0 ? channelName.trim() : 'sessions';
  return `hdb:session-coordinator:${base}`;
};

export const createSessionBroadcastChannel = <TPayload = unknown>(options?: {
  channelName?: string;
  now?: () => number;
}): SessionBroadcastChannel<TPayload> => {
  const channelName = resolveBroadcastChannelName(options?.channelName);
  const nowFn = options?.now ?? Date.now;
  const sourceId = createSourceId();
  let channel: BroadcastChannel | null = null;

  const getChannel = () => {
    if (channel) return channel;
    if (typeof BroadcastChannel !== 'function') return null;
    channel = new BroadcastChannel(channelName);
    return channel;
  };

  const publish = (
    message: Omit<SessionBroadcastMessage<TPayload>, 'sourceId' | 'updatedAt'> & {
      sourceId?: string;
      updatedAt?: number;
    }
  ) => {
    const bc = getChannel();
    if (!bc) return;
    try {
      bc.postMessage({
        sourceId: message.sourceId ?? sourceId,
        type: message.type,
        payload: message.payload,
        updatedAt: message.updatedAt ?? nowFn(),
      } satisfies SessionBroadcastMessage<TPayload>);
    } catch {
      // ignore broadcast failures
    }
  };

  const subscribe = (handler: (message: SessionBroadcastMessage<TPayload>) => void) => {
    const bc = getChannel();
    if (!bc) return () => {};
    const onMessage = (event: MessageEvent) => {
      const data = event.data as SessionBroadcastMessage<TPayload> | undefined;
      if (!data) return;
      if (data.sourceId === sourceId) return;
      handler(data);
    };
    bc.addEventListener('message', onMessage);
    return () => {
      bc.removeEventListener('message', onMessage);
    };
  };

  const close = () => {
    channel?.close();
    channel = null;
  };

  return {
    channelName,
    publish,
    subscribe,
    close,
  };
};
