/**
 * @file PluginManagementAPI.ts
 * @description Plugin lifecycle management API
 *
 * This API handles plugin registration, unregistration, validation, and health monitoring.
 * It's focused on the management aspects of plugins, separated from node type queries.
 */

import type { NodeType, PluginDefinition } from '@hierarchidb/common-type';

//  :
//  :
export interface PluginRegistrationResult {
  success: boolean;
  pluginId?: string;
  registeredNodeType?: NodeType;
  error?: {
    code: string;
    message: string;
  };
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface UnregistrationResult {
  success: boolean;
  unregisteredNodeType?: NodeType;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
  };
}

export interface PluginValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

export interface PluginHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  issues?: string[];
  performance: {
    avgResponseTime: number;
    errorRate: number;
  };
}

export interface PluginRegistrationInfo {
  nodeType: NodeType;
  meta: {
    name: string;
    version: string;
    category?: string;
  };
  registrationTime: number;
  healthStatus: PluginHealthStatus;
}

export interface PluginListOptions {
  status?: 'healthy' | 'degraded' | 'unhealthy';
  category?: string;
}

export interface PluginDependencyInfo {
  nodeType: NodeType;
  dependencies: NodeType[];
  dependents: NodeType[];
  circularDependencies: boolean;
  warnings?: string[];
}

export interface BulkOperationOptions {
  operation: 'register' | 'unregister';
  plugins?: PluginDefinition[]; // Added for bulk registration
  nodeTypes?: NodeType[];
}

export interface BulkOperationResult {
  successful: Array<{
    nodeType: NodeType;
    result: any;
  }>;
  failed: Array<{
    nodeType: NodeType;
    error: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export interface PluginResetOptions {
  nodeType: NodeType;
  resetMode: 'individual' | 'folder' | 'system';
  createBackup?: boolean;
}

export interface PluginResetResult {
  success: boolean;
  nodeType: NodeType;
  deletedEntities: {
    groupEntities?: number;
    relationalEntities?: number;
    treeNodes?: number; // Only for folder-plugin/system reset
    peerEntities?: number; // Only for folder-plugin/system reset
  };
  backupLocation?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PluginDeleteResult {
  success: boolean;
  nodeType: NodeType;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Plugin lifecycle management API
 *
 * Provides comprehensive plugin management functionality including registration,
 * validation, health monitoring, and dependency management.
 *
 * @example
 * ```typescript
 * const pluginMgmtAPI = workerAPI.getPluginManagementAPI();
 *
 * // Register a new plugin
 * const result = await pluginMgmtAPI.register(myPluginDefinition);
 *
 * // Check plugin health
 * const health = await pluginMgmtAPI.checkHealth('folder-plugin');
 * ```
 */
export interface PluginLifecycleAPI {
  // ==================
  // Core Plugin Lifecycle Operations
  // ==================

  /**
      * :
   * : register()//
   * :
   * @param definition -
   * @returns ID
      */
  register(definition: PluginDefinition): Promise<PluginRegistrationResult>;

  /**
      * :
   * : unregister()//
   * :
   * @param nodeType -
   * @returns
      */
  unregister(nodeType: NodeType): Promise<UnregistrationResult>;

  /**
      * :
   * : validatePlugin()/
   * :
   * @param definition -
   * @returns
      */
  validatePlugin(definition: PluginDefinition): Promise<PluginValidationResult>;

  /**
      * :
   * : checkHealth()//
   * :
   * @param nodeType -
   * @returns
      */
  checkHealth(nodeType: NodeType): Promise<PluginHealthStatus>;

  /**
      * :
   * : listRegistered()/
   * :
   * @param options -
   * @returns
      */
  listRegistered(options?: PluginListOptions): Promise<PluginRegistrationInfo[]>;

  /**
      * :
   * : getDependencies()/
   * :
   * @param nodeType -
   * @returns
      */
  getDependencies(nodeType: NodeType): Promise<PluginDependencyInfo>;

  /**
      * :
   * : bulkOperation()//
   * :
   * @param options -
   * @returns
      */
  bulkOperation(options: BulkOperationOptions): Promise<BulkOperationResult>;

  // ==================
  // Plugin Reset and Delete Operations
  // ==================

  /**
      * :
   * :
   * - individual mode: GroupEntity, RelationalEntityTreeNode, PeerEntity
   * - folder-plugin mode:
   * - system mode:
   * : resetPlugin()/
   * :
   * @param options -
   * @returns
      */
  resetPlugin(options: PluginResetOptions): Promise<PluginResetResult>;

  /**
      * :
   * :
   * - folder
   * -
   * : deletePlugin()//
   * :
   * @param nodeType -
   * @returns
      */
  deletePlugin(nodeType: NodeType): Promise<PluginDeleteResult>;

  /**
      * :
   * :
   * : resetSystem()
   * :
   * @param createBackup -
   * @returns
      */
  resetSystem(createBackup?: boolean): Promise<PluginResetResult>;
}

/**
 * Default export for the PluginLifecycleAPI interface
 */
export default PluginLifecycleAPI;
