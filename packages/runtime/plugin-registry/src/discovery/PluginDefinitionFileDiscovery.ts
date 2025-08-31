//import type { PackageJson, PluginLoadResult, PluginManifest } from '../types';
//import type { NodeType } from '../../types';

import { PluginLoadResult } from './DiscoveryTypes';
import { NodeType, PluginDefinition, PackageJson } from '@hierarchidb/common-type';

/**
 * Plugin discovery system that uses plugin manifest files
 * Combines package.json dependencies with plugin-specific manifest files for enhanced metadata
 */
export class PluginDefinitionFileDiscovery {
  private static readonly PLUGIN_PATTERN = /^@hierarchidb\/node-type-(.+)-plugin$/;
  private pluginManifests: Record<NodeType, PluginDefinition> = {};
  private fileSystemMock?: (path: string) => Promise<string>;

  /**
   * Discovers plugin names from package.json dependencies
   */
  discoverPluginsFromPackageJson(packageJson: PackageJson): NodeType[] {
    if (!packageJson.dependencies) {
      return [];
    }

    const plugins: NodeType[] = [];

    for (const packageName of Object.keys(packageJson.dependencies)) {
      const pluginName = this.extractPluginName(packageName);
      if (pluginName) {
        plugins.push(pluginName as NodeType);
      }
    }

    return plugins;
  }

  /**
   * Extracts plugin name from package name
   * @param packageName e.g., "@hierarchidb/node-type-folder-plugin-plugin"
   * @returns Plugin name e.g., "folder-plugin" or null if not a plugin
   */
  extractPluginName(packageName: string): string | null {
    const match = packageName.match(PluginDefinitionFileDiscovery.PLUGIN_PATTERN);
    return match ? (match[1] ?? null) : null;
  }

  /**
   * Loads plugins with their dependencies in the correct order
   */
  async loadPluginsWithDependencies(packageJson: PackageJson): Promise<PluginLoadResult> {
    // Discover directly referenced plugins
    const discoveredPlugins = this.discoverPluginsFromPackageJson(packageJson);

    if (discoveredPlugins.length === 0) {
      return {
        plugins: [],
        loadOrder: [],
        manifests: {},
      };
    }

    // Collect all plugins including transitive dependencies
    const allPlugins = new Set<NodeType>();
    const toProcess = [...discoveredPlugins];

    while (toProcess.length > 0) {
      const plugin = toProcess.shift()!;

      if (allPlugins.has(plugin)) {
        continue;
      }

      allPlugins.add(plugin);

      const manifest = this.pluginManifests[plugin];
      if (!manifest) {
        throw new Error(`Plugin manifest not found for: ${plugin}`);
      }

      // Add dependencies to process queue
      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          if (!allPlugins.has(dep as NodeType)) {
            toProcess.push(dep as NodeType);
          }
        }
      }

      // Handle extends relationship as implicit dependency
      if (manifest.extends && !allPlugins.has(manifest.extends as NodeType)) {
        toProcess.push(manifest.extends as NodeType);
      }
    }

    // Build dependency graph
    const graph: Map<NodeType, NodeType[]> = new Map();
    const inDegree: Map<NodeType, number> = new Map();

    for (const plugin of allPlugins) {
      graph.set(plugin, []);
      inDegree.set(plugin, 0);
    }

    // Build edges
    for (const plugin of allPlugins) {
      const manifest = this.pluginManifests[plugin];
      if (!manifest) {
        continue; // Skip if manifest not found
      }
      const deps: NodeType[] = [];

      if (manifest.dependencies) {
        deps.push(...(manifest.dependencies as NodeType[]));
      }
      if (manifest.extends) {
        deps.push(manifest.extends as NodeType);
      }

      for (const dep of deps) {
        if (!graph.has(dep)) {
          graph.set(dep, []);
          inDegree.set(dep, 0);
        }
        graph.get(dep)!.push(plugin);
        inDegree.set(plugin, (inDegree.get(plugin) || 0) + 1);
      }
    }

    // Topological sort using Kahn's algorithm
    const loadOrder: NodeType[] = [];
    const queue: NodeType[] = [];

    // Find nodes with no dependencies
    for (const [plugin, degree] of inDegree) {
      if (degree === 0) {
        queue.push(plugin);
      }
    }

    while (queue.length > 0) {
      const plugin = queue.shift()!;
      loadOrder.push(plugin);

      for (const dependent of graph.get(plugin) || []) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);

        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    // Check for circular dependencies
    if (loadOrder.length !== allPlugins.size) {
      const remaining = Array.from(allPlugins).filter((p) => !loadOrder.includes(p));
      throw new Error(`Circular dependency detected involving: ${remaining.join(', ')}`);
    }

    return {
      plugins: Array.from(allPlugins),
      loadOrder,
      manifests: Object.fromEntries(
        Array.from(allPlugins).map((p) => [p, this.pluginManifests[p]])
      ) as Record<NodeType, PluginDefinition>,
    };
  }

  /**
   * Initialize plugins from app's package.json file
   */
  async initializeFromAppPackageJson(packageJsonPath: string): Promise<PluginLoadResult> {
    const content = await this.readFile(packageJsonPath);
    const packageJson = JSON.parse(content) as PackageJson;
    return this.loadPluginsWithDependencies(packageJson);
  }

  /**
   * Generate dynamic import code for discovered plugins
   */
  generatePluginImports(loadOrder: NodeType[]): string {
    const imports = loadOrder
      .map((plugin) => `  await import('@hierarchidb/node-type-${plugin}-plugin');`)
      .join('\\n');

    return `// Auto-generated plugin loader
// DO NOT EDIT - This file is generated by ManifestFileDiscovery

export async function loadPlugins(): Promise<void> {
  // Load plugins in dependency order
${imports}
}

export const PLUGIN_LOAD_ORDER = ${JSON.stringify(loadOrder, null, 2)};`;
  }

  /**
   * Set plugin manifests for testing or initialization
   */
  setPluginManifests(manifests: Record<NodeType, PluginDefinition>): void {
    this.pluginManifests = manifests;
  }

  /**
   * Set file system mock for testing
   */
  setFileSystemMock(readFile: (path: string) => Promise<string>): void {
    this.fileSystemMock = readFile;
  }

  /**
   * Read file (uses mock in tests, real fs in production)
   */
  private async readFile(path: string): Promise<string> {
    if (this.fileSystemMock) {
      return this.fileSystemMock(path);
    }

    // In production, this would use fs.promises.readFile
    // For now, we'll throw an error indicating it needs to be implemented
    throw new Error('File system operations not implemented. Use setFileSystemMock in tests.');
  }
}

/**
 * Singleton instance for global use
 */
export const manifestFileDiscovery = new PluginDefinitionFileDiscovery();
