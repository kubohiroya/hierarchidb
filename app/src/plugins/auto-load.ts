/**
 * Auto-load HierarchiDB plugins using virtual modules generated at build time.
 * - virtual:plugin-definitions … metadata for plugins (includes hierarchidb.plugin)
 * - virtual:plugin-map … dynamic import map per nodeType
 */

import type { NodeType } from '@hierarchidb/common-type';

// Provided by @hierarchidb/tools-vite-plugin-package-reader (vite virtual modules)
// These module declarations are injected during dev by the Vite plugin.
// In build, they are real modules generated at compile time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pluginDefinitions from 'virtual:plugin-definitions';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { pluginMap } from 'virtual:plugin-map';

type PluginDefinitionVM = {
  name: string;
  version: string;
  packageName: string;
  nodeType: string;
  priority: number;
  config?: {
    dependencies?: string[];
  };
};

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
    const deps = new Set<string>(d.config?.dependencies ?? []);
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
 * Automatically discover and load plugins based on virtual modules
 */
export async function autoLoadPlugins(): Promise<PluginLoadResult> {
  console.log('🔍 Auto-discovering plugins via virtual modules...');

  const defs = (pluginDefinitions as PluginDefinitionVM[]) || [];
  const loadOrder = topoSortByDependencies(defs);

  // Dynamically import in dependency order to ensure side effects register correctly
  for (const nodeType of loadOrder) {
    const loader = (pluginMap as Record<string, () => Promise<unknown>>)[nodeType];
    if (typeof loader === 'function') {
      console.log(`⏳ Loading plugin: ${nodeType}`);
      await loader();
      console.log(`✅ Loaded plugin: ${nodeType}`);
    } else {
      console.warn(`⚠️ No loader found for plugin: ${nodeType}`);
    }
  }

  console.log('✨ All plugins loaded successfully!');
  return {
    plugins: defs.map((d) => d.nodeType),
    loadOrder,
  };
}

/**
 * Get the list of plugins discovered (nodeType list)
 */
export function getDiscoveredPlugins(): NodeType[] {
  const defs = (pluginDefinitions as PluginDefinitionVM[]) || [];
  return defs.map((d) => d.nodeType as NodeType);
}

/**
 * Get the plan including dependency order
 */
export async function getPluginLoadPlan(): Promise<PluginLoadResult> {
  const defs = (pluginDefinitions as PluginDefinitionVM[]) || [];
  const loadOrder = topoSortByDependencies(defs);
  return {
    plugins: defs.map((d) => d.nodeType),
    loadOrder,
  };
}
