/**
import type { NodeType, PluginDefinition } from '@hierarchidb/common-type';
 * @file PluginManagementService.ts
 * @description Plugin lifecycle management service implementation
 */

import type {
  PluginLifecycleAPI,
  PluginRegistrationResultNew as PluginRegistrationResult,
  UnregistrationResultNew as UnregistrationResult,
  PluginValidationResultNew as PluginValidationResult,
  PluginHealthStatusNew as PluginHealthStatus,
  PluginRegistrationInfoNew as PluginRegistrationInfo,
  PluginListOptionsNew as PluginListOptions,
  PluginDependencyInfoNew as PluginDependencyInfo,
  BulkOperationOptionsNew as BulkOperationOptions,
  BulkOperationResultNew as BulkOperationResult,
} from '@hierarchidb/common-api';

// Define PluginManagementAPI locally if not exported
type PluginManagementAPI = PluginLifecycleAPI;
import { NodeType } from '@hierarchidb/common-type';

// Local type definitions for interfaces not exported from common-api
interface PluginResetOptions {
  nodeType: NodeType;
  resetMode: 'individual' | 'folder' | 'system';
  createBackup?: boolean;
}

interface PluginResetResult {
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

interface PluginDeleteResult {
  success: boolean;
  nodeType: NodeType;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
  };
}
import type { PluginRepository, SimpleNodeTypeRegistry } from '@hierarchidb/runtime-worker-plugin-registry';
// Import from plugin-registry package
import {
  isNodeTypeRegistered,
  getPluginDefinition,
  getRegisteredPlugins,
} from '@hierarchidb/runtime-worker-plugin-registry';

/**
 * Service implementation for plugin management operations
 */

export class PluginManagementService implements PluginManagementAPI, PluginLifecycleAPI {
  constructor(private nodeTypeRegistry: PluginRepository) {}

  async register(definition: any): Promise<PluginRegistrationResult> {
    const validationResult = await this.validatePlugin(definition);
    if (!validationResult.isValid) {
      return {
        success: false,
        error: {
          code: 'INVALID_DEFINITION',
          message: 'Plugin definition validation failed',
        },
        validationErrors: validationResult.errors.map((e) => ({
          field: e.field,
          message: e.message,
        })),
      };
    }

    const isAlreadyRegistered = await isNodeTypeRegistered(definition.nodeType);
    if (isAlreadyRegistered) {
      return {
        success: false,
        error: {
          code: 'DUPLICATE_NODE_TYPE',
          message: `Node type ${definition.nodeType} is already registered`,
        },
      };
    }

    try {
      this.nodeTypeRegistry.registerPlugin(definition.nodeType);

      const pluginId = `plugin-${definition.nodeType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        pluginId,
        registeredNodeType: definition.nodeType,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: error instanceof Error ? error.message : 'Plugin registration failed',
        },
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
          message: `Plugin with node type ${nodeType} not found`,
        },
      };
    }

    try {
      const dependencyInfo = await this.getDependencies(nodeType);
      const warnings: string[] = [];

      if (dependencyInfo.dependents.length > 0) {
        warnings.push(
          `Plugin has ${dependencyInfo.dependents.length} dependents that may be affected`
        );
      }

      try {
        // Use searchNodes as a substitute for countNodesByType
        // Get root node to use as search base
        // TODO: Implement proper tree querying
        const trees: any[] = []; // await this.queryService.getTrees();
        if (trees.length === 0) {
          warnings.push('No trees found for node count verification');
          return { success: false, error: { code: 'NO_TREES', message: 'No trees available' } };
        }

        // TODO: Implement proper node retrieval
        const rootNode = null; // await this.queryService.getNode(trees[0].rootId);
        if (!rootNode) {
          warnings.push('Root node not found for node count verification');
          return {
            success: false,
            error: { code: 'ROOT_NODE_NOT_FOUND', message: 'Root node not available' },
          };
        }

        // TODO: Implement proper node searching
        const searchResult = { nodes: [] };
        /*
        await this.queryService.searchNodes({
          rootNodeId: rootNode.id,
          query: '', // Empty query to get all nodes
          maxResults: 1 // Just check if any exist
        });
        */
        if (searchResult && searchResult.nodes.length > 0) {
          warnings.push('Active nodes of this type exist');
        }
      } catch {
        warnings.push('Could not verify active node count');
      }

      this.nodeTypeRegistry.unregister(nodeType);

      return {
        success: true,
        unregisteredNodeType: nodeType,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNREGISTRATION_FAILED',
          message: error instanceof Error ? error.message : 'Plugin unregistration failed',
        },
      };
    }
  }

  async validatePlugin(definition: any): Promise<PluginValidationResult> {
    const errors: Array<{
      field: string;
      message: string;
      severity: 'error' | 'warning' | 'info';
    }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    if (!definition) {
      errors.push({
        field: 'root',
        message: 'Plugin definition is required',
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    if (!definition.nodeType || typeof definition.nodeType !== 'string') {
      errors.push({
        field: 'nodeType',
        message: 'Node type is required and must be a string',
        severity: 'error',
      });
    } else {
      const nodeTypeRegex = /^[a-z][a-zA-Z0-9_]*$/;
      if (!nodeTypeRegex.test(definition.nodeType)) {
        errors.push({
          field: 'nodeType',
          message: 'Node type must start with lowercase letter',
          severity: 'error',
        });
      }
    }

    if (!definition.database) {
      errors.push({
        field: 'database',
        message: 'Database configuration is required',
        severity: 'error',
      });
    } else {
      if (!definition.database.tableName) {
        errors.push({
          field: 'database.tableName',
          message: 'Table name is required',
          severity: 'error',
        });
      }
    }

    if (!definition.entityHandler) {
      errors.push({
        field: 'entityHandler',
        message: 'Entity handler is required',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
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
      // Check if this is a PluginIntegrated type with entityHandler
      const pluginDef = definition as any;
      if (pluginDef.entityHandler) {
        const requiredMethods = ['createEntity', 'updateEntity', 'deleteEntity'];
        for (const method of requiredMethods) {
          if (typeof (pluginDef.entityHandler as any)[method] !== 'function') {
            issues.push(`Missing required method: ${method}`);
            status = 'unhealthy';
          }
        }
      }

      if ((definition.database as any)?.tableName) {
        // TODO: Implement proper database table checking
        const tableExists = false; // this.coreDB.isOpen() && this.coreDB.tables.some(table => table.name === definition.database.tableName);
        if (!tableExists) {
          issues.push(`Table ${(definition.database as any).tableName} not found`);
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
          errorRate: status === 'unhealthy' ? 1 : 0,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: Date.now(),
        issues: [
          `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        performance: {
          avgResponseTime: Date.now() - startTime,
          errorRate: 1,
        },
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
              category: plugin.category?.menuGroup,
            },
            registrationTime: Date.now(),
            healthStatus,
          };

