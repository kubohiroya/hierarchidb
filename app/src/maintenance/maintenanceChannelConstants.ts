import { shutdownRuntimeHandles } from './runtimeShutdown.js';

const MAINTENANCE_CHANNEL_NAME = 'hdb:maintenance:channel:v1';

type ShutdownRequestMessage = {
  type: 'shutdown-request';
  sessionId: string;
  requestedAt: number;
};

type MaintenanceChannelMessage = ShutdownRequestMessage;

let initialized = false;
let persistentChannel: BroadcastChannel | null = null;

const isBrowser = () => typeof window !== 'undefined';

const isShutdownRequestMessage = (value: unknown): value is ShutdownRequestMessage => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ShutdownRequestMessage>;
  return (
    candidate.type === 'shutdown-request' &&
    typeof candidate.sessionId === 'string' &&
    typeof candidate.requestedAt === 'number'
  );
};

export const broadcastMaintenanceShutdownRequest = (sessionId: string): void => {
  if (!isBrowser() || typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(MAINTENANCE_CHANNEL_NAME);
  const payload: MaintenanceChannelMessage = {
    type: 'shutdown-request',
    sessionId,
    requestedAt: Date.now(),
  };
  channel.postMessage(payload);
  channel.close();
};

export const initializeMaintenanceChannel = (): void => {
  if (!isBrowser() || typeof BroadcastChannel === 'undefined' || initialized) {
    return;
  }
  initialized = true;
  persistentChannel = new BroadcastChannel(MAINTENANCE_CHANNEL_NAME);
  persistentChannel.onmessage = (event: MessageEvent<unknown>) => {
    const payload = event.data;
    if (!isShutdownRequestMessage(payload)) return;
    void shutdownRuntimeHandles().catch((error) => {
      if (import.meta.env.DEV) {
        console.warn('[maintenance-channel] shutdown request failed', error);
      }
    });
  };
};

export const getMaintenanceChannelName = (): string => MAINTENANCE_CHANNEL_NAME;
