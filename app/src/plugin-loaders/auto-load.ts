/**
 * Auto-load HierarchiDB UI plugin-loaders using virtual modules generated at build time.
 *
 * This module is responsible for discovering and importing UI plugin entry points so
 * that components, menus, and registrations are initialized in the browser. The module
 * loader is provided by the plugin registry DI container at runtime-worker; no pre-generated
 * UI loader exists anymore.
 */

import type { NodeType } from '@hierarchidb/common-types';
import type { PluginDefinition } from '@hierarchidb/plugin-registry/types';
import { getPluginRegistryContainer } from './di/container.ts';
import type { PluginUiModuleLoader } from './di/interfaces.ts';
import { UIPluginRegistryTokens } from './di/tokens.ts';

type PluginDefinitionVM = {
  nodeType: string;
  name: string;
  packageName: string;
  version: string;
  displayName: string;
  priority: number;
  dependencies: string[];
};

const container = getPluginRegistryContainer();

const getDefinitions = (): PluginDefinitionVM[] => {
  const defs = container.get<PluginDefinition[]>(UIPluginRegistryTokens.PluginDefinitions);
  if (!Array.isArray(defs)) return [];
  return defs as PluginDefinitionVM[];
};

const getModuleLoader = (): PluginUiModuleLoader =>
  container.get<PluginUiModuleLoader>(UIPluginRegistryTokens.PluginUiModuleLoader);

/**
 * @deprecated
 */
export type PluginLoadResult = {
  plugins: string[]; // nodeType list
  loadOrder: string[]; // nodeType in dependency order
};

function topoSortByDependencies(defs: PluginDefinitionVM[]): string[] {
  const nodes = new Set<string>();
  const graph = new Map<string, Set<string>>(); // nodeType -> deps

  for (const d of defs) {
    const id = d.nodeType;
    nodes.add(id);
    const deps = new Set<string>(d.dependencies ?? []);
    graph.set(id, deps);
  }

  const visited = new Set<string>();
  const temp = new Set<string>();
  const out: string[] = [];

  const visit = (n: string) => {
    if (visited.has(n)) return;
    if (temp.has(n)) {
      throw new Error(`Circular plugin dependency detected at ${n}`);
    }
    temp.add(n);
    for (const dep of graph.get(n) ?? []) {
      if (nodes.has(dep)) visit(dep);
    }
    temp.delete(n);
    visited.add(n);
    out.push(n);
  };

  for (const n of nodes) visit(n);
  return out;
}

/**
 * Automatically discover and load plugin-loaders based on virtual modules
 * @deprecated
 */
export async function autoLoadPlugins(): Promise<PluginLoadResult> {
  console.log('🔍 Auto-discovering plugin-loaders via plugin registry...');

  const defs = getDefinitions();
  const loadOrder = topoSortByDependencies(defs);
  const moduleLoader = getModuleLoader();

  // Dynamically import in dependency order to ensure side effects register correctly
  for (const nodeType of loadOrder) {
    if (!moduleLoader.has(nodeType)) {
      console.warn(`⚠️ No loader found for plugin: ${nodeType}`);
      continue;
    }
    await moduleLoader.loadModule(nodeType);
  }

  console.log('✨ All plugin-loaders loaded successfully!');
  return {
    plugins: defs.map((d) => d.nodeType),
    loadOrder,
  };
}

/**
 * Get the list of plugin-loaders discovered (nodeType list)
 * @deprecated
 */
export function getDiscoveredPlugins(): NodeType[] {
  const defs = getDefinitions();
  return defs.map((d) => d.nodeType as NodeType);
}

/**
 * Get the plan including dependency order
 * @deprecated
 */
export async function getPluginLoadPlan(): Promise<PluginLoadResult> {
  const defs = getDefinitions();
  const loadOrder = topoSortByDependencies(defs);
  return {
    plugins: defs.map((d) => d.nodeType),
    loadOrder,
  };
}
