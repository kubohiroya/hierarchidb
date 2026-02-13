const MAINTENANCE_LOCK_STORAGE_KEY = 'hdb:maintenance:lock:v1';
let inMemoryLockRaw: string | null = null;

export interface MaintenanceLockRecord {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}

const isBrowser = () => typeof window !== 'undefined';

const parseLock = (raw: string | null): MaintenanceLockRecord | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MaintenanceLockRecord>;
    if (
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
};

const readRawLock = (): MaintenanceLockRecord | null => {
  if (!isBrowser()) return null;
  try {
    const localValue = window.localStorage.getItem(MAINTENANCE_LOCK_STORAGE_KEY);
    const raw = localValue ?? inMemoryLockRaw;
    return parseLock(raw);
  } catch {
    return parseLock(inMemoryLockRaw);
  }
};

export const getMaintenanceLock = (now = Date.now()): MaintenanceLockRecord | null => {
  const lock = readRawLock();
  if (!lock) return null;
  if (lock.expiresAt <= now) {
    clearMaintenanceLock();
    return null;
  }
  return lock;
};

export const isMaintenanceLockActive = (now = Date.now()): boolean => {
  return getMaintenanceLock(now) !== null;
};

export const setMaintenanceLock = (record: MaintenanceLockRecord): void => {
  const raw = JSON.stringify(record);
  inMemoryLockRaw = raw;
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(MAINTENANCE_LOCK_STORAGE_KEY, raw);
  } catch {
    // best-effort lock; ignore storage failures
  }
};

export const clearMaintenanceLock = (sessionId?: string): void => {
  if (sessionId) {
    const current = readRawLock();
    if (!current || current.sessionId !== sessionId) return;
  }
  inMemoryLockRaw = null;
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(MAINTENANCE_LOCK_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
};

export const getMaintenanceLockStorageKey = (): string => MAINTENANCE_LOCK_STORAGE_KEY;
