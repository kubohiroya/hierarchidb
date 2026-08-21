import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { Dexie } from 'dexie';
import { APP_DATABASE_NODE_TYPES_SET, databaseStoreLoaders } from './database-store-loaders.ts';

type ClearFn = (databaseName: string) => Promise<void> | void;

type ClearModule =
  | { clearDatabases?: ClearFn; clearDatabase?: ClearFn; clearIndexedDb?: ClearFn; clear?: ClearFn }
  | Record<string, unknown>;

interface ClearResult {
  invoked: string[];
  missing: string[];
  errors: Array<{ nodeType: string; error: unknown }>;
}

const DEFAULT_EXPORT_KEYS: Array<keyof ClearModule> = [
  'clearDatabases',
  'clearDatabase',
  'clearIndexedDb',
  'clear',
];

const asClearFn = (mod: ClearModule): ClearFn | undefined => {
  for (const key of DEFAULT_EXPORT_KEYS) {
    const fn = (mod as Record<string, unknown>)[key];
    if (typeof fn === 'function') return fn as ClearFn;
  }
  return undefined;
};

const CORE_DB_SUFFIXES = ['core'];

async function clearCoreDatabases(databasePrefix: string): Promise<void> {
  for (const suffix of CORE_DB_SUFFIXES) {
    await Dexie.delete(getDBName(databasePrefix, suffix));
  }
}

export async function clearAppIndexedDBsViaPlugins(): Promise<ClearResult> {
  const databasePrefix = getBuildDatabasePrefix();
  const invoked: string[] = [];
  const missing: string[] = [];
  const errors: Array<{ nodeType: string; error: unknown }> = [];

  // Best-effort: close any open Dexie connections in this tab before deletion.
  try {
    const closeAll = (Dexie as { closeAll?: () => void }).closeAll;
    closeAll?.();
  } catch {
    // ignore close failures; delete will attempt to recover
  }

  try {
    await clearCoreDatabases(databasePrefix);
    invoked.push('core');
  } catch (error) {
    errors.push({ nodeType: 'core', error });
  }

  const entries = Object.entries(databaseStoreLoaders ?? {}).filter(([nodeType]) =>
    APP_DATABASE_NODE_TYPES_SET.has(nodeType)
  );

  for (const [nodeType, entry] of entries) {
    try {
      const moduleValue =
        (entry?.loader && (await entry.loader())) ??
        (entry?.moduleSpecifier ? await import(/* @vite-ignore */ entry.moduleSpecifier) : null);
      if (!moduleValue) {
        missing.push(nodeType);
        continue;
      }
      const clearFn = asClearFn(moduleValue as ClearModule);
      if (!clearFn) {
        missing.push(nodeType);
        continue;
      }
      await clearFn(getDBName(databasePrefix, entry.databaseSuffix));
      invoked.push(nodeType);
    } catch (error) {
      errors.push({ nodeType, error });
    }
  }

  return { invoked, missing, errors };
}
