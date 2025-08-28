/**
 * Plugin Auto-Registration System for Import/Export
 * 
 * Automatically registers all required node type plugins with proper dependency resolution.
 * Ensures plugins are loaded in the correct order based on their dependencies.
 */

import { PluginDependencyResolver } from '@hierarchidb/common-core';

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
import type { NodeType } from '@hierarchidb/common-core';

// Import all required node type plugins
// TODO: These imports cause circular dependencies - need to be loaded dynamically
// import { FolderDefinition } from '@hierarchidb/node-type-folder-plugin-plugin';
// import { BaseMapDefinition } from '@hierarchidb/node-type-basemap-plugin';
// import { ShapeDefinition } from '@hierarchidb/node-type-shape-plugin-plugin';
// import { StyleMapDefinition } from '@hierarchidb/node-type-stylemap-plugin-plugin';
// import { SpreadsheetDefinition } from '@hierarchidb/node-type-spreadsheet-plugin';

/**
 * Plugin metadata configuration for Import/Export required plugins
 */
export const IMPORT_EXPORT_PLUGIN_METADATA: PluginMetadata[] = [
  // Base folder-plugin plugin - no dependencies
  {
    nodeType: 'folder',
    name: 'Folder',
    version: '1.0.0',
    priority: 1000, // Highest priority as base plugin
    dependencies: [],
    description: 'Basic folder-plugin functionality for hierarchical organization',
    category: 'core',
  },

  // BaseMap extends folder-plugin
  {
    nodeType: 'basemap',
    name: 'BaseMap',
    version: '1.0.0',
    priority: 900,
    extends: 'folder',
    dependencies: ['folder'],
    description: 'Geographic base layer management and configuration',
    category: 'geographic',
  },

  // Shape extends folder-plugin
  {
    nodeType: 'shape',
    name: 'Shape',
    version: '1.0.0',
    priority: 800,
    extends: 'folder',
    dependencies: ['folder'],
    description: 'Geographic shape-plugin data management and processing',
    category: 'geographic',
  },

  // StyleMap extends folder-plugin
  {
    nodeType: 'stylemap',
    name: 'StyleMap',
    version: '1.0.0',
    priority: 700,
    extends: 'folder',
    dependencies: ['folder'],
    description: 'Map styling and visualization configuration',
    category: 'styling',
  },

  // Spreadsheet extends folder-plugin
  {
    nodeType: 'spreadsheet',
    name: 'Spreadsheet',
    version: '1.0.0',
    priority: 600,
    extends: 'folder',
    dependencies: ['folder'],
    description: 'Tabular data management and analysis',
    category: 'data',
  },
];

/**
 * Plugin definition registry mapping
 */
export const PLUGIN_DEFINITIONS = {
  // TODO: These definitions are not available due to circular dependency issues
  // folder-plugin: FolderDefinition,
  // basemap: BaseMapDefinition,
  // shape-plugin: ShapeDefinition,
  // stylemap-plugin: StyleMapDefinition,
  // spreadsheet-plugin: SpreadsheetDefinition,
} as const;

/**
 * Auto-registration system for Import/Export plugins
 */
export class ImportExportPluginRegistry {
  private resolver: PluginDependencyResolver;
  private registeredPlugins: Set<NodeType> = new Set();

  constructor() {
    this.resolver = new PluginDependencyResolver();
    this.initializePluginMetadata();
  }

  /**
   * Initialize plugin metadata in the resolver
   */
  private initializePluginMetadata(): void {
    this.resolver.registerPlugins(IMPORT_EXPORT_PLUGIN_METADATA);
  }

  /**
   * Get plugin registration order based on dependencies
   */
  getRegistrationOrder(): { success: boolean; order: NodeType[]; errors: string[] } {
    const result = this.resolver.resolve();
    
    if (!result.success) {
      return {
        success: false,
        order: [],
        errors: result.errors.map((e: any) => e.message),
      };
    }

    return {
      success: true,
      order: result.resolvedOrder.map((p: any) => p.nodeType),
      errors: [],
    };
  }

