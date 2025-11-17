import { resolveDbPrefix } from '@hierarchidb/util';

type IndexedDBDatabaseInfo = { name?: string | null };
type IndexedDBWithDatabases = IDBFactory & {
  databases?: () => Promise<IndexedDBDatabaseInfo[]>;
};

const DB_SUFFIXES = [
  'basemap-db',
  'basemap-entities-db',
  'cas-db',
  'chunks-db',
  'core-db',
  'ephemeral-db',
  'folder-entities-db',
  'location-entities-db',
  'location-ephemeral-db',
  'resolver-db',
  'resolver-entities-db',
  'route-db',
  'route-entities-db',
  'shape-db',
  'shape-entities-db',
  'shape-ephemeral-db',
  'spreadsheet-db',
  'spreadsheet-entities-db',
  'spreadsheet-metadata-db',
  'stage-tiles-db',
  'styler-entities-db',
  'styler-metadata-db',
  'tabular-source-rowstore-db',
  'timeline-entities-db',
] as const;

const LEGACY_SUFFIXES = [
  'basemap-entities',
  'chunks',
  'folder-entities',
  'location-entities',
  'route-entities',
  'shape-entities',
  'spreadsheet-entities',
  'styler-entities',
  'timeline-entities',
  'resolver-entities',
] as const;

const LEGACY_DIRECT_NAMES = [
  'BasemapDatabase',
  'BaseMapDatabase',
  'BasemapDB',
  'BaseMapDB',
  'HierarchiDB',
  'HierarchiDB_Core',
  'HierarchiDB_Ephemeral',
] as const;

const LEGACY_NAME_SET = new Set(LEGACY_DIRECT_NAMES.map((name) => name.toLowerCase()));

const EXTRA_PREFIXES = ['hidb', 'hdb', 'hierarchidb'];

const sanitizePrefix = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, '-').toLowerCase();
};

const buildPrefixCandidates = (): string[] => {
  const prefixes = new Set<string>();
  const resolved = sanitizePrefix(resolveDbPrefix());
  if (resolved) prefixes.add(resolved);
  EXTRA_PREFIXES.forEach((prefix) => {
    const sanitized = sanitizePrefix(prefix);
    if (sanitized) prefixes.add(sanitized);
  });
  return Array.from(prefixes);
};

const buildFallbackNames = (prefixes: string[]): string[] => {
  const candidates = new Set<string>();
  prefixes.forEach((prefix) => {
    DB_SUFFIXES.forEach((suffix) => candidates.add(`${prefix}-${suffix}`));
    LEGACY_SUFFIXES.forEach((suffix) => candidates.add(`${prefix}-${suffix}`));
  });
  LEGACY_DIRECT_NAMES.forEach((name) => candidates.add(name));
  return Array.from(candidates);
};

const isLikelyAppDatabase = (name: string, prefixes: string[]): boolean => {
  if (!name) return false;
  const normalized = name.toLowerCase();
  if (LEGACY_NAME_SET.has(normalized)) return true;
  return prefixes.some((prefix) => normalized.startsWith(`${prefix}-`));
};

const deleteDatabase = (name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(
        request.error ?? new Error(`Failed to delete IndexedDB database: ${String(name ?? '')}`)
      );
    request.onblocked = () => reject(new Error(`Delete blocked for IndexedDB database ${name}`));
  });

const logClearWarning = (message: string, error?: unknown): void => {
  if (typeof console === 'undefined') return;
  if (error) {
    console.warn(`[services/clearIndexedDb] ${message}`, error);
  } else {
    console.warn(`[services/clearIndexedDb] ${message}`);
  }
};

export interface ClearIndexedDbResult {
  deleted: string[];
  errors: Array<{ name: string; error: unknown }>;
  attempted: string[];
  enumerated: string[];
  usedFallbackList: boolean;
}

export async function clearAppIndexedDBs(): Promise<ClearIndexedDbResult> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment.');
  }

  const prefixCandidates = buildPrefixCandidates();
  const factory = indexedDB as IndexedDBWithDatabases;
  const enumerated: string[] = [];

  if (typeof factory.databases === 'function') {
    try {
      const databases = await factory.databases();
      databases.forEach((entry) => {
        if (!entry?.name) return;
        if (isLikelyAppDatabase(entry.name, prefixCandidates)) {
          enumerated.push(entry.name);
        }
      });
    } catch (error) {
      logClearWarning('Failed to enumerate IndexedDB databases', error);
    }
  }

  const fallbackNames = buildFallbackNames(prefixCandidates);
  const targetNames = enumerated.length > 0 ? enumerated : fallbackNames;
  const uniqueTargets = Array.from(new Set(targetNames.filter(Boolean)));

  const deleted: string[] = [];
  const errors: Array<{ name: string; error: unknown }> = [];
  for (const name of uniqueTargets) {
    if (!name) continue;
    try {
      await deleteDatabase(name);
      deleted.push(name);
    } catch (error) {
      errors.push({ name, error });
    }
  }

  return {
    deleted,
    errors,
    attempted: uniqueTargets,
    enumerated,
    usedFallbackList: enumerated.length === 0,
  };
}
