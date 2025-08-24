import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';
import { UnifiedNodeTypeRegistry, IUnifiedNodeTypeRegistry } from '../registry/UnifiedNodeTypeRegistry';
import { registerSpreadsheetPlugin } from './SpreadsheetPlugin';
import { registerStyleMapPlugin } from './StyleMapPlugin';
import { workerLog, workerError } from '../utils/workerLogger';

/**
 * PluginManager handles plugin initialization and registration
 * Manages the lifecycle of all plugins in the Worker
 */
export class PluginManager {
  private registry: IUnifiedNodeTypeRegistry;
  private coreDB: CoreDB;
  private ephemeralDB: EphemeralDB;
  private initialized = false;

  constructor(coreDB: CoreDB, ephemeralDB: EphemeralDB) {
    this.coreDB = coreDB;
    this.ephemeralDB = ephemeralDB;
    this.registry = UnifiedNodeTypeRegistry.getInstance();
  }

  /**
   * Initialize all plugins
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      workerLog('PluginManager already initialized');
      return;
    }

    try {
      workerLog('Initializing PluginManager...');
      
      // Register core plugins in dependency order
      await this.registerCorePlugins();
      
      // Validate all plugin dependencies
      this.validateAllDependencies();
      
      this.initialized = true;
      workerLog(`PluginManager initialized with ${this.registry.getAllPlugins().length} plugins`);
      
    } catch (error) {
      workerError('Failed to initialize PluginManager:', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Register core plugins that come with HierarchiDB
   */
  private async registerCorePlugins(): Promise<void> {
    try {
      // Register Spreadsheet plugin first (base plugin)
      workerLog('Registering Spreadsheet plugin...');
      registerSpreadsheetPlugin(this.registry);
      
      // Register StyleMap plugin (depends on Spreadsheet)
      workerLog('Registering StyleMap plugin...');
      registerStyleMapPlugin(this.registry);
      
      workerLog('Core plugins registered successfully');
      
    } catch (error) {
      workerError('Failed to register core plugins:', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Validate all plugin dependencies
   */
  private validateAllDependencies(): void {
    const plugins = this.registry.getAllPlugins();
    const invalidPlugins: string[] = [];

    for (const plugin of plugins) {
      if (!this.registry.validatePluginDependencies(plugin.nodeType)) {
        invalidPlugins.push(plugin.nodeType);
      }
    }

    if (invalidPlugins.length > 0) {
      throw new Error(`Invalid plugin dependencies: ${invalidPlugins.join(', ')}`);
    }

    workerLog('All plugin dependencies validated successfully');
  }

  /**
   * Get the plugin registry
   */
  getRegistry(): IUnifiedNodeTypeRegistry {
    return this.registry;
  }

  /**
   * Check if plugin manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get plugin information for debugging
   */
  getPluginInfo(): Array<{
    nodeType: string;
    name: string;
    version?: string;
    dependencies?: string[];
    hasHandler: boolean;
    actionCount: number;
  }> {
    return this.registry.getAllPlugins().map(plugin => ({
      nodeType: plugin.nodeType,
      name: plugin.name,
      version: plugin.meta?.version,
      dependencies: plugin.meta?.dependencies,
      hasHandler: !!plugin.entityHandler,
      actionCount: plugin.routing?.actions ? Object.keys(plugin.routing.actions).length : 0
    }));
  }

  /**
   * Execute plugin action
   */
  async executePluginAction(
    nodeType: string, 
    action: string, 
    ...args: any[]
  ): Promise<any> {
    if (!this.initialized) {
      throw new Error('PluginManager not initialized');
    }

    const routerAction = this.registry.getRouterAction(nodeType, action);
    if (!routerAction) {
      throw new Error(`Action '${action}' not found for plugin '${nodeType}'`);
    }

    try {
      // Check if routerAction is a function or an object with action property
      if (typeof routerAction === 'function') {
        return await routerAction(...args);
      } else if (routerAction.action && typeof routerAction.action === 'function') {
        return await (routerAction.action as Function)(...args);
      } else {
        throw new Error(`Action '${action}' has no implementation for plugin '${nodeType}'`);
      }
    } catch (error) {
      workerError(`Failed to execute action '${action}' for plugin '${nodeType}':`, error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Get available actions for a node type
   */
  getAvailableActions(nodeType: string): string[] {
    return this.registry.getAvailableActions(nodeType);
  }

  /**
   * Check if a node type supports a specific action
   */
  supportsAction(nodeType: string, action: string): boolean {
    return this.registry.getRouterAction(nodeType, action) !== undefined;
  }

  /**
   * Cleanup plugin manager
   */
  cleanup(): void {
    // Clean up any resources if needed
    this.initialized = false;
    workerLog('PluginManager cleaned up');
  }
}

/**
 * Global plugin manager instance
 */
let globalPluginManager: PluginManager | null = null;

/**
 * Initialize global plugin manager
 */
export async function initializePluginManager(
  coreDB: CoreDB, 
  ephemeralDB: EphemeralDB
): Promise<PluginManager> {
  if (!globalPluginManager) {
    globalPluginManager = new PluginManager(coreDB, ephemeralDB);
    await globalPluginManager.initialize();
  }
  return globalPluginManager;
}

/**
 * Get global plugin manager instance
 */
export function getPluginManager(): PluginManager {
  if (!globalPluginManager) {
    throw new Error('PluginManager not initialized. Call initializePluginManager first.');
  }
  return globalPluginManager;
}

/**
 * Cleanup global plugin manager
 */
export function cleanupPluginManager(): void {
  if (globalPluginManager) {
    globalPluginManager.cleanup();
    globalPluginManager = null;
  }
}