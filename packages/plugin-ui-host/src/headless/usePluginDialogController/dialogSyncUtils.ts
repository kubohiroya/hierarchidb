import { loadTreeConsoleSettings, TREE_CONSOLE_SETTINGS_STORAGE_KEY } from '@hierarchidb/util';
import { useEffect, useState } from 'react';

export const SYNC_DEBUG_STORAGE_KEY = 'hdb:dialog-sync-debug';
export const WINDOW_STATE_PERSIST_DEBOUNCE_MS = 250;

export function isSyncDebugActive(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SYNC_DEBUG_STORAGE_KEY) === '1';
}

export function buildDraftSignature(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return `[unserializable:${String(error)}]`;
  }
}

export function logSync(
  label: string,
  payload: { draftData?: string | null; dialogUIState?: string | null }
): void {
  if (!isSyncDebugActive()) return;
  console.debug(`[PluginDialogSync] ${label}`, payload);
}

export const readStoredAutosave = (): boolean => {
  const stored = loadTreeConsoleSettings().autosaveEnabled;
  return typeof stored === 'boolean' ? stored : true;
};

export function useAutosavePreference(explicit?: boolean): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof explicit === 'boolean') return explicit;
    return readStoredAutosave();
  });

  useEffect(() => {
    if (typeof explicit === 'boolean') {
      setEnabled(explicit);
      return undefined;
    }
    setEnabled(readStoredAutosave());
    const global = typeof window !== 'undefined' ? window : null;
    if (!global) return undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== TREE_CONSOLE_SETTINGS_STORAGE_KEY) return;
      setEnabled(readStoredAutosave());
    };
    global.addEventListener('storage', handleStorage);
    return () => {
      global.removeEventListener('storage', handleStorage);
    };
  }, [explicit]);

  return enabled;
}

export const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const pad = (v: number) => `${v}`.padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const reuseNumberArray = <T>(
  prevRef: React.MutableRefObject<ReadonlyArray<T>>,
  next: ReadonlyArray<T>
) => {
  const prev = prevRef.current;
  if (prev === next) return prev;
  if (prev.length === next.length && prev.every((v, i) => v === next[i])) {
    return prev;
  }
  prevRef.current = next;
  return next;
};
