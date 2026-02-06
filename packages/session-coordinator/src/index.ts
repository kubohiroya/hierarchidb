import { Dexie } from 'dexie';

export type SessionTabState = 'active' | 'hidden' | 'frozen';

export type SessionChannelMessage<TStatus = unknown, TProgress = unknown> =
  | {
      type: 'broadcast';
      sessionId: string;
      tabId: string;
      timestamp: number;
      status?: TStatus | null;
      progress?: TProgress | null;
    }
  | {
      type: 'poll';
      sessionId: string;
      tabId: string;
      timestamp: number;
    }
  | {
      type: 'tab-state';
      sessionId: string;
      tabId: string;
      timestamp: number;
      tabState: SessionTabState;
    }
  | {
      type: 'ack';
      sessionId: string;
      tabId: string;
      receivedTabId: string;
      timestamp: number;
    };

export type SessionStorageKeys = {
  tabIdKey: string;
  activeSessionKey: string;
  broadcastAtKey: string;
};

export type SessionCoordinatorOptions = {
  channelName?: string;
  pollIntervalTimeout?: number;
  quietThresholdTimeout?: number;
  semaphoreTtlTimeout?: number;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  storageKeys?: Partial<SessionStorageKeys>;
  now?: () => number;
  semaphoreDbName?: string;
};

export type SessionPollingTracker = {
  record: (tabId: string, timestamp?: number) => void;
  candidates: (referenceTime?: number) => string[];
  prune: (referenceTime?: number) => void;
};

export type SessionCoordinator = {
  channelName: string;
  pollIntervalTimeout: number;
  quietThresholdTimeout: number;
  semaphoreTtlTimeout: number;
  getTabId: () => string;
  readActiveSessionId: () => string | null;
  writeActiveSessionId: (sessionId: string) => void;
  clearActiveSessionId: (sessionId: string) => void;
  readBroadcastAt: () => number | null;
  writeBroadcastAt: (timestamp: number) => void;
  isRunnerTab: (referenceTime?: number) => boolean;
  openChannel: () => BroadcastChannel;
  isSessionChannelMessage: (value: unknown) => value is SessionChannelMessage;
  sendPoll: (channel: BroadcastChannel, sessionId: string, timestamp?: number) => void;
  sendBroadcast: <TStatus = unknown, TProgress = unknown>(
    channel: BroadcastChannel,
    sessionId: string,
    status: TStatus | null,
    progress: TProgress | null,
    timestamp?: number,
  ) => void;
  sendTabState: (
    channel: BroadcastChannel,
    sessionId: string,
    tabState: SessionTabState,
    timestamp?: number,
  ) => void;
  sendAck: (channel: BroadcastChannel, sessionId: string, receivedTabId: string, timestamp?: number) => void;
  tryAcquireSemaphore: (key: string, ownerId: string, ttlMs?: number) => Promise<boolean>;
};

type SessionSemaphoreRecord = {
  key: string;
  ownerId: string;
  acquiredAt: number;
  expiresAt: number;
};

const DEFAULT_KEYS: SessionStorageKeys = {
  tabIdKey: 'hdb:session-tab-id',
  activeSessionKey: 'hdb:active-build-session',
  broadcastAtKey: 'hdb:session-broadcast-at',
};

const createSessionTabId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const now = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2);
  return `${now}-${rand}`;
};

const createMemoryStorage = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> => {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
};

const resolveStorage = (
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined,
) => {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // ignore
  }
  return createMemoryStorage();
};

const semaphoreDbCache = new Map<string, Dexie>();

const getSemaphoreDb = (dbName: string) => {
  const existing = semaphoreDbCache.get(dbName);
  if (existing) return existing;
  const db = new Dexie(dbName);
  db.version(1).stores({
    semaphores: '&key, ownerId, expiresAt',
  });
  semaphoreDbCache.set(dbName, db);
  return db;
};

export const createPollingTracker = ({
  quietThresholdTimeout,
  now,
}: {
  quietThresholdTimeout: number;
  now?: () => number;
}): SessionPollingTracker => {
  const lastSeen = new Map<string, number>();
  const nowFn = now ?? Date.now;
  const record = (tabId: string, timestamp?: number) => {
    lastSeen.set(tabId, timestamp ?? nowFn());
  };
  const prune = (referenceTime?: number) => {
    const snapshot = referenceTime ?? nowFn();
    for (const [tabId, seenAt] of lastSeen.entries()) {
      if (snapshot - seenAt > quietThresholdTimeout) {
        lastSeen.delete(tabId);
      }
    }
  };
  const candidates = (referenceTime?: number) => {
    const snapshot = referenceTime ?? nowFn();
    return [...lastSeen.entries()]
      .filter(([, seenAt]) => snapshot - seenAt <= quietThresholdTimeout)
      .map(([tabId]) => tabId)
      .sort();
  };
  return { record, candidates, prune };
};

