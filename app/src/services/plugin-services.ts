// Thin facade that lazily resolves plugin-specific helpers via dynamic import.
// Delegates to the generated registry loaders so the application never hard-codes
// plugin package paths.

import { pluginDatabaseLoaders, pluginRegistry } from '~/plugin-registry/index.ts';

type Loader = () => Promise<unknown>;

type DatabaseLoaderEntry = (typeof pluginDatabaseLoaders)[string];

const fallbackEntryCache = new Map<string, DatabaseLoaderEntry>();

function createFallbackEntry(nodeType: string): DatabaseLoaderEntry | undefined {
  if (fallbackEntryCache.has(nodeType)) {
    return fallbackEntryCache.get(nodeType);
  }

  const registryEntry = pluginRegistry.find((item) => item.nodeType === nodeType);
  if (!registryEntry) return undefined;
  const specifier = registryEntry.modules.database?.specifier ?? registryEntry.modules.root?.specifier;
  if (!specifier) return undefined;

  const loader: Loader = async () => import(/* @vite-ignore */ specifier);
  const entry: DatabaseLoaderEntry = {
    moduleSpecifier: specifier,
    loader,
  };
  fallbackEntryCache.set(nodeType, entry);
  return entry;
}

function getLoaderEntry(nodeType: string): DatabaseLoaderEntry | undefined {
  return pluginDatabaseLoaders[nodeType] ?? createFallbackEntry(nodeType);
}

async function loadModuleFromEntry(entry: DatabaseLoaderEntry | undefined): Promise<unknown | null> {
  if (!entry) return null;

  if (typeof entry.loader === 'function') {
    try {
      return await entry.loader();
    } catch {
      // fall through to moduleSpecifier import
    }
  }

  if (entry.moduleSpecifier) {
    try {
      return await import(/* @vite-ignore */ entry.moduleSpecifier);
    } catch {
      return null;
    }
  }

  return null;
}

export async function loadPluginService<N extends string>(nodeType: N): Promise<unknown | null> {
  const moduleValue = await loadModuleFromEntry(getLoaderEntry(nodeType));
  if (!moduleValue) return null;
  return resolveModule(moduleValue);
}

function resolveModule<T>(moduleValue: unknown): T | null {
  if (moduleValue == null) return null;
  if (typeof moduleValue === 'object' && moduleValue !== null) {
    const record = moduleValue as Record<string, unknown>;
    if ('default' in record && record.default !== undefined) {
      return record.default as T;
    }
  }
  return moduleValue as T;
}

export async function tryLoadFirst<T = unknown>(nodeTypes: string[]): Promise<T | null> {
  for (const nt of nodeTypes) {
    const moduleValue = await loadPluginService(nt);
    if (moduleValue) return moduleValue as T;
  }
  return null;
}