  /**
   * Register all plugins in the correct order
   */
  async registerAllPlugins(registry: any): Promise<{ success: boolean; registered: NodeType[]; errors: string[] }> {
    const orderResult = this.getRegistrationOrder();
    
    if (!orderResult.success) {
      return {
        success: false,
        registered: [],
        errors: orderResult.errors,
      };
    }

    const registered: NodeType[] = [];
    const errors: string[] = [];

    for (const nodeType of orderResult.order) {
      try {
        await this.registerSinglePlugin(nodeType, registry);
        registered.push(nodeType);
        this.registeredPlugins.add(nodeType);
        
        console.log(`[ImportExportPluginRegistry] Successfully registered plugin: ${nodeType}`);
      } catch (error) {
        const errorMessage = `Failed to register plugin ${nodeType}: ${error}`;
        errors.push(errorMessage);
        console.error(`[ImportExportPluginRegistry] ${errorMessage}`, error);
      }
    }

    return {
      success: errors.length === 0,
      registered,
      errors,
    };
  }

  /**
   * Register a single plugin with dependency validation
   */
  private async registerSinglePlugin(nodeType: NodeType, registry: any): Promise<void> {
    // Check if plugin is already registered
    if (this.registeredPlugins.has(nodeType)) {
      console.log(`[ImportExportPluginRegistry] Plugin ${nodeType} already registered, skipping`);
      return;
    }

    // Check if dependencies are satisfied
    const dependencies = this.resolver.getAllDependencies(nodeType);
    for (const dep of dependencies) {
      if (!this.registeredPlugins.has(dep)) {
        throw new Error(`Dependency ${dep} not registered before ${nodeType}`);
      }
    }

    // Get plugin definition
    const definition = PLUGIN_DEFINITIONS[nodeType as keyof typeof PLUGIN_DEFINITIONS];
    if (!definition) {
      throw new Error(`Plugin definition not found for ${nodeType}`);
    }

    // Register with the provided registry
    if (typeof registry.register === 'function') {
      await registry.register(definition);
    } else if (typeof registry.registerDefinition === 'function') {
      await registry.registerDefinition(definition);
    } else {
      throw new Error(`Registry does not have a register method`);
    }
  }

  /**
   * Check if a plugin can be safely imported/exported
   */
  canProcessNodeType(nodeType: NodeType): boolean {
    return this.registeredPlugins.has(nodeType);
  }

  /**
   * Get list of supported node types for import/export
   */
  getSupportedNodeTypes(): NodeType[] {
    return Array.from(this.registeredPlugins);
  }

  /**
   * Get plugin metadata for a specific node type
   */
  getPluginMetadata(nodeType: NodeType): PluginMetadata | undefined {
    return IMPORT_EXPORT_PLUGIN_METADATA.find(p => p.nodeType === nodeType);
  }

  /**
   * Get dependency graph for visualization/debugging
   */
  getDependencyGraph(): { nodes: any[], edges: any[] } {
    return this.resolver.exportGraph();
  }

  /**
   * Validate that all required plugins are registered
   */
  validateRegistration(): { valid: boolean; missing: NodeType[]; errors: string[] } {
    const requiredPlugins = IMPORT_EXPORT_PLUGIN_METADATA.map(p => p.nodeType);
    const missing = requiredPlugins.filter(plugin => !this.registeredPlugins.has(plugin));
    
    const errors: string[] = [];
    if (missing.length > 0) {
      errors.push(`Missing required plugins: ${missing.join(', ')}`);
    }

    return {
      valid: missing.length === 0,
      missing,
      errors,
    };
  }

  /**
   * Reset registration state
   */
  reset(): void {
    this.registeredPlugins.clear();
  }

  /**
   * Generate registration report
   */
  generateReport(): {
    totalPlugins: number;
    registeredPlugins: number;
    registeredList: NodeType[];
    dependencyGraph: { nodes: any[], edges: any[] };
    metadata: PluginMetadata[];
  } {
    return {
      totalPlugins: IMPORT_EXPORT_PLUGIN_METADATA.length,
      registeredPlugins: this.registeredPlugins.size,
      registeredList: Array.from(this.registeredPlugins),
      dependencyGraph: this.getDependencyGraph(),
      metadata: IMPORT_EXPORT_PLUGIN_METADATA,
    };
  }
}

/**
 * Singleton instance for Import/Export plugin registry
 */
export const importExportPluginRegistry = new ImportExportPluginRegistry();