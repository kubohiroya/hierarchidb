/**
 * @file PluginIntegrationBuilder.ts
 * @description Builds integrated plugins by combining PluginDefinition with Worker implementations
 */

import type {
  PluginDefinition,
  PluginIntegrated,
  NodeType,
  EntityHandler,
  NodeLifecycleHooks,
  PluginRoutingConfig,
} from '@hierarchidb/common-type';

/**
 * Worker module exports interface
 */
interface WorkerModule {
  entityHandler?: EntityHandler;
  lifecycle?: NodeLifecycleHooks;
  routing?: PluginRoutingConfig;
  default?: EntityHandler;
  // Legacy exports for backward compatibility
  handler?: EntityHandler;
  EntityHandler?: new () => EntityHandler;
}

/**
 * PluginIntegrationBuilder class
 * Builds PluginIntegrated instances by combining static definitions with runtime implementations
 */
export class PluginIntegrationBuilder {
  private integratedPlugins = new Map<NodeType, PluginIntegrated>();

  /**
   * Build a single integrated plugin from its definition
   * @param definition Plugin definition to integrate
   * @param _loadOrder Array of node types in dependency order (not used for single plugin)
   * @returns Integrated plugin or null if failed
   */
  async buildIntegrated(
    definition: PluginDefinition,
    _loadOrder?: NodeType[]
  ): Promise<PluginIntegrated | null> {
    const { nodeType } = definition;

    try {
      // Construct package name
      const packageName = `@hierarchidb/node-type-${nodeType}-plugin`;
      
      // Try to import worker module
      const workerModule = await this.importWorkerModule(packageName);
      
      if (!workerModule) {
        console.error(`Failed to import worker module for ${packageName}`);
        return null;
      }

      // Extract entity handler
      const entityHandler = this.extractEntityHandler(workerModule, packageName);
      
      if (!entityHandler) {
        console.error(`No entity handler found for ${packageName}`);
        return null;
      }

      // Extract lifecycle hooks (optional)
      const lifecycle = workerModule.lifecycle || undefined;

      // Extract or create routing config
      const routing = workerModule.routing || this.createDefaultRouting();

      // Create integrated plugin
      const integrated: PluginIntegrated = {
        ...definition,
        entityHandler,
        lifecycle,
        routing,
      };

      return integrated;
    } catch (error) {
      console.error(`Failed to build integrated plugin for ${nodeType}:`, error);
      return null;
    }
  }

  /**
   * Build all integrated plugins from definitions
   * @param definitions Map of plugin definitions
   * @param loadOrder Array of node types in dependency order
   * @returns Map of integrated plugins
   */
  async buildAll(
    definitions: Map<NodeType, PluginDefinition>,
    loadOrder: NodeType[]
  ): Promise<Map<NodeType, PluginIntegrated>> {
    // Clear existing integrated plugins
    this.integratedPlugins.clear();

    // Process plugins in load order
    for (const nodeType of loadOrder) {
      const definition = definitions.get(nodeType);
      
      if (!definition) {
        console.warn(`No definition found for nodeType: ${nodeType}`);
        continue;
      }

      const integrated = await this.buildIntegrated(definition, loadOrder);
      
      if (integrated) {
        this.integratedPlugins.set(nodeType, integrated);
        console.log(`Successfully integrated plugin: ${nodeType}`);
      } else {
        console.error(`Failed to integrate plugin: ${nodeType}`);
      }
    }

    console.log(`Integrated ${this.integratedPlugins.size} plugins`);
    return new Map(this.integratedPlugins);
  }

  /**
   * Import worker module with fallback strategies
   * @param packageName Package name to import
   * @returns Worker module or null if failed
   */
  private async importWorkerModule(packageName: string): Promise<WorkerModule | null> {
    try {
      // Try primary worker export
      const workerPath = `${packageName}/worker`;
      const module = await import(workerPath);
      
      if (module) {
        console.log(`Successfully imported ${workerPath}`);
        return module as WorkerModule;
      }
    } catch (error) {
      console.warn(`Failed to import ${packageName}/worker, trying fallback...`);
    }

    try {
      // Fallback to default export
      const module = await import(packageName);
      
      if (module) {
        console.log(`Successfully imported ${packageName} (fallback)`);
        return module as WorkerModule;
      }
    } catch (error) {
      console.error(`Failed to import ${packageName}:`, error);
    }

    return null;
  }

  /**
   * Extract entity handler from worker module
   * @param workerModule Worker module exports
   * @param packageName Package name for error messages
   * @returns Entity handler instance or null
   */
  private extractEntityHandler(
    workerModule: WorkerModule,
    packageName: string
  ): EntityHandler | null {
    // Check for direct export
    if (workerModule.entityHandler) {
      return workerModule.entityHandler;
    }

    // Check for default export
    if (workerModule.default) {
      return workerModule.default;
    }

    // Check for legacy handler export
    if (workerModule.handler) {
      return workerModule.handler;
    }

    // Check for class export (need to instantiate)
    if (workerModule.EntityHandler) {
      try {
        return new workerModule.EntityHandler();
      } catch (error) {
        console.error(`Failed to instantiate EntityHandler for ${packageName}:`, error);
      }
    }

    return null;
  }

  /**
   * Create default routing configuration
   * @returns Default routing config
   */
  private createDefaultRouting(): PluginRoutingConfig {
    return {
      actions: {
        view: {
          path: 'view',
          componentPath: 'ViewComponent',
        },
        edit: {
          path: 'edit',
          componentPath: 'EditComponent',
        },
      },
      defaultAction: 'view',
    };
  }

  /**
   * Get integrated plugin by node type
   * @param nodeType Node type to get
   * @returns Integrated plugin or undefined
   */
  getIntegratedPlugin(nodeType: NodeType): PluginIntegrated | undefined {
    return this.integratedPlugins.get(nodeType);
  }

  /**
   * Get all integrated plugins
   * @returns Map of all integrated plugins
   */
  getAllIntegrated(): Map<NodeType, PluginIntegrated> {
    return new Map(this.integratedPlugins);
  }

  /**
   * Check if a plugin is integrated
   * @param nodeType Node type to check
   * @returns True if integrated
   */
  hasIntegratedPlugin(nodeType: NodeType): boolean {
    return this.integratedPlugins.has(nodeType);
  }

  /**
   * Get count of integrated plugins
   * @returns Number of integrated plugins
   */
  getIntegratedCount(): number {
    return this.integratedPlugins.size;
  }

  /**
   * Get list of integrated node types
   * @returns Array of integrated node types
   */
  getIntegratedNodeTypes(): NodeType[] {
    return Array.from(this.integratedPlugins.keys());
  }

  /**
   * Clear all integrated plugins
   */
  clear(): void {
    this.integratedPlugins.clear();
  }
}