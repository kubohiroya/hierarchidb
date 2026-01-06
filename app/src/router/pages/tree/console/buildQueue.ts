import type { TreeId } from '@hierarchidb/common-types';

type BuildQueueState = {
  returnTo: string;
  urls: string[];
  createdAt: number;
  treeId?: TreeId | string;
};

const STORAGE_PREFIX = 'hdb.buildQueue.';

const hasSessionStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

const safeParse = (raw: string | null): BuildQueueState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BuildQueueState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.urls)) return null;
    if (typeof parsed.returnTo !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
};

const buildStorageKey = (key: string): string => `${STORAGE_PREFIX}${key}`;

const createQueueKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `queue-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createBuildQueueKey = (): string => createQueueKey();

export const createBuildQueue = (
  urls: string[],
  returnTo: string,
  treeId?: TreeId,
  key?: string
): string | null => {
  if (!hasSessionStorage()) return null;
  if (!Array.isArray(urls) || urls.length === 0) return null;
  const queueKey = key ?? createQueueKey();
  const payload: BuildQueueState = {
    returnTo,
    urls,
    createdAt: Date.now(),
    treeId,
  };
  window.sessionStorage.setItem(buildStorageKey(queueKey), JSON.stringify(payload));
  return queueKey;
};

export const shiftBuildQueue = (key: string): { nextUrl?: string; returnTo?: string; remaining: number } | null => {
  if (!hasSessionStorage()) return null;
  const storageKey = buildStorageKey(key);
  const state = safeParse(window.sessionStorage.getItem(storageKey));
  if (!state) {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
  const [nextUrl, ...rest] = state.urls;
  if (!nextUrl) {
    window.sessionStorage.removeItem(storageKey);
    return { returnTo: state.returnTo, remaining: 0 };
  }
  const remaining = rest.length;
  if (remaining === 0) {
    window.sessionStorage.removeItem(storageKey);
  } else {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({ ...state, urls: rest })
    );
  }
  return { nextUrl, returnTo: state.returnTo, remaining };
};

export const clearBuildQueue = (key: string): void => {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(buildStorageKey(key));
};
