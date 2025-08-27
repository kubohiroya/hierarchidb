/**
 * @file PluginManagementService.ts
 * @description Plugin lifecycle management service implementation
 */

import type {
  PluginManagementAPI,
  PluginRegistrationResult,
  UnregistrationResult,
  PluginValidationResult,
  PluginHealthStatus,
  PluginRegistrationInfo,
  PluginListOptions,
  PluginDependencyInfo,
  BulkOperationOptions,
  BulkOperationResult,
} from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-core';
import type { SimpleNodeTypeRegistry } from '../registry/SimpleNodeTypeRegistry';
import type { CoreDB } from '../db/CoreDB';
import type { TreeQueryService } from './TreeQueryService';
import {
  isNodeTypeRegistered,
  getPluginDefinition,
  getRegisteredPlugins,
} from '../registry/plugin-registry-api';

/**
 * Service implementation for plugin management operations
 */
export class PluginManagementService implements PluginManagementAPI {
  constructor(
    private nodeTypeRegistry: SimpleNodeTypeRegistry,
    private coreDB: CoreDB,
    private queryService: TreeQueryService
  ) {}

  async register(definition: any): Promise<PluginRegistrationResult> {
    const validationResult = await this.validatePlugin(definition);
    if (!validationResult.isValid) {
      return {
        success: false,
        error: {
          code: 'INVALID_DEFINITION',
          message: 'Plugin definition validation failed'
        },
        validationErrors: validationResult.errors.map(e => ({
          field: e.field,
          message: e.message
        }))
      };
    }

    const isAlreadyRegistered = await isNodeTypeRegistered(definition.nodeType);
    if (isAlreadyRegistered) {
      return {
        success: false,
        error: {
          code: 'DUPLICATE_NODE_TYPE',
          message: `Node type ${definition.nodeType} is already registered`
        }
      };
    }

    try {
      this.nodeTypeRegistry.register(definition.nodeType, definition);
      
      const pluginId = `plugin-${definition.nodeType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        pluginId,
        registeredNodeType: definition.nodeType
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: error instanceof Error ? error.message : 'Plugin registration failed'
        }
      };
    }
  }

  async unregister(nodeType: NodeType): Promise<UnregistrationResult> {
    const isRegistered = await isNodeTypeRegistered(nodeType);
    if (!isRegistered) {
      return {
        success: false,
        error: {
          code: 'PLUGIN_NOT_FOUND',
          message: `Plugin with node type ${nodeType} not found`
        }
      };
    }

    try {
      const dependencyInfo = await this.getDependencies(nodeType);
      const warnings: string[] = [];

      if (dependencyInfo.dependents.length > 0) {
        warnings.push(`Plugin has ${dependencyInfo.dependents.length} dependents that may be affected`);
      }

      try {
        // Use searchNodes as a substitute for countNodesByType
        // Get root node to use as search base
        const trees = await this.queryService.getTrees();
        if (trees.length === 0) {
          warnings.push('No trees found for node count verification');
          return { success: false, error: { code: 'NO_TREES', message: 'No trees available' } };
        }
        
        const rootNode = await this.queryService.getNode(trees[0].rootId);
        if (!rootNode) {
          warnings.push('Root node not found for node count verification');
          return { success: false, error: { code: 'ROOT_NODE_NOT_FOUND', message: 'Root node not available' } };
        }
        
        const searchResult = await this.queryService.searchNodes({
          rootNodeId: rootNode.id,
          query: '', // Empty query to get all nodes
          maxResults: 1 // Just check if any exist
        });
        if (searchResult && searchResult.length > 0) {
          warnings.push('Active nodes of this type exist');
        }
      } catch {
        warnings.push('Could not verify active node count');
      }

      this.nodeTypeRegistry.unregister(nodeType);

      return {
        success: true,
        unregisteredNodeType: nodeType,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNREGISTRATION_FAILED',
          message: error instanceof Error ? error.message : 'Plugin unregistration failed'
        }
      };
    }
  }

  async validatePlugin(definition: any): Promise<PluginValidationResult> {
    const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' | 'info' }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    if (!definition) {
      errors.push({
        field: 'root',
        message: 'Plugin definition is required',
        severity: 'error'
      });
      return { isValid: false, errors, warnings };
    }

    if (!definition.nodeType || typeof definition.nodeType !== 'string') {
      errors.push({
        field: 'nodeType',
        message: 'Node type is required and must be a string',
        severity: 'error'
      });
    } else {
      const nodeTypeRegex = /^[a-z][a-zA-Z0-9_]*$/;
      if (!nodeTypeRegex.test(definition.nodeType)) {
        errors.push({
          field: 'nodeType',
          message: 'Node type must start with lowercase letter',
          severity: 'error'
        });
      }
    }

    if (!definition.database) {
      errors.push({
        field: 'database',
        message: 'Database configuration is required',
        severity: 'error'
      });
    } else {
      if (!definition.database.tableName) {
        errors.push({
          field: 'database.tableName',
          message: 'Table name is required',
          severity: 'error'
        });
      }
    }

    if (!definition.entityHandler) {
      errors.push({
        field: 'entityHandler',
        message: 'Entity handler is required',
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async checkHealth(nodeType: NodeType): Promise<PluginHealthStatus> {
    const isRegistered = await isNodeTypeRegistered(nodeType);
    if (!isRegistered) {
      throw new Error(`Plugin ${nodeType} is not registered`);
    }

    const definition = await getPluginDefinition(nodeType);
    if (!definition) {
      throw new Error(`Plugin definition not found for ${nodeType}`);
    }

    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const issues: string[] = [];

    try {
      if (definition.entityHandler) {
        const requiredMethods = ['createEntity', 'updateEntity', 'deleteEntity'];
        for (const method of requiredMethods) {
          if (typeof definition.entityHandler[method] !== 'function') {
            issues.push(`Missing required method: ${method}`);
            status = 'unhealthy';
          }
        }
      }

      if (definition.database?.tableName) {
        const tableExists = this.coreDB.isOpen() && 
                          this.coreDB.tables.some(table => table.name === definition.database.tableName);
        if (!tableExists) {
          issues.push(`Table ${definition.database.tableName} not found`);
          status = 'degraded';
        }
      }

      const responseTime = Date.now() - startTime;

      return {
        status,
        lastCheck: Date.now(),
        issues: issues.length > 0 ? issues : undefined,
        performance: {
          avgResponseTime: responseTime,
          errorRate: status === 'unhealthy' ? 1 : 0
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: Date.now(),
        issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        performance: {
          avgResponseTime: Date.now() - startTime,
          errorRate: 1
        }
      };
    }
  }

  async listRegistered(options?: PluginListOptions): Promise<PluginRegistrationInfo[]> {
    try {
      const plugins = await getRegisteredPlugins();
      let result: PluginRegistrationInfo[] = [];

      for (const plugin of plugins) {
        try {
          const healthStatus = await this.checkHealth(plugin.nodeType);

          const registrationInfo: PluginRegistrationInfo = {
            nodeType: plugin.nodeType,
            meta: {
              name: plugin.name || plugin.nodeType,
              version: '1.0.0', // Default version as plugin definition doesn't include version
              category: plugin.category?.menuGroup
            },
            registrationTime: Date.now(),
            healthStatus
          };

          result.push(registrationInfo);

        } catch {
          result.push({
            nodeType: plugin.nodeType,
            meta: {
              name: plugin.name || plugin.nodeType,
              version: '1.0.0', // Default version as plugin definition doesn't include version
              category: plugin.category?.menuGroup
            },
            registrationTime: Date.now(),
            healthStatus: {
              status: 'unhealthy',
              lastCheck: Date.now(),
              issues: ['Health check failed'],
              performance: { avgResponseTime: 0, errorRate: 1 }
            }
          });
        }
      }

      if (options?.status) {
        result = result.filter(plugin => plugin.healthStatus.status === options.status);
      }

      if (options?.category) {
        result = result.filter(plugin => plugin.meta.category === options.category);
      }

      result.sort((a, b) => a.meta.name.localeCompare(b.meta.name));

      return result;

    } catch (error) {
      throw new Error(`Failed to list registered plugins: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDependencies(nodeType: NodeType): Promise<PluginDependencyInfo> {
    const isRegistered = await isNodeTypeRegistered(nodeType);
    if (!isRegistered) {
      throw new Error(`Plugin ${nodeType} is not registered`);
    }

    const definition = await getPluginDefinition(nodeType);
    if (!definition) {
      throw new Error(`Plugin definition not found for ${nodeType}`);
    }

    try {
      const dependencies: string[] = [];
      const dependents: string[] = [];
      const warnings: string[] = [];

      const allPlugins = await getRegisteredPlugins();
      for (const plugin of allPlugins) {
        if (plugin.nodeType !== nodeType) {
          // Check if other plugins depend on this one
          // This is simplified - actual implementation would check plugin dependencies
          // For now, we just return empty arrays
        }
      }

      return {
        nodeType,
        dependencies,
        dependents,
        circularDependencies: false,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      throw new Error(`Failed to analyze dependencies for ${nodeType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async bulkOperation(options: BulkOperationOptions): Promise<BulkOperationResult> {
    const successful: Array<{ nodeType: NodeType; result: any }> = [];
    const failed: Array<{ nodeType: NodeType; error: string }> = [];

    try {
      if (options.operation === 'register' && options.plugins) {
        for (const plugin of options.plugins) {
          try {
            const result = await this.register(plugin);
            
            if (result.success) {
              successful.push({
                nodeType: plugin.nodeType,
                result: {
                  pluginId: result.pluginId,
                  registeredNodeType: result.registeredNodeType
                }
              });
            } else {
              failed.push({
                nodeType: plugin.nodeType,
                error: result.error?.message || 'Registration failed'
              });
            }
          } catch (error) {
            failed.push({
              nodeType: plugin.nodeType,
              error: error instanceof Error ? error.message : 'Unknown registration error'
            });
          }
        }

      } else if (options.operation === 'unregister' && options.nodeTypes) {
        for (const nodeType of options.nodeTypes) {
          try {
            const result = await this.unregister(nodeType);
            
            if (result.success) {
              successful.push({
                nodeType,
                result: {
                  unregisteredNodeType: result.unregisteredNodeType,
                  warnings: result.warnings
                }
              });
            } else {
              failed.push({
                nodeType,
                error: result.error?.message || 'Unregistration failed'
              });
            }
          } catch (error) {
            failed.push({
              nodeType,
              error: error instanceof Error ? error.message : 'Unknown unregistration error'
            });
          }
        }

      } else {
        throw new Error('Invalid bulk operation: missing required parameters');
      }

      return {
        successful,
        failed,
        summary: {
          total: successful.length + failed.length,
          success: successful.length,
          failed: failed.length
        }
      };

    } catch (error) {
      throw new Error(`Bulk operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}