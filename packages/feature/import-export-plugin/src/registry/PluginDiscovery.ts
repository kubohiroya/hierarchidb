/**
 * Dynamic Plugin Discovery System
 * 
 * Automatically discovers and loads plugins from package.json dependencies.
 * Uses multiple strategies for plugin discovery:
 * 1. Package.json analysis
 * 2. Convention-based naming
 * 3. Module exports analysis
 * 4. Plugin manifest files
 */

import type { NodeType } from '@hierarchidb/common-core';
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

// Package.json will be loaded dynamically to avoid rootDir issues

/**
 * Plugin discovery configuration
 */
export interface DiscoveryConfig {
  // Package name patterns that identify plugins
  pluginPatterns: RegExp[];
  // Required export names for valid plugins
  requiredExports: string[];
  // Plugin manifest filename
  manifestFile: string;
  // Enable dynamic imports
  useDynamicImport: boolean;
}

/**
 * Discovered plugin information
 */
export interface DiscoveredPlugin {
  packageName: string;
  nodeType: NodeType;
  metadata?: PluginMetadata;
  module?: any;
  manifestPath?: string;
  source: 'package.json' | 'manifest' | 'convention' | 'export';
}

/**
 * Plugin manifest structure
 */
export interface PluginManifest {
  nodeType: NodeType;
  name: string;
  version: string;
  priority?: number;
  extends?: NodeType;
  dependencies?: NodeType[];
  exports: {
    definition: string;
    handler?: string;
    components?: string[];
  };
}

/**
 * Default discovery configuration for HierarchiDB plugins
 */
export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  pluginPatterns: [
    /^@hierarchidb\/node-type-.*-plugin$/,
    /^@hierarchidb\/feature-.*-plugin$/,
    /^@hierarchidb\/.*-plugin$/,
    /^hierarchidb-plugin-/,
  ],
  requiredExports: ['Definition', 'Handler', 'Plugin'],
  manifestFile: 'plugin.manifest.json',
  useDynamicImport: true,
};

/**
 * Plugin Discovery Service
 */
export class PluginDiscoveryService {
  private config: DiscoveryConfig;
  private discoveredPlugins: Map<string, DiscoveredPlugin> = new Map();
  private loadedModules: Map<string, any> = new Map();

  constructor(config: Partial<DiscoveryConfig> = {}) {
    this.config = { ...DEFAULT_DISCOVERY_CONFIG, ...config };
  }

  /**
   * Load package dependencies without importing package.json directly
   */
  private async loadPackageDependencies(): Promise<Record<string, string>> {
    // For now, return known dependencies to avoid rootDir issues
    // In a real implementation, this could use fs.readFile or other methods
    return {
      '@hierarchidb/node-type-folder-plugin': 'workspace:*',
      '@hierarchidb/node-type-basemap-plugin': 'workspace:*',
      '@hierarchidb/node-type-shape-plugin': 'workspace:*',
      '@hierarchidb/node-type-stylemap-plugin': 'workspace:*',
      '@hierarchidb/node-type-spreadsheet-plugin': 'workspace:*',
    };
  }

  /**
   * Discover all available plugins from package.json
   */
  async discoverPlugins(): Promise<DiscoveredPlugin[]> {
    const plugins: DiscoveredPlugin[] = [];

    // Strategy 1: Analyze package.json dependencies
    const fromPackageJson = await this.discoverFromPackageJson();
    plugins.push(...fromPackageJson);

    // Strategy 2: Look for plugin manifest files
    const fromManifests = await this.discoverFromManifests(fromPackageJson);
    plugins.push(...fromManifests);

    // Strategy 3: Analyze module exports
    const fromExports = await this.discoverFromExports(fromPackageJson);
    plugins.push(...fromExports);

    // Deduplicate and merge plugin information
    const merged = this.mergeDiscoveredPlugins(plugins);
    
    // Store discovered plugins
    for (const plugin of merged) {
      this.discoveredPlugins.set(plugin.packageName, plugin);
    }

    return merged;
  }

  /**
   * Strategy 1: Discover plugins from package.json dependencies
   */
  private async discoverFromPackageJson(): Promise<DiscoveredPlugin[]> {
    const plugins: DiscoveredPlugin[] = [];
    
    // Combine all dependency types
    const allDependencies = await this.loadPackageDependencies();

    for (const [packageName] of Object.entries(allDependencies)) {
      // Check if package name matches plugin patterns
      const isPlugin = this.config.pluginPatterns.some(pattern => 
        pattern.test(packageName)
      );

      if (isPlugin) {
        // Extract node type from package name
        const nodeType = this.extractNodeTypeFromPackageName(packageName);
        
        plugins.push({
          packageName,
          nodeType,
          source: 'package.json',
        });
      }
    }

    return plugins;
  }

  /**
   * Strategy 2: Discover plugins from manifest files
   */
  private async discoverFromManifests(candidates: DiscoveredPlugin[]): Promise<DiscoveredPlugin[]> {
    const plugins: DiscoveredPlugin[] = [];

    for (const candidate of candidates) {
      try {
        // Try to load plugin manifest
        const manifest = await this.loadPluginManifest(candidate.packageName);
        
        if (manifest) {
          plugins.push({
            ...candidate,
            nodeType: manifest.nodeType,
            metadata: {
              nodeType: manifest.nodeType,
              name: manifest.name,
              version: manifest.version,
              priority: manifest.priority,
              dependencies: manifest.dependencies,
              extends: manifest.extends,
            },
            manifestPath: `${candidate.packageName}/${this.config.manifestFile}`,
            source: 'manifest',
          });
        }
      } catch (error) {
        // Manifest not found or invalid, skip
        console.debug(`No manifest found for ${candidate.packageName}`);
      }
    }

    return plugins;
  }

  /**
   * Strategy 3: Discover plugins by analyzing module exports
   */
  private async discoverFromExports(candidates: DiscoveredPlugin[]): Promise<DiscoveredPlugin[]> {
    const plugins: DiscoveredPlugin[] = [];

    for (const candidate of candidates) {
      try {
        // Load module and analyze exports
        const moduleExports = await this.loadPluginModule(candidate.packageName);
        
        if (moduleExports) {
          // Check for required exports
          const hasRequiredExports = this.config.requiredExports.some(exportName =>
            this.hasExport(moduleExports, exportName)
          );

          if (hasRequiredExports) {
            // Extract metadata from module
            const metadata = this.extractMetadataFromModule(moduleExports);
            
            plugins.push({
              ...candidate,
              module: moduleExports,
              metadata,
              source: 'export',
            });
          }
        }
      } catch (error) {
        console.debug(`Failed to load module ${candidate.packageName}:`, error);
      }
    }

    return plugins;
  }

  /**
   * Load plugin manifest file
   */
  private async loadPluginManifest(packageName: string): Promise<PluginManifest | null> {
    if (!this.config.useDynamicImport) {
      // Static import fallback
      return this.loadManifestStatic(packageName);
    }

    try {
      // Dynamic import of manifest file
      const manifestPath = `${packageName}/${this.config.manifestFile}`;
      const manifest = await import(manifestPath);
      return manifest.default || manifest;
    } catch (error) {
      return null;
    }
  }

  /**
   * Load plugin module dynamically
   */
  private async loadPluginModule(packageName: string): Promise<any> {
    // Check cache
    if (this.loadedModules.has(packageName)) {
      return this.loadedModules.get(packageName);
    }

    if (!this.config.useDynamicImport) {
      // Static import fallback
      return this.loadModuleStatic(packageName);
    }

    try {
      // Dynamic import
      const module = await import(packageName);
      this.loadedModules.set(packageName, module);
      return module;
    } catch (error) {
      console.error(`Failed to dynamically import ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Static import fallback for known plugins
   */
  private loadModuleStatic(packageName: string): any {
    // Map of known plugins for static import
    const staticImports: Record<string, () => Promise<any>> = {
      // TODO: These imports cause circular dependencies - need to be loaded dynamically
      // '@hierarchidb/node-type-folder-plugin-plugin': () =>
      //   import('@hierarchidb/node-type-folder-plugin-plugin'),
      // '@hierarchidb/node-type-basemap-plugin': () => 
      //   import('@hierarchidb/node-type-basemap-plugin'),
      // '@hierarchidb/node-type-shape-plugin-plugin': () =>
      //   import('@hierarchidb/node-type-shape-plugin-plugin'),
      // '@hierarchidb/node-type-stylemap-plugin-plugin': () =>
      //   import('@hierarchidb/node-type-stylemap-plugin-plugin'),
      // '@hierarchidb/node-type-spreadsheet-plugin': () =>
      //   import('@hierarchidb/node-type-spreadsheet-plugin'),
    };

    const loader = staticImports[packageName];
    if (loader) {
      return loader().then(module => {
        this.loadedModules.set(packageName, module);
        return module;
      });
    }

    return null;
  }

  /**
   * Static manifest loading for known plugins
   */
  private loadManifestStatic(packageName: string): PluginManifest | null {
    // Pre-defined manifests for known plugins
    const staticManifests: Record<string, PluginManifest> = {
      '@hierarchidb/node-type-folder-plugin': {
        nodeType: 'folder',
        name: 'Folder',
        version: '1.0.0',
        priority: 1000,
        exports: {
          definition: 'FolderDefinition',
          handler: 'FolderHandler',
        },
      },
      '@hierarchidb/node-type-basemap-plugin': {
        nodeType: 'basemap',
        name: 'BaseMap',
        version: '1.0.0',
        priority: 900,
        extends: 'folder',
        dependencies: ['folder'],
        exports: {
          definition: 'BaseMapDefinition',
          handler: 'BaseMapHandler',
        },
      },
      // ... other static manifests
    };

    return staticManifests[packageName] || null;
  }

  /**
   * Extract node type from package name using conventions
   */
  private extractNodeTypeFromPackageName(packageName: string): NodeType {
    // Remove scope and common prefixes/suffixes
    let nodeType = packageName
      .replace(/@[^/]+\//, '') // Remove scope
      .replace(/^node-type-/, '') // Remove node-type prefix
      .replace(/-plugin$/, '') // Remove plugin suffix
      .replace(/^plugin-/, ''); // Remove plugin prefix

    return nodeType as NodeType;
  }

  /**
   * Check if module has a specific export
   */
  private hasExport(module: any, exportName: string): boolean {
    if (!module) return false;
    
    // Check direct export
    if (module[exportName]) return true;
    
    // Check variations (Definition, definition, DEFINITION)
    const variations = [
      exportName,
      exportName.toLowerCase(),
      exportName.toUpperCase(),
      exportName.charAt(0).toUpperCase() + exportName.slice(1),
    ];

    return variations.some(variant => 
      variant in module || `${variant}Definition` in module || `${variant}Plugin` in module
    );
  }

  /**
   * Extract metadata from loaded module
   */
  private extractMetadataFromModule(module: any): PluginMetadata | undefined {
    // Look for metadata in various locations
    const metadataKeys = ['metadata', 'METADATA', 'pluginMetadata', 'META'];
    
    for (const key of metadataKeys) {
      if (module[key]) {
        return module[key];
      }
    }

    // Try to extract from definition
    const definitionKeys = ['Definition', 'definition', 'default'];
    for (const key of definitionKeys) {
      const definition = module[key];
      if (definition?.nodeType) {
        return {
          nodeType: definition.nodeType,
          name: definition.name || definition.displayName,
          version: definition.version || '1.0.0',
          priority: definition.priority,
          dependencies: definition.dependencies,
          extends: definition.extends,
        };
      }
    }

    return undefined;
  }

  /**
   * Merge and deduplicate discovered plugins
   */
  private mergeDiscoveredPlugins(plugins: DiscoveredPlugin[]): DiscoveredPlugin[] {
    const merged = new Map<string, DiscoveredPlugin>();

    // Priority: manifest > export > package.json
    const priorityOrder = ['manifest', 'export', 'package.json'];

    for (const plugin of plugins) {
      const existing = merged.get(plugin.packageName);
      
      if (!existing) {
        merged.set(plugin.packageName, plugin);
      } else {
        // Merge based on source priority
        const existingPriority = priorityOrder.indexOf(existing.source);
        const newPriority = priorityOrder.indexOf(plugin.source);
        
        if (newPriority < existingPriority) {
          // New plugin has higher priority
          merged.set(plugin.packageName, {
            ...existing,
            ...plugin,
            metadata: plugin.metadata || existing.metadata,
          });
        } else if (plugin.metadata && !existing.metadata) {
          // Update metadata if missing
          existing.metadata = plugin.metadata;
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Get all discovered plugins
   */
  getDiscoveredPlugins(): DiscoveredPlugin[] {
    return Array.from(this.discoveredPlugins.values());
  }

  /**
   * Get plugin by package name
   */
  getPlugin(packageName: string): DiscoveredPlugin | undefined {
    return this.discoveredPlugins.get(packageName);
  }

  /**
   * Load and instantiate a plugin
   */
  async loadPlugin(packageName: string): Promise<any> {
    const plugin = this.discoveredPlugins.get(packageName);
    if (!plugin) {
      throw new Error(`Plugin ${packageName} not discovered`);
    }

    if (plugin.module) {
      return plugin.module;
    }

    const module = await this.loadPluginModule(packageName);
    plugin.module = module;
    return module;
  }

  /**
   * Generate discovery report
   */
  generateReport(): {
    total: number;
    discovered: string[];
    bySource: Record<string, number>;
    withMetadata: number;
    loaded: number;
  } {
    const plugins = Array.from(this.discoveredPlugins.values());
    
    return {
      total: plugins.length,
      discovered: plugins.map(p => p.packageName),
      bySource: plugins.reduce((acc, p) => {
        acc[p.source] = (acc[p.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      withMetadata: plugins.filter(p => p.metadata).length,
      loaded: plugins.filter(p => p.module).length,
    };
  }
}