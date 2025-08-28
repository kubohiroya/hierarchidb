/**
 * Dynamic Plugin Registry System
 *
 * Combines plugin discovery with dependency resolution for automatic registration.
 * Dynamically discovers plugins from package.json and loads them in correct order.
 */

import { PluginDependencyResolver } from '@hierarchidb/common-type';

// Local PluginMetadata type to avoid conflicts with core definitions
interface PluginMetadata {
  nodeType: string;
  name: string;
  version: string;
  priority?: number;
  dependencies?: string[];
  extends?: string;
  description?: string;
  category?: string;
}
import { PluginDiscoveryService, type DiscoveredPlugin } from './PluginDiscovery';
import type { NodeType } from '@hierarchidb/common-type';

/**
 * Dynamic plugin registration result
 */
export interface DynamicRegistrationResult {
  success: boolean;
  discovered: DiscoveredPlugin[];
  registered: NodeType[];
  skipped: NodeType[];
  errors: string[];
  loadOrder: NodeType[];
  report: {
    discoveryReport: any;
    dependencyGraph: any;
    timing: {
      discovery: number;
      resolution: number;
      registration: number;
      total: number;
    };
  };
}

/**
 * Dynamic Plugin Registry combining discovery and resolution
 */
export class DynamicPluginRegistry {
  private discoveryService: PluginDiscoveryService;
  private dependencyResolver: PluginDependencyResolver;
  private registeredPlugins: Set<NodeType> = new Set();
  private pluginModules: Map<NodeType, any> = new Map();

  constructor() {
    this.discoveryService = new PluginDiscoveryService({
      // Enable dynamic imports in development, use static in production
      useDynamicImport: process.env.NODE_ENV !== 'production',
    });
    this.dependencyResolver = new PluginDependencyResolver();
  }

  /**
   * Discover, resolve dependencies, and register plugins automatically
   */
  async autoRegister(registry: any): Promise<DynamicRegistrationResult> {
    const startTime = Date.now();
    const timing = {
      discovery: 0,
      resolution: 0,
      registration: 0,
      total: 0,
    };

    try {
      // Step 1: Discover available plugins
      const discoveryStart = Date.now();
      const discovered = await this.discoveryService.discoverPlugins();
      timing.discovery = Date.now() - discoveryStart;

      console.log(`[DynamicPluginRegistry] Discovered ${discovered.length} plugins`);

      // Step 2: Build metadata for dependency resolution
      const pluginMetadata = this.buildPluginMetadata(discovered);

      // Step 3: Resolve dependencies and determine load order
      const resolutionStart = Date.now();
      this.dependencyResolver.registerPlugins(pluginMetadata);
      const resolutionResult = this.dependencyResolver.resolve();
      timing.resolution = Date.now() - resolutionStart;

      if (!resolutionResult.success) {
        return this.createErrorResult(
          discovered,
          resolutionResult.errors.map((e: any) => e.message),
          timing
        );
      }

      // Step 4: Load and register plugins in resolved order
      const registrationStart = Date.now();
      const registrationResult = await this.registerPluginsInOrder(
        resolutionResult.resolvedOrder.map((p: any) => p.nodeType),
        discovered,
        registry
      );
      timing.registration = Date.now() - registrationStart;

      timing.total = Date.now() - startTime;

      // Step 5: Create comprehensive result
      return {
        success: registrationResult.errors.length === 0,
        discovered,
        registered: registrationResult.registered,
        skipped: registrationResult.skipped,
        errors: registrationResult.errors,
        loadOrder: resolutionResult.resolvedOrder.map((p: any) => p.nodeType),
        report: {
          discoveryReport: this.discoveryService.generateReport(),
          dependencyGraph: this.dependencyResolver.exportGraph(),
          timing,
        },
      };
    } catch (error) {
      timing.total = Date.now() - startTime;
      return this.createErrorResult([], [`Fatal error during auto-registration: ${error}`], timing);
    }
  }

  /**
   * Build plugin metadata from discovered plugins
   */
  private buildPluginMetadata(discovered: DiscoveredPlugin[]): PluginMetadata[] {
    return discovered.map((plugin) => {
      // Use discovered metadata or build from conventions
      if (plugin.metadata) {
        return plugin.metadata;
      }

      // Build metadata from available information
      return {
        nodeType: plugin.nodeType,
        name: this.humanizeNodeType(plugin.nodeType),
        version: '1.0.0', // Default version
        priority: this.inferPriority(plugin.nodeType),
        dependencies: this.inferDependencies(plugin.nodeType),
        extends: this.inferExtends(plugin.nodeType),
      };
    });
  }

  /**
   * Register plugins in the resolved order
   */
  private async registerPluginsInOrder(
    loadOrder: NodeType[],
    discovered: DiscoveredPlugin[],
    registry: any
  ): Promise<{ registered: NodeType[]; skipped: NodeType[]; errors: string[] }> {
    const registered: NodeType[] = [];
    const skipped: NodeType[] = [];
    const errors: string[] = [];

    // Create lookup map for discovered plugins
    const discoveredMap = new Map<NodeType, DiscoveredPlugin>();
    for (const plugin of discovered) {
      discoveredMap.set(plugin.nodeType, plugin);
    }

    // Register each plugin in order
    for (const nodeType of loadOrder) {
      const plugin = discoveredMap.get(nodeType);

      if (!plugin) {
        skipped.push(nodeType);
        console.warn(`[DynamicPluginRegistry] Plugin ${nodeType} in load order but not discovered`);
        continue;
      }

      try {
        // Load plugin module
        const module = await this.loadPluginModule(plugin);

        if (!module) {
          throw new Error(`Failed to load module for ${nodeType}`);
        }

        // Register with registry
        await this.registerPlugin(nodeType, module, registry);

        registered.push(nodeType);
        this.registeredPlugins.add(nodeType);
        this.pluginModules.set(nodeType, module);

        console.log(`[DynamicPluginRegistry] Registered plugin: ${nodeType}`);
      } catch (error) {
        const errorMsg = `Failed to register ${nodeType}: ${error}`;
        errors.push(errorMsg);
        console.error(`[DynamicPluginRegistry] ${errorMsg}`);
      }
    }

    return { registered, skipped, errors };
  }

