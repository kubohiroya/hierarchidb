/**
import type { NodeType, PluginDatabaseConfig, PeerEntity, GroupEntity, WorkingCopyProperties } from '@hierarchidb/common-type';
 * @file PluginDatabaseManager.ts
 * @description Manages dynamic Dexie database creation for plugins
 */

import Dexie, { Table } from 'dexie';

/**
 * Plugin-specific database instance
 */
export class PluginDatabase extends Dexie {
  // Dynamic tables - will be populated based on plugin schema
  [tableName: string]: any;

  constructor(
    public readonly pluginNodeType: NodeType,
    public readonly config: PluginDatabaseConfig
  ) {
    // Use plugin-specific database name
    super(`HierarchiDB-${pluginNodeType}-${config.version}`);
    
    this.setupSchema();
  }

  /**
   * Setup database schema based on plugin configuration
   */
  private setupSchema(): void {
    const { schema, version } = this.config;
    
    // Convert schema object to Dexie schema string
    const dexieSchema: { [tableName: string]: string } = {};
    
    if (typeof schema === 'object' && schema !== null) {
      // Extract table name from config
      const tableName = this.config.tableName || `${this.pluginNodeType}_entities`;
      
      // Convert schema object to Dexie format
      const schemaEntries = Object.entries(schema);
      const schemaString = schemaEntries
        .map(([key, value]) => `${key}${value ? `, ${value}` : ''}`)
        .join(', ');
      
      dexieSchema[tableName] = schemaString;
    } else if (typeof schema === 'string') {
      // Direct Dexie schema string
      const tableName = this.config.tableName || `${this.pluginNodeType}_entities`;
      dexieSchema[tableName] = schema;
    }

    // Setup version with schema
    this.version(version).stores(dexieSchema);

    // Create table properties
    Object.keys(dexieSchema).forEach(tableName => {
      if (!this[tableName]) {
        // Dynamic table creation
        Object.defineProperty(this, tableName, {
          get: () => this.table(tableName),
          enumerable: true,
          configurable: true
        });
      }
    });
  }

  /**
   * Get main entity table for this plugin
   */
  getEntityTable<T = any>(): Table<T, string> {
    const tableName = this.config.tableName || `${this.pluginNodeType}_entities`;
    return this.table(tableName);
  }

  /**
   * Clean all data from plugin tables
   */
  async clearAllData(): Promise<void> {
    const tableNames = this.tables.map(table => table.name);
    
    await this.transaction('rw', this.tables, async () => {
      for (const tableName of tableNames) {
        await this.table(tableName).clear();
      }
    });
  }

  /**
   * Drop database completely
   */
  async dropDatabase(): Promise<void> {
    await this.delete();
  }
}

/**
 * Manager for plugin databases
 */
export class PluginDatabaseManager {
  private static instance: PluginDatabaseManager;
  private databases: Map<NodeType, PluginDatabase> = new Map();
  private dependencies: Map<NodeType, Set<NodeType>> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PluginDatabaseManager {
    if (!PluginDatabaseManager.instance) {
      PluginDatabaseManager.instance = new PluginDatabaseManager();
    }
    return PluginDatabaseManager.instance;
  }

  /**
   * Register a plugin database
   */
  async registerPluginDatabase(
    nodeType: NodeType,
    config: PluginDatabaseConfig,
    dependencies?: NodeType[]
  ): Promise<PluginDatabase> {
    // Check if database already exists
    if (this.databases.has(nodeType)) {
      throw new Error(`Database for plugin ${nodeType} is already registered`);
    }

    // Validate dependencies exist
    if (dependencies?.length) {
      for (const dep of dependencies) {
        if (!this.databases.has(dep)) {
          throw new Error(`Dependency plugin ${dep} must be registered before ${nodeType}`);
        }
      }
      this.dependencies.set(nodeType, new Set(dependencies));
    }

    // Create and initialize database
    const database = new PluginDatabase(nodeType, config);
    
    try {
      await database.open();
      this.databases.set(nodeType, database);
      
      console.log(`[PluginDatabaseManager] Registered database for plugin: ${nodeType}`);
      return database;
    } catch (error) {
      console.error(`[PluginDatabaseManager] Failed to register database for ${nodeType}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a plugin database
   */
  async unregisterPluginDatabase(
    nodeType: NodeType,
    options?: {
      clearData?: boolean;
      dropDatabase?: boolean;
    }
  ): Promise<void> {
    const database = this.databases.get(nodeType);
    if (!database) {
      return; // Already unregistered
    }

    // Check for dependents
    const dependents = this.getDependents(nodeType);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister plugin ${nodeType} because it has dependents: ${dependents.join(', ')}`
      );
    }

    try {
      if (options?.clearData) {
        await database.clearAllData();
        console.log(`[PluginDatabaseManager] Cleared data for plugin: ${nodeType}`);
      }

      if (options?.dropDatabase) {
        await database.dropDatabase();
        console.log(`[PluginDatabaseManager] Dropped database for plugin: ${nodeType}`);
      } else {
        await database.close();
      }

      this.databases.delete(nodeType);
      this.dependencies.delete(nodeType);
      
      console.log(`[PluginDatabaseManager] Unregistered database for plugin: ${nodeType}`);
    } catch (error) {
      console.error(`[PluginDatabaseManager] Failed to unregister database for ${nodeType}:`, error);
      throw error;
    }
  }

  /**
   * Get plugin database
   */
  getPluginDatabase(nodeType: NodeType): PluginDatabase | undefined {
    return this.databases.get(nodeType);
  }

  /**
   * Get dependency database for a plugin
   */
  getDependencyDatabase(nodeType: NodeType, dependencyType: NodeType): PluginDatabase | undefined {
    const dependencies = this.dependencies.get(nodeType);
    if (!dependencies?.has(dependencyType)) {
      throw new Error(`Plugin ${nodeType} does not have dependency ${dependencyType}`);
    }
    
    return this.databases.get(dependencyType);
  }

  /**
   * Get all registered plugin databases
   */
  getAllDatabases(): Map<NodeType, PluginDatabase> {
    return new Map(this.databases);
  }

  /**
   * Get plugins that depend on the given plugin
   */
  private getDependents(nodeType: NodeType): NodeType[] {
    const dependents: NodeType[] = [];
    
    for (const [plugin, deps] of this.dependencies.entries()) {
      if (deps.has(nodeType)) {
        dependents.push(plugin);
      }
    }
    
    return dependents;
  }

  /**
   * Clear all databases (for testing)
   */
  async clearAll(): Promise<void> {
    const nodeTypes = Array.from(this.databases.keys());
    
    // Unregister in reverse dependency order
    for (const nodeType of nodeTypes.reverse()) {
      try {
        await this.unregisterPluginDatabase(nodeType, { dropDatabase: true });
      } catch (error) {
        console.error(`Failed to clear database for ${nodeType}:`, error);
      }
    }
  }
}