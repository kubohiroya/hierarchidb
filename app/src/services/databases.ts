import { pluginDatabaseLoaders } from '~/plugin-registry/index.ts';

type DatabaseLoaderEntry = (typeof pluginDatabaseLoaders)[string];
type PrewarmDescriptor = NonNullable<DatabaseLoaderEntry['prewarm']>[number];

type PrewarmHandle = {
  open?: () => Promise<unknown>;
  close?: () => Promise<unknown>;
};

const MAX_DEPTH = 3;

const prewarmNodeTypesCache: string[] = computePrewarmNodeTypes();

const isBrowserEnvironment = (): boolean => typeof window !== 'undefined';

const logDatabaseWarning = (nodeType: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn(`[services/databases] Failed to prewarm ${nodeType} database`, error);
};

function computePrewarmNodeTypes(): string[] {
  return Object.entries(pluginDatabaseLoaders)
    .filter(([, entry]) => Array.isArray(entry?.prewarm) && entry.prewarm.length > 0)
    .map(([nodeType]) => nodeType)
    .sort();
}

function isPrewarmHandle(value: unknown): value is PrewarmHandle {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Record<string, unknown>).open === 'function';
}

function isConstructable(fn: unknown): fn is new () => unknown {
  if (typeof fn !== 'function') return false;
  const descriptor = Object.getOwnPropertyDescriptor(fn, 'prototype');
  if (!descriptor || !descriptor.value) return false;
  const prototype = descriptor.value as Record<string, unknown>;
  const keys = Object.getOwnPropertyNames(prototype).filter((key) => key !== 'constructor');
  if (keys.length > 0) return true;
  const source = Function.prototype.toString.call(fn);
  return /^class\s/.test(source);
}

function scoreKey(key: string): number {
  if (key === 'default') return 5;
  if (/^(get|create|build|make)[A-Z].*(Database|DB)$/.test(key)) return 100;
  if (/(Database|DB)$/.test(key)) return 90;
  return 10;
}

function resolvePrewarmHandle(
  value: unknown,
  depth: number,
  visited: WeakSet<object>
): PrewarmHandle | null {
  if (depth > MAX_DEPTH) return null;

  if (isPrewarmHandle(value)) {
    return value;
  }

  if (typeof value === 'function') {
    if (isConstructable(value)) {
      try {
        const instance = new (value as new () => unknown)();
        const constructed = resolvePrewarmHandle(instance, depth + 1, visited);
        if (constructed) return constructed;
      } catch {
        // ignore constructor errors
      }
    }

    try {
      const result = (value as () => unknown)();
      const invoked = resolvePrewarmHandle(result, depth + 1, visited);
      if (invoked) return invoked;
    } catch {
      // ignore invocation errors
    }
  }

  if (value && typeof value === 'object') {
    const objectValue = value as object;
    if (visited.has(objectValue)) {
      return null;
    }
    visited.add(objectValue);

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => scoreKey(b) - scoreKey(a));

    for (const key of keys) {
      const resolved = resolvePrewarmHandle(record[key], depth + 1, visited);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

function getPrewarmDescriptors(entry: DatabaseLoaderEntry | undefined): PrewarmDescriptor[] {
  if (!entry?.prewarm) return [];
  return entry.prewarm.filter((descriptor): descriptor is PrewarmDescriptor =>
    Boolean(descriptor?.exportName && descriptor.specifier)
  );
}

async function loadModuleForDescriptor(
  descriptor: PrewarmDescriptor,
  entry: DatabaseLoaderEntry | undefined,
  cache: Map<string, Promise<unknown>>
): Promise<unknown | null> {
  const specifier = descriptor.specifier;
  if (!specifier) return null;

  if (cache.has(specifier)) {
    const cached = cache.get(specifier);
    if (cached) {
      return await cached;
    }
  }

  const load = async () => {
    if (entry?.moduleSpecifier === specifier && typeof entry.loader === 'function') {
      try {
        return await entry.loader();
      } catch {
        // fall back to direct import below
      }
    }
    return await import(/* @vite-ignore */ specifier);
  };

  const promise = load();
  cache.set(specifier, promise);
  try {
    return await promise;
  } catch (error) {
    cache.delete(specifier);
    throw error;
  }
}

function logPrewarmDescriptorWarning(
  nodeType: string,
  descriptor: PrewarmDescriptor,
  message: string,
  error?: unknown
): void {
  if (typeof console === 'undefined') return;
  const detail = `${message} for ${nodeType} (export ${descriptor.exportName} from ${descriptor.specifier})`;
  if (error) {
    console.warn(`[services/databases] ${detail}`, error);
  } else {
    console.warn(`[services/databases] ${detail}`);
  }
}

export function getDatabaseNodeTypes(): string[] {
  return prewarmNodeTypesCache;
}

export async function prewarmPluginDatabases(inputNodeTypes?: string[]): Promise<string[]> {
  if (!isBrowserEnvironment()) return [];

  const successful = new Set<string>();
  const moduleCache = new Map<string, Promise<unknown>>();
  const targetNodeTypes = (inputNodeTypes ?? prewarmNodeTypesCache).filter(
    (nodeType) => getPrewarmDescriptors(pluginDatabaseLoaders[nodeType]).length > 0
  );

  for (const nodeType of targetNodeTypes) {
    const entry = pluginDatabaseLoaders[nodeType];
    const descriptors = getPrewarmDescriptors(entry);
    if (descriptors.length === 0) continue;

    for (const descriptor of descriptors) {
      let moduleValue: unknown;
      try {
        moduleValue = await loadModuleForDescriptor(descriptor, entry, moduleCache);
      } catch (error) {
        logPrewarmDescriptorWarning(nodeType, descriptor, 'Failed to load module', error);
        continue;
      }

      if (!moduleValue) {
        logPrewarmDescriptorWarning(nodeType, descriptor, 'Module import returned no value');
        continue;
      }

      const exportValue = (moduleValue as Record<string, unknown>)[descriptor.exportName];
      if (typeof exportValue === 'undefined') {
        logPrewarmDescriptorWarning(nodeType, descriptor, 'Prewarm export not found');
        continue;
      }

      const handle = resolvePrewarmHandle(exportValue, 0, new WeakSet<object>());
      if (!handle) {
        logPrewarmDescriptorWarning(nodeType, descriptor, 'Prewarm handle could not be resolved');
        continue;
      }

      try {
        await handle.open?.();
        successful.add(nodeType);
      } catch (error) {
        logDatabaseWarning(nodeType, error);
      }
    }
  }

  return Array.from(successful);
}
