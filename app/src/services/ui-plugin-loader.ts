import type { PluginDefinition, PluginLoaderMap, PluginRegistryEntry } from '~/plugin-registry/index.js';
import { pluginDefinitions, pluginMapUI } from '~/plugin-registry/index.js';

type DefinitionWithDeps = PluginDefinition & {
  dependencies?: string[];
};

const loadedPlugins = new Set<string>();
let allLoaded = false;

const logWarning = (message: string, error?: unknown) => {
  if (typeof console === 'undefined') return;
  if (typeof error === 'undefined') {
    console.warn('[ui-plugin-loader]', message);
  } else {
    console.warn('[ui-plugin-loader]', message, error);
  }
};

const asDefinitions = (defs: PluginDefinition[] | PluginRegistryEntry[]): DefinitionWithDeps[] => {
  return defs.map((def) => ({
    ...def,
    dependencies: Array.isArray(def.dependencies) ? def.dependencies : [],
  }));
};

const topoSortByDependencies = (defs: DefinitionWithDeps[]): string[] => {
  const nodes = new Set<string>();
  const graph = new Map<string, Set<string>>();

  for (const def of defs) {
    nodes.add(def.nodeType);
    graph.set(def.nodeType, new Set(def.dependencies ?? []));
  }

  const visited = new Set<string>();
  const temp = new Set<string>();
  const order: string[] = [];

  const visit = (node: string) => {
    if (visited.has(node)) return;
    if (temp.has(node)) {
      throw new Error(`Circular plugin dependency detected at ${node}`);
    }
    temp.add(node);
    for (const dep of graph.get(node) ?? []) {
      if (nodes.has(dep)) visit(dep);
    }
    temp.delete(node);
    visited.add(node);
    order.push(node);
  };

  for (const node of nodes) visit(node);
  return order;
};

const getDefinitions = (): DefinitionWithDeps[] => {
  if (Array.isArray(pluginDefinitions) && pluginDefinitions.length > 0) {
    return asDefinitions(pluginDefinitions);
  }
  return [];
};

const getLoadOrder = (): string[] => {
  const defs = getDefinitions();
  return topoSortByDependencies(defs);
};

const getLoaderMap = (): PluginLoaderMap => {
  return (pluginMapUI ?? {}) as PluginLoaderMap;
};

export async function loadUIPlugin(nodeType: string): Promise<boolean> {
  const loaders = getLoaderMap();
  const loader = loaders[nodeType];
  if (typeof loader !== 'function') {
    logWarning(`No UI loader found for nodeType ${nodeType}`);
    return false;
  }
  if (loadedPlugins.has(nodeType)) {
    return true;
  }
  try {
    await loader();
    loadedPlugins.add(nodeType);
    return true;
  } catch (error) {
    logWarning(`Failed to load UI plugin ${nodeType}`, error);
    return false;
  }
}

export async function loadAllUIPlugins(): Promise<void> {
  if (allLoaded) return;
  const order = getLoadOrder();
  let hadError = false;
  for (const nodeType of order) {
    const ok = await loadUIPlugin(nodeType);
    if (!ok) {
      hadError = true;
    }
  }
  if (!hadError) {
    allLoaded = true;
  }
}

export function getUiPluginLoadPlan(): {
  plugins: string[];
  loadOrder: string[];
} {
  const defs = getDefinitions();
  const loadOrder = topoSortByDependencies(defs);
  return {
    plugins: defs.map((def) => def.nodeType),
    loadOrder,
  };
}

export function resetUiPluginLoadStateForTesting(): void {
  loadedPlugins.clear();
  allLoaded = false;
}
