import { pluginDatabaseLoaders } from '~/plugin-registry/index.ts';

type ClearFn = () => Promise<void> | void;

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

export async function clearAppIndexedDBsViaPlugins(): Promise<ClearResult> {
  const invoked: string[] = [];
  const missing: string[] = [];
  const errors: Array<{ nodeType: string; error: unknown }> = [];

  const entries = Object.entries(pluginDatabaseLoaders ?? {});

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
      await clearFn();
      invoked.push(nodeType);
    } catch (error) {
      errors.push({ nodeType, error });
    }
  }

  return { invoked, missing, errors };
}
