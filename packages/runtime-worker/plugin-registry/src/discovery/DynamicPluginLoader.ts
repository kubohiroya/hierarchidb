/**
 * Dynamic Plugin Loader System
 *
 * Loads plugins dynamically using ES module imports based on resolved dependencies.
 * Handles the actual loading process after dependencies have been resolved.
 */

import { NodeType, PluginDefinition } from '@hierarchidb/common-type';
import { LoadingResult, PluginAvailability, PluginLoadEntry } from '~/discovery/DiscoveryTypes';
import { PluginDependencyResolver } from '../registry/DependencyResolver';

/**
 * Dynamic Plugin Loader Implementation
 */
export class DynamicPluginLoader {
  private resolver: PluginDependencyResolver;
  private manifests: Map<NodeType, PluginDefinition> = new Map();
  private modules: Map<NodeType, any> = new Map();
  private loadResults: Map<NodeType, PluginLoadEntry> = new Map();

  constructor() {
    this.resolver = new PluginDependencyResolver();
  }

  /**
   * Load plugins based on requested list
   */
  async loadPlugins(requested: NodeType[]): Promise<LoadingResult> {
    const startTime = Date.now();
    const results: LoadingResult = {
      success: true,
      requested: [...requested],
      loaded: [],
      skipped: [],
      failed: [],
      loadOrder: [],
      totalTime: 0,
      dependencyGraph: null,
    };

    try {
      // Step 1: Collect all plugins (requested + dependencies)
      console.log('[DynamicPluginLoader] Collecting plugin manifests...');
      const allPlugins = await this.collectAllPlugins(requested);

      // Step 2: Load manifests for all plugins
      console.log('[DynamicPluginLoader] Loading manifests for', allPlugins.size, 'plugins...');
      await this.loadManifests(Array.from(allPlugins));

      // Step 3: Build dependency graph
      console.log('[DynamicPluginLoader] Building dependency graph...');
      const metadata = this.buildMetadata();
      this.resolver.registerPlugins(metadata);

      // Step 4: Resolve dependencies and determine load order
      console.log('[DynamicPluginLoader] Resolving dependencies...');
      const resolution = this.resolver.resolve();

      if (!resolution.success) {
        results.success = false;
        results.failed = resolution.errors.map((e) => ({
          nodeType: e.nodeTypes[0] || ('unknown' as NodeType),
          error: e.message,
        }));
        return results;
      }

      results.loadOrder = resolution.resolvedOrder.map((p) => p.nodeType);
      results.dependencyGraph = resolution.graph;

      // Step 5: Load plugin modules in order
      console.log('[DynamicPluginLoader] Loading plugins in order:', results.loadOrder);
      for (const nodeType of results.loadOrder) {
        const loadResult = await this.loadPlugin(nodeType, requested);

        if (loadResult) {
          results.loaded.push(loadResult);
          this.loadResults.set(nodeType, loadResult);
        } else {
          results.skipped.push(nodeType);
        }
      }
    } catch (error) {
      results.success = false;
      results.failed.push({
        nodeType: 'unknown' as NodeType,
        error: String(error),
      });
    }

    results.totalTime = Date.now() - startTime;

    // Log summary
    this.logLoadingSummary(results);

    return results;
  }

  /**
   * Collect all required plugins including dependencies
   */
  private async collectAllPlugins(requested: NodeType[]): Promise<Set<NodeType>> {
    const allPlugins = new Set<NodeType>(requested);
    const visited = new Set<NodeType>();
    const queue = [...requested];

    while (queue.length > 0) {
      const nodeType = queue.shift()!;

      if (visited.has(nodeType)) continue;
      visited.add(nodeType);

      // Load manifest to get dependencies
      const manifest = await this.loadManifest(nodeType);
      if (!manifest) continue;

      // Add dependencies
      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          const nodeType = dep as NodeType;
          allPlugins.add(nodeType);
          if (!visited.has(nodeType)) {
            queue.push(nodeType);
          }
        }
      }

      // Add extends as dependency
      if (manifest.extends) {
        const nodeType = manifest.extends as NodeType;
        allPlugins.add(nodeType);
        if (!visited.has(nodeType)) {
          queue.push(nodeType);
        }
      }