          result.push(registrationInfo);
        } catch {
          result.push({
            nodeType: plugin.nodeType,
            meta: {
              name: plugin.name || plugin.nodeType,
              version: '1.0.0', // Default version as plugin definition doesn't include version
              category: plugin.category?.menuGroup,
            },
            registrationTime: Date.now(),
            healthStatus: {
              status: 'unhealthy',
              lastCheck: Date.now(),
              issues: ['Health check failed'],
              performance: { avgResponseTime: 0, errorRate: 1 },
            },
          });
        }
      }

      if (options?.status) {
        result = result.filter((plugin) => plugin.healthStatus.status === options.status);
      }

      if (options?.category) {
        result = result.filter((plugin) => plugin.meta.category === options.category);
      }

      result.sort((a, b) => a.meta.name.localeCompare(b.meta.name));

      return result;
    } catch (error) {
      throw new Error(
        `Failed to list registered plugins: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      const dependencies: NodeType[] = [];
      const dependents: NodeType[] = [];
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
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      throw new Error(
        `Failed to analyze dependencies for ${nodeType}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
                  registeredNodeType: result.registeredNodeType,
                },
              });
            } else {
              failed.push({
                nodeType: plugin.nodeType,
                error: result.error?.message || 'Registration failed',
              });
            }
          } catch (error) {
            failed.push({
              nodeType: plugin.nodeType,
              error: error instanceof Error ? error.message : 'Unknown registration error',
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
                  warnings: result.warnings,
                },
              });
            } else {
              failed.push({
                nodeType,
                error: result.error?.message || 'Unregistration failed',
              });
            }
          } catch (error) {
            failed.push({
              nodeType,
              error: error instanceof Error ? error.message : 'Unknown unregistration error',
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
          failed: failed.length,
        },
      };
    } catch (error) {
      throw new Error(
        `Bulk operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Reset plugin entities
   */
  async resetPlugin(options: PluginResetOptions): Promise<PluginResetResult> {
    const { nodeType, resetMode, createBackup = false } = options;

    try {
      // Check if plugin is registered
      if (!this.nodeTypeRegistry.has(nodeType as NodeType)) {
        return {
          success: false,
          nodeType,
          deletedEntities: {},
          error: {
            code: 'PLUGIN_NOT_FOUND',
            message: `Plugin '${nodeType}' is not registered`,
          },
        };
      }

      // Create backup if requested
      let backupLocation: string | undefined;
      if (createBackup) {
        // TODO: Implement backup creation
        backupLocation = `/backups/plugin-${nodeType}-${Date.now()}.zip`;
      }

      const deletedEntities: PluginResetResult['deletedEntities'] = {
        groupEntities: 0,
        relationalEntities: 0,
        treeNodes: 0,
        peerEntities: 0,
      };

      switch (resetMode) {
        case 'individual':
          // Delete only GroupEntity and RelationalEntity for this plugin
          // TODO: Implement actual deletion from Dexie stores
          // For now, return mock data
          deletedEntities.groupEntities = 0;
          deletedEntities.relationalEntities = 0;
          // Don't set treeNodes and peerEntities for individual reset
          delete deletedEntities.treeNodes;
          delete deletedEntities.peerEntities;
          break;

        case 'folder':
          // Delete everything (special case for folder-plugin plugin)
          if (nodeType !== 'folder') {
            return {
              success: false,
              nodeType: nodeType as NodeType,
              deletedEntities: {
                groupEntities: 0,
                relationalEntities: 0,
                treeNodes: 0,
                peerEntities: 0,
              },
              error: {
                code: 'INVALID_RESET_MODE',
                message: `Reset mode 'folder' is only valid for folder plugin`,
              },
            };
          }
          // TODO: Implement complete data deletion
          deletedEntities.groupEntities = 0;
          deletedEntities.relationalEntities = 0;
          deletedEntities.treeNodes = 0;
          deletedEntities.peerEntities = 0;
          break;

        case 'system':
          // Reset entire system
          // TODO: Implement system-wide reset
          deletedEntities.groupEntities = 0;
          deletedEntities.relationalEntities = 0;
          deletedEntities.treeNodes = 0;
          deletedEntities.peerEntities = 0;
          break;

        default:
          return {
            success: false,
            nodeType,
            deletedEntities: {},
            error: {
              code: 'INVALID_RESET_MODE',
              message: `Invalid reset mode: ${resetMode}`,
            },
          };
      }

      return {
        success: true,
        nodeType: nodeType as NodeType,
        deletedEntities,
        ...(backupLocation && { backupLocation }),
      };
    } catch (error) {
      return {
        success: false,
        nodeType: nodeType as NodeType,
        deletedEntities: {
          groupEntities: 0,
          relationalEntities: 0,
          treeNodes: 0,
          peerEntities: 0,
        },
        error: {
          code: 'RESET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Delete a plugin completely
   */
  async deletePlugin(nodeType: NodeType): Promise<PluginDeleteResult> {
    try {
      // Check if it's the folder-plugin plugin (cannot be deleted)
      if (nodeType === 'folder') {
        return {
          success: false,
          nodeType,
          error: {
            code: 'CORE_PLUGIN',
            message: 'The folder-plugin plugin is a core plugin and cannot be deleted',
          },
        };
      }

      // Check if plugin exists
      if (!this.nodeTypeRegistry.has(nodeType)) {
        return {
          success: false,
          nodeType,
          error: {
            code: 'PLUGIN_NOT_FOUND',
            message: `Plugin '${nodeType}' is not registered`,
          },
        };
      }

      // Check for dependent plugins
      const warnings: string[] = [];
      const registeredNodeTypes = await this.nodeTypeRegistry.getAll();
      for (const registeredNodeType of registeredNodeTypes) {
        const pluginDefinition = await this.nodeTypeRegistry.get(registeredNodeType.nodeType);
        if (pluginDefinition?.dependencies?.includes(nodeType)) {
          warnings.push(`Plugin '${registeredNodeType}' depends on '${nodeType}'`);
        }
      }

      // Unregister the plugin
      await this.unregister(nodeType);

      return {
        success: true,
        nodeType,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        nodeType,
        error: {
          code: 'DELETE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Reset the entire system
   */
  async resetSystem(createBackup: boolean = false): Promise<PluginResetResult> {
    return this.resetPlugin({
      nodeType: 'folder' as NodeType, // Use 'folder-plugin' as the target for system reset
      resetMode: 'system',
      createBackup,
    });
  }
}