  /**
   * Load plugin module
   */
  private async loadPluginModule(plugin: DiscoveredPlugin): Promise<any> {
    // Use already loaded module if available
    if (plugin.module) {
      return plugin.module;
    }

    // Load using discovery service
    return await this.discoveryService.loadPlugin(plugin.packageName);
  }

  /**
   * Register a single plugin with the registry
   */
  private async registerPlugin(nodeType: NodeType, module: any, registry: any): Promise<void> {
    // Find the definition export
    const definition = this.extractDefinition(module, nodeType);

    if (!definition) {
      throw new Error(`No definition found for ${nodeType}`);
    }

    // Register with the appropriate registry method
    if (typeof registry.register === 'function') {
      await registry.register(definition);
    } else if (typeof registry.registerDefinition === 'function') {
      await registry.registerDefinition(definition);
    } else if (typeof registry.registerNodeType === 'function') {
      await registry.registerNodeType(definition);
    } else {
      throw new Error('Registry does not have a supported registration method');
    }
  }

  /**
   * Extract plugin definition from module
   */
  private extractDefinition(module: any, nodeType: NodeType): any {
    // Common export patterns
    const patterns = [
      `${this.capitalize(nodeType)}Definition`,
      `${nodeType}Definition`,
      'Definition',
      'definition',
      'default',
      `${this.capitalize(nodeType)}Plugin`,
      `${nodeType}Plugin`,
      'Plugin',
    ];

    for (const pattern of patterns) {
      if (module[pattern]) {
        return module[pattern];
      }
    }

    // Check if module itself is the definition
    if (module.nodeType === nodeType) {
      return module;
    }

    return null;
  }

  /**
   * Infer priority based on node type conventions
   */
  private inferPriority(nodeType: NodeType): number {
    const priorityMap: Record<string, number> = {
      folder: 1000, // Base type, highest priority
      project: 950,
      basemap: 900,
      shape: 800,
      stylemap: 700,
      spreadsheet: 600,
      // Default for unknown types
      default: 500,
    };

    return priorityMap[nodeType] ?? priorityMap.default ?? 500;
  }

  /**
   * Infer dependencies based on conventions
   */
  private inferDependencies(nodeType: NodeType): NodeType[] {
    // Most plugins extend folder-plugin, so depend on it
    const extendsFolderTypes = ['basemap', 'shape', 'stylemap', 'spreadsheet', 'project'];

    if (extendsFolderTypes.includes(nodeType)) {
      return ['folder'];
    }

    // Special cases
    switch (nodeType) {
      case 'folder':
        return []; // Base type, no dependencies
      default:
        return [];
    }
  }

  /**
   * Infer extends relationship based on conventions
   */
  private inferExtends(nodeType: NodeType): NodeType | undefined {
    const extendsFolderTypes = ['basemap', 'shape', 'stylemap', 'spreadsheet', 'project'];

    if (extendsFolderTypes.includes(nodeType)) {
      return 'folder';
    }

    return undefined;
  }

  /**
   * Helper to capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Convert node type to human-readable name
   */
  private humanizeNodeType(nodeType: NodeType): string {
    return nodeType
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Create error result
   */
  private createErrorResult(
    discovered: DiscoveredPlugin[],
    errors: string[],
    timing: any
  ): DynamicRegistrationResult {
    return {
      success: false,
      discovered,
      registered: [],
      skipped: [],
      errors,
      loadOrder: [],
      report: {
        discoveryReport: this.discoveryService.generateReport(),
        dependencyGraph: { nodes: [], edges: [] },
        timing,
      },
    };
  }

  /**
   * Get registered plugins
   */
  getRegisteredPlugins(): NodeType[] {
    return Array.from(this.registeredPlugins);
  }

  /**
   * Check if a plugin is registered
   */
  isRegistered(nodeType: NodeType): boolean {
    return this.registeredPlugins.has(nodeType);
  }

  /**
   * Get plugin module
   */
  getPluginModule(nodeType: NodeType): any {
    return this.pluginModules.get(nodeType);
  }

  /**
   * Generate comprehensive report
   */
  generateReport(): any {
    return {
      discovered: this.discoveryService.generateReport(),
      registered: Array.from(this.registeredPlugins),
      modules: Array.from(this.pluginModules.keys()),
      dependencyGraph: this.dependencyResolver.exportGraph(),
    };
  }

  /**
   * Reset registry state
   */
  reset(): void {
    this.registeredPlugins.clear();
    this.pluginModules.clear();
    this.dependencyResolver.clear();
  }
}

/**
 * Singleton instance for dynamic plugin registry
 */
export const dynamicPluginRegistry = new DynamicPluginRegistry();