      /*
      // Optionally add optional dependencies
      if (manifest.optionalDependencies) {
        for (const dep of manifest.optionalDependencies) {
          const availability = await this.checkPluginAvailability(dep);
          if (availability.available) {
            allPlugins.add(dep);
            if (!visited.has(dep)) {
              queue.push(dep);
            }
          }
        }
      }
       */
    }

    return allPlugins;
  }

  /**
   * Load manifests for multiple plugins
   */
  private async loadManifests(nodeTypes: NodeType[]): Promise<void> {
    for (const nodeType of nodeTypes) {
      const manifest = await this.loadManifest(nodeType);
      if (manifest) {
        this.manifests.set(nodeType, manifest);
      }
    }
  }

  /**
   * Load a single plugin manifest
   */
  private async loadManifest(nodeType: NodeType): Promise<PluginDefinition | null> {
    // Check cache
    if (this.manifests.has(nodeType)) {
      return this.manifests.get(nodeType)!;
    }

    try {
      // Try to load manifest file
      const packageName = this.getPackageName(nodeType);
      const manifestPath = `${packageName}/plugin.manifest.json`;

      // Dynamic import of manifest
      const manifest = await import(manifestPath);
      return manifest.default || manifest;
    } catch (error) {
      console.warn(`[DynamicPluginLoader] Could not load manifest for ${nodeType}:`, error);
      throw error;
    }
  }

  /**
   * Check if a plugin is available
   */
  public async checkPluginAvailability(nodeType: NodeType): Promise<PluginAvailability> {
    const packageName = this.getPackageName(nodeType);

    try {
      // Try to resolve the package
      (await import.meta.resolve?.(packageName)) || require.resolve(packageName);
      return {
        nodeType,
        available: true,
        packageName,
      };
    } catch (error) {
      return {
        nodeType,
        available: false,
        packageName,
        reason: String(error),
      };
    }
  }

  /**
   * Build metadata for dependency resolver
   */
  private buildMetadata(): any[] {
    return Array.from(this.manifests.values()).map((manifest) => ({
      nodeType: manifest.nodeType,
      name: manifest.name,
      version: manifest.version || '1.0.0',
      priority: manifest.priority || 500,
      dependencies: manifest.dependencies,
      extends: manifest.extends,
      description: manifest.description,
      category: manifest.category,
    }));
  }

  /**
   * Load a single plugin module
   */
  private async loadPlugin(
    nodeType: NodeType,
    requested: NodeType[]
  ): Promise<PluginLoadEntry | null> {
    const startTime = Date.now();

    try {
      const manifest = this.manifests.get(nodeType);
      if (!manifest) {
        console.warn(`[DynamicPluginLoader] No manifest for ${nodeType}`);
        return null;
      }

      // Load the module using dynamic import
      const packageName = this.getPackageName(nodeType);
      const module = await import(packageName);

      this.modules.set(nodeType, module);

      // Determine source type
      const source: 'requested' | 'dependency' | 'optional' = requested.includes(nodeType)
        ? 'requested'
        : 'dependency';

      // Build dependency chain
      const dependencyChain = this.getDependencyChain(nodeType);

      const result: PluginLoadEntry = {
        nodeType,
        manifest,
        module,
        loadTime: Date.now() - startTime,
        source,
        dependencyChain,
      };

      console.log(`[DynamicPluginLoader] Loaded ${nodeType} (${source}) in ${result.loadTime}ms`);

      return result;
    } catch (error) {
      console.error(`[DynamicPluginLoader] Failed to load ${nodeType}:`, error);
      return null;
    }
  }

  /**
   * Get package name for a node type
   */
  private getPackageName(nodeType: NodeType): string {
    // Map node types to package names
    const packageMap: Record<string, string> = {
      folder: '@hierarchidb/folder-plugin',
      basemap: '@hierarchidb/basemap-plugin',
      shape: '@hierarchidb/shape-plugin',
      styler: '@hierarchidb/styler-plugin',
      spreadsheet: '@hierarchidb/spreadsheet-plugin',
    };

    return packageMap[nodeType] || `@hierarchidb/${nodeType}-plugin`;
  }

  /**
   * Get dependency chain for a plugin
   */
  private getDependencyChain(nodeType: NodeType): NodeType[] {
    const chain: NodeType[] = [];
    const manifest = this.manifests.get(nodeType);

    if (manifest) {
      if (manifest.extends) {
        chain.push(manifest.extends as NodeType);
      }
      if (manifest.dependencies) {
        chain.push(...(manifest.dependencies as NodeType[]));
      }
    }

    return chain;
  }

  /**
   * Log loading summary
   */
  private logLoadingSummary(results: LoadingResult): void {
    console.log('[DynamicPluginLoader] Loading Summary:');
    console.log(`  Requested: ${results.requested.join(', ')}`);
    console.log(`  Loaded: ${results.loaded.length} plugins`);
    console.log(`  - Requested: ${results.loaded.filter((p) => p.source === 'requested').length}`);
    console.log(
      `  - Dependencies: ${results.loaded.filter((p) => p.source === 'dependency').length}`
    );
    console.log(`  - Optional: ${results.loaded.filter((p) => p.source === 'optional').length}`);
    if (results.skipped.length > 0) {
      console.log(`  Skipped: ${results.skipped.join(', ')}`);
    }
    if (results.failed.length > 0) {
      console.log(`  Failed: ${results.failed.map((f) => f.nodeType).join(', ')}`);
    }
    console.log(`  Load order: ${results.loadOrder.join(' → ')}`);
    console.log(`  Total time: ${results.totalTime}ms`);
  }

  /**
   * Get loaded plugin module
   */
  getModule(nodeType: NodeType): any {
    return this.modules.get(nodeType);
  }

  /**
   * Get plugin manifest
   */
  getManifest(nodeType: NodeType): PluginDefinition | undefined {
    return this.manifests.get(nodeType);
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): PluginLoadEntry[] {
    return Array.from(this.loadResults.values());
  }
}
