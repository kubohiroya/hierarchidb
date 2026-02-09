import { Dexie } from 'dexie';
export type { SessionBroadcastChannel, SessionBroadcastMessage } from './broadcast.js';
export { createSessionBroadcastChannel } from './broadcast.js';

export type SessionTabState = 'active' | 'hidden' | 'frozen';
export type SessionChannelType = 'broadcast' | 'poll' | 'ack' | 'tab-state';
export type SessionChannelMessage<TStatus = unknown, TProgress = unknown> = {
  type: SessionChannelType;
  sessionId: string;
  tabId: string;
  status?: TStatus | null;
  progress?: TProgress | null;
  receivedTabId?: string;
  tabState?: SessionTabState;
  updatedAt?: number;
};

export type HeartbeatRecord<TStatus = unknown, TProgress = unknown> = {
  sessionId: string;
  tabId: string;
  updatedAt: number;
  expiresAt: number;
  status?: TStatus | null;
  progress?: TProgress | null;
  tabState?: SessionTabState;
  lockOwner?: boolean;
};

export type HeartbeatPayload<TStatus = unknown, TProgress = unknown> = {
  sessionId: string;
  status?: TStatus | null;
  progress?: TProgress | null;
  tabState?: SessionTabState;
  lockOwner?: boolean;
  timestamp?: number;
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
  openChannel: () => BroadcastChannel;
  sendBroadcast: <TStatus = unknown, TProgress = unknown>(
    channel: BroadcastChannel,
    sessionId: string,
    status: TStatus | null,
    progress: TProgress | null,
    timestamp?: number,
  ) => void;
  sendPoll: (channel: BroadcastChannel, sessionId: string, timestamp?: number) => void;
  sendAck: (channel: BroadcastChannel, sessionId: string, receivedTabId: string, timestamp?: number) => void;
  sendTabState: (
    channel: BroadcastChannel,
    sessionId: string,
    tabState: SessionTabState,
    timestamp?: number,
  ) => void;
  isSessionChannelMessage: (message: unknown) => message is SessionChannelMessage;
  isRunnerTab: (referenceTime?: number) => boolean;
  tryAcquireSemaphore: (key: string, ownerId: string, ttlMs?: number) => Promise<boolean>;
  tryAcquireSessionLock: (key: string) => Promise<SessionLockHandle | null>;
  isWebLockSupported: () => boolean;
  probeSessionLock: (key: string) => Promise<'held' | 'free' | 'unsupported'>;
  writeHeartbeat: <TStatus = unknown, TProgress = unknown>(payload: HeartbeatPayload<TStatus, TProgress>) => Promise<void>;
  readHeartbeat: <TStatus = unknown, TProgress = unknown>(
    sessionId: string,
  ) => Promise<HeartbeatRecord<TStatus, TProgress> | null>;
  readHeartbeats: <TStatus = unknown, TProgress = unknown>(
    sessionId?: string,
  ) => Promise<HeartbeatRecord<TStatus, TProgress>[]>;
  pruneHeartbeats: (referenceTime?: number) => Promise<void>;
  removeHeartbeat: (sessionId: string) => Promise<void>;
};

type SessionSemaphoreRecord = {
  key: string;
  ownerId: string;
  acquiredAt: number;
  expiresAt: number;
};

export type SessionLockHandle = {
  release: () => void;
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
  db.version(2).stores({
    semaphores: '&key, ownerId, expiresAt',
    heartbeats: '&sessionId, updatedAt, expiresAt, tabId',
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

const resolveChannelName = (channelName?: string): string => {
  const base = channelName && channelName.trim().length > 0 ? channelName.trim() : 'sessions';
  return `hdb:session-coordinator:${base}`;
};

const SESSION_CHANNEL_TYPES: SessionChannelType[] = ['broadcast', 'poll', 'ack', 'tab-state'];

const isSessionChannelMessage = (message: unknown): message is SessionChannelMessage => {
  if (!message || typeof message !== 'object') return false;
  const record = message as Record<string, unknown>;
  if (!SESSION_CHANNEL_TYPES.includes(record.type as SessionChannelType)) return false;
  if (typeof record.sessionId !== 'string') return false;
  if (typeof record.tabId !== 'string') return false;
  if (record.type === 'ack' && typeof record.receivedTabId !== 'string') return false;
  if (record.type === 'tab-state') {
    const state = record.tabState;
    if (state !== 'active' && state !== 'hidden' && state !== 'frozen') return false;
  }
  return true;
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

  const openChannel = () => {
    const resolved = resolveChannelName(channelName);
    return new BroadcastChannel(resolved);
  };

  const publish = <TStatus, TProgress>(
    channel: BroadcastChannel,
    message: SessionChannelMessage<TStatus, TProgress>,
  ) => {
    try {
      channel.postMessage(message);
    } catch {
      // ignore broadcast failures
    }
  };

  const sendBroadcast = <TStatus = unknown, TProgress = unknown>(
    channel: BroadcastChannel,
    sessionId: string,
    status: TStatus | null,
    progress: TProgress | null,
    timestamp?: number,
  ) => {
    publish(channel, {
      type: 'broadcast',
      sessionId,
      tabId: getTabId(),
      status,
      progress,
      updatedAt: timestamp ?? nowFn(),
    });
  };

  const sendPoll = (channel: BroadcastChannel, sessionId: string, timestamp?: number) => {
    publish(channel, {
      type: 'poll',
      sessionId,
      tabId: getTabId(),
      updatedAt: timestamp ?? nowFn(),
    });
  };

  const sendAck = (channel: BroadcastChannel, sessionId: string, receivedTabId: string, timestamp?: number) => {
    publish(channel, {
      type: 'ack',
      sessionId,
      tabId: getTabId(),
      receivedTabId,
      updatedAt: timestamp ?? nowFn(),
    });
  };

  const sendTabState = (
    channel: BroadcastChannel,
    sessionId: string,
    tabState: SessionTabState,
    timestamp?: number,
  ) => {
    publish(channel, {
      type: 'tab-state',
      sessionId,
      tabId: getTabId(),
      tabState,
      updatedAt: timestamp ?? nowFn(),
    });
  };

  const isRunnerTab = (referenceTime?: number) => {
    const snapshot = referenceTime ?? nowFn();
    const broadcastAt = readBroadcastAt();
    return Boolean(broadcastAt && snapshot - broadcastAt <= quietThresholdTimeout);
  };

  const isWebLockSupported = () => (
    typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function'
  );

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

  const tryAcquireSessionLock = async (key: string): Promise<SessionLockHandle | null> => {
    if (!isWebLockSupported()) {
      console.warn('[session-coordinator] Web Locks API is unavailable');
      return null;
    }
    return new Promise<SessionLockHandle | null>((resolve) => {
      let released = false;
      let resolveRelease: (() => void) | null = null;
      const releasePromise = new Promise<void>((release) => {
        resolveRelease = release;
      });
      const release = () => {
        if (released) return;
        released = true;
        resolveRelease?.();
      };
      navigator.locks.request(
        key,
        { ifAvailable: true, mode: 'exclusive' },
        (lock) => {
          if (!lock) {
            resolve(null);
            return;
          }
          resolve({ release });
          return releasePromise;
        },
      ).catch((error) => {
        console.warn('[session-coordinator] failed to acquire session lock', error);
        resolve(null);
      });
    });
  };

  const probeSessionLock = async (key: string): Promise<'held' | 'free' | 'unsupported'> => {
    if (!isWebLockSupported()) return 'unsupported';
    return new Promise<'held' | 'free'>((resolve) => {
      let resolved = false;
      navigator.locks.request(
        key,
        { ifAvailable: true, mode: 'exclusive' },
        (lock) => {
          if (!lock) {
            resolved = true;
            resolve('held');
            return;
          }
          resolved = true;
          resolve('free');
          return undefined;
        },
      ).catch((error) => {
        console.warn('[session-coordinator] failed to probe session lock', error);
        if (!resolved) {
          resolve('held');
        }
      });
    });
  };

  const writeHeartbeat = async <TStatus = unknown, TProgress = unknown>(
    payload: HeartbeatPayload<TStatus, TProgress>,
  ): Promise<void> => {
    const db = getSemaphoreDb(semaphoreDbName);
    const table = db.table<HeartbeatRecord<TStatus, TProgress>, string>('heartbeats');
    const now = payload.timestamp ?? nowFn();
    const expiresAt = now + quietThresholdTimeout + pollIntervalTimeout * 2;
    try {
      const existing = await table.get(payload.sessionId);
      const next: HeartbeatRecord<TStatus, TProgress> = {
        sessionId: payload.sessionId,
        tabId: getTabId(),
        updatedAt: now,
        expiresAt,
        status: payload.status !== undefined ? payload.status : existing?.status,
        progress: payload.progress !== undefined ? payload.progress : existing?.progress,
        tabState: payload.tabState ?? existing?.tabState,
        lockOwner: payload.lockOwner ?? existing?.lockOwner,
      };
      await table.put(next);
      writeBroadcastAt(now);
    } catch (error) {
      console.warn('[session-coordinator] failed to write heartbeat', error);
    }
  };

  const readHeartbeat = async <TStatus = unknown, TProgress = unknown>(
    sessionId: string,
  ): Promise<HeartbeatRecord<TStatus, TProgress> | null> => {
    const db = getSemaphoreDb(semaphoreDbName);
    const table = db.table<HeartbeatRecord<TStatus, TProgress>, string>('heartbeats');
    try {
      return await table.get(sessionId) ?? null;
    } catch (error) {
      console.warn('[session-coordinator] failed to read heartbeat', error);
      return null;
    }
  };

  const readHeartbeats = async <TStatus = unknown, TProgress = unknown>(
    sessionId?: string,
  ): Promise<HeartbeatRecord<TStatus, TProgress>[]> => {
    const db = getSemaphoreDb(semaphoreDbName);
    const table = db.table<HeartbeatRecord<TStatus, TProgress>, string>('heartbeats');
    try {
      if (sessionId) {
        const record = await table.get(sessionId);
        return record ? [record] : [];
      }
      return await table.toArray();
    } catch (error) {
      console.warn('[session-coordinator] failed to read heartbeats', error);
      return [];
    }
  };

  const pruneHeartbeats = async (referenceTime?: number): Promise<void> => {
    const db = getSemaphoreDb(semaphoreDbName);
    const table = db.table<HeartbeatRecord, string>('heartbeats');
    const now = referenceTime ?? nowFn();
    try {
      await table.where('expiresAt').belowOrEqual(now).delete();
    } catch (error) {
      console.warn('[session-coordinator] failed to prune heartbeats', error);
    }
  };

  const removeHeartbeat = async (sessionId: string): Promise<void> => {
    const db = getSemaphoreDb(semaphoreDbName);
    const table = db.table<HeartbeatRecord, string>('heartbeats');
    try {
      await table.delete(sessionId);
    } catch (error) {
      console.warn('[session-coordinator] failed to remove heartbeat', error);
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
    openChannel,
    sendBroadcast,
    sendPoll,
    sendAck,
    sendTabState,
    isSessionChannelMessage,
    isRunnerTab,
    tryAcquireSemaphore,
    tryAcquireSessionLock,
    isWebLockSupported,
    probeSessionLock,
    writeHeartbeat,
    readHeartbeat,
    readHeartbeats,
    pruneHeartbeats,
    removeHeartbeat,
  };
};