export const createSessionCoordinator = (options: SessionCoordinatorOptions = {}): SessionCoordinator => {
  const channelName = options.channelName ?? 'sessions';
  const pollIntervalTimeout = options.pollIntervalTimeout ?? 3000;
  const quietThresholdTimeout = options.quietThresholdTimeout ?? 5000;
  const semaphoreTtlTimeout = options.semaphoreTtlTimeout ?? 10000;
  const nowFn = options.now ?? Date.now;
  const keys: SessionStorageKeys = {
    ...DEFAULT_KEYS,
    ...(options.storageKeys ?? {}),
  };
  const storage = resolveStorage(options.storage);
  const semaphoreDbName = options.semaphoreDbName ?? 'hdb-session-semaphore';

  const getTabId = () => {
    try {
      const existing = storage.getItem(keys.tabIdKey);
      if (existing) return existing;
      const next = createSessionTabId();
      storage.setItem(keys.tabIdKey, next);
      return next;
    } catch {
      return createSessionTabId();
    }
  };

  const readActiveSessionId = () => {
    try {
      return storage.getItem(keys.activeSessionKey);
    } catch {
      return null;
    }
  };

  const writeActiveSessionId = (sessionId: string) => {
    try {
      storage.setItem(keys.activeSessionKey, sessionId);
    } catch {
      // ignore
    }
  };

  const clearActiveSessionId = (sessionId: string) => {
    try {
      if (storage.getItem(keys.activeSessionKey) === sessionId) {
        storage.removeItem(keys.activeSessionKey);
      }
    } catch {
      // ignore
    }
  };

  const readBroadcastAt = () => {
    try {
      const value = storage.getItem(keys.broadcastAtKey);
      if (!value) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const writeBroadcastAt = (timestamp: number) => {
    try {
      storage.setItem(keys.broadcastAtKey, String(timestamp));
    } catch {
      // ignore
    }
  };

  const isRunnerTab = (referenceTime?: number) => {
    const snapshot = referenceTime ?? nowFn();
    const broadcastAt = readBroadcastAt();
    return Boolean(broadcastAt && snapshot - broadcastAt <= quietThresholdTimeout);
  };

  const isSessionChannelMessage = (value: unknown): value is SessionChannelMessage => {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    const type = record.type;
    if (type !== 'broadcast' && type !== 'poll' && type !== 'ack' && type !== 'tab-state') return false;
    if (typeof record.sessionId !== 'string' || typeof record.tabId !== 'string') return false;
    if (typeof record.timestamp !== 'number') return false;
    if (type === 'ack') {
      return typeof record.receivedTabId === 'string';
    }
    if (type === 'tab-state') {
      return record.tabState === 'active' || record.tabState === 'hidden' || record.tabState === 'frozen';
    }
    return true;
  };

  const openChannel = () => new BroadcastChannel(channelName);

  const sendPoll = (channel: BroadcastChannel, sessionId: string, timestamp = nowFn()) => {
    channel.postMessage({
      type: 'poll',
      sessionId,
      tabId: getTabId(),
      timestamp,
    } satisfies SessionChannelMessage);
  };

  const sendBroadcast = <TStatus = unknown, TProgress = unknown>(
    channel: BroadcastChannel,
    sessionId: string,
    status: TStatus | null,
    progress: TProgress | null,
    timestamp = nowFn(),
  ) => {
    channel.postMessage({
      type: 'broadcast',
      sessionId,
      tabId: getTabId(),
      timestamp,
      status,
      progress,
    } satisfies SessionChannelMessage<TStatus, TProgress>);
  };

  const sendTabState = (
    channel: BroadcastChannel,
    sessionId: string,
    tabState: SessionTabState,
    timestamp = nowFn(),
  ) => {
    channel.postMessage({
      type: 'tab-state',
      sessionId,
      tabId: getTabId(),
      timestamp,
      tabState,
    } satisfies SessionChannelMessage);
  };

  const sendAck = (channel: BroadcastChannel, sessionId: string, receivedTabId: string, timestamp = nowFn()) => {
    channel.postMessage({
      type: 'ack',
      sessionId,
      tabId: getTabId(),
      receivedTabId,
      timestamp,
    } satisfies SessionChannelMessage);
  };

  const tryAcquireSemaphore = async (key: string, ownerId: string, ttlMs?: number) => {
    const now = nowFn();
    const db = getSemaphoreDb(semaphoreDbName);
    const table = db.table<SessionSemaphoreRecord, string>('semaphores');
    try {
      return await db.transaction('rw', table, async () => {
        const existing = await table.get(key);
        if (existing && existing.expiresAt > now && existing.ownerId !== ownerId) {
          return false;
        }
        await table.put({
          key,
          ownerId,
          acquiredAt: now,
          expiresAt: now + (ttlMs ?? semaphoreTtlTimeout),
        });
        return true;
      });
    } catch (error) {
      console.warn('[session-coordinator] failed to acquire session semaphore', error);
      return false;
    }
  };

  return {
    channelName,
    pollIntervalTimeout,
    quietThresholdTimeout,
    semaphoreTtlTimeout,
    getTabId,
    readActiveSessionId,
    writeActiveSessionId,
    clearActiveSessionId,
    readBroadcastAt,
    writeBroadcastAt,
    isRunnerTab,
    openChannel,
    isSessionChannelMessage,
    sendPoll,
    sendBroadcast,
    sendTabState,
    sendAck,
    tryAcquireSemaphore,
  };
};
