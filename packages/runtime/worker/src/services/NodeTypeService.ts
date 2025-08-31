/**
 * @file NodeTypeService.ts
 * @description Node type management service implementation
 */

import type { NodeTypeAPI } from '@hierarchidb/common-api';
import type { TreeQueryService } from './TreeQueryService';
import type { PluginRegistry } from '@hierarchidb/runtime-plugin-registry';
import {
  isNodeTypeRegistered,
  getPluginDefinition,
  getCreatableNodeTypes,
} from '../registry/plugin-registry-api';
import type {
  NodeId,
  NodeLifecycleHooks,
  NodeType,
  PluginDefinition,
  TreeNode,
  ValidationResult,
} from '@hierarchidb/common-type';
import type { NodeTypeDefinition } from '..';

/**
 * Service implementation for node type operations
 */
export class NodeTypeService implements NodeTypeAPI {
  constructor(
    private pluginRegistry: PluginRegistry,
    private queryService: TreeQueryService
  ) {}

  async listSupported(): Promise<NodeType[]> {
    const types = await getCreatableNodeTypes();
    return types as NodeType[];
  }

  async isSupported(nodeType: NodeType): Promise<boolean> {
    return await isNodeTypeRegistered(nodeType);
  }

  async validateOperation(
    nodeType: NodeType,
    operation: 'create' | 'update' | 'delete' | 'move',
    context?: { parentId?: NodeId; targetNodeId?: NodeId }
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    const isRegistered = await isNodeTypeRegistered(nodeType);
    if (!isRegistered) {
      errors.push(`Node type ${nodeType} is not registered`);
      return { valid: false, message: errors.join('; ') };
    }

    const definition = await getPluginDefinition(nodeType);
    if (!definition) {
      errors.push(`Plugin definition not found for node type ${nodeType}`);
      return { valid: false, message: errors.join('; ') };
    }

    try {
      switch (operation) {
        case 'create':
          if (!definition.ui?.dialogComponentPath) {
            errors.push(`Node type ${nodeType} does not support create operation`);
          }

          if (context?.parentId) {
            try {
              const parentNode = await this.queryService.getNode(context.parentId);
              if (!parentNode) {
                errors.push('Parent node not found');
              } else {
                const parentSupportsChildren = await this.supportsChildren(parentNode.nodeType);
                if (!parentSupportsChildren) {
                  errors.push(
                    `Parent node type ${parentNode.nodeType} does not support child nodes`
                  );
                }
              }
            } catch (error) {
              errors.push('Failed to validate parent node');
            }
          }
          break;

        case 'update':
          if (context?.targetNodeId) {
            try {
              const targetNode = await this.queryService.getNode(context.targetNodeId);
              if (!targetNode) {
                errors.push('Target node not found');
              } else if (targetNode.nodeType !== nodeType) {
                errors.push('Node type mismatch for update operation');
              }
            } catch (error) {
              errors.push('Failed to validate target node');
            }
          }
          break;

        case 'delete':
          if (context?.targetNodeId) {
            try {
              const targetNode = await this.queryService.getNode(context.targetNodeId);
              if (!targetNode) {
                errors.push('Target node not found');
              }
            } catch (error) {
              errors.push('Failed to validate delete target');
            }
          }
          break;

        case 'move':
          if (context?.targetNodeId && context?.parentId) {
            if (context.targetNodeId === context.parentId) {
              errors.push('Cannot move node to itself');
            }

            try {
              const [targetNode, parentNode] = await Promise.all([
                this.queryService.getNode(context.targetNodeId),
                this.queryService.getNode(context.parentId),
              ]);

              if (!targetNode) {
                errors.push('Target node not found');
              }
              if (!parentNode) {
                errors.push('Parent node not found');
              }

              if (targetNode && parentNode) {
                const isDescendant = await this.isNodeDescendantOf(
                  context.parentId,
                  context.targetNodeId
                );
                if (isDescendant) {
                  errors.push('Cannot move node to its own descendant');
                }
              }
            } catch (error) {
              errors.push('Failed to validate move operation');
            }
          }
          break;

        default:
          errors.push(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      message: errors.length === 0 ? '' : errors.join('; '),
    };
  }

  async getSupportedOperations(
    nodeType: NodeType
  ): Promise<Array<'create' | 'read' | 'update' | 'delete' | 'move' | 'copy'>> {
    const isRegistered = await isNodeTypeRegistered(nodeType);
    if (!isRegistered) {
      return [];
    }

    const definition = await getPluginDefinition(nodeType);
    if (!definition) {
      return [];
    }

    const operations: ('create' | 'read' | 'update' | 'delete' | 'move' | 'copy')[] = [];

    if (definition.ui?.dialogComponentPath) {
      operations.push('create', 'update');
    }

    operations.push('read');

    if (nodeType !== 'Root' && nodeType !== 'Trash') {
      operations.push('delete', 'move');
    }

    if (definition.entityHandler) {
      operations.push('copy');
    }

    return operations;
  }

  async supportsChildren(nodeType: NodeType): Promise<boolean> {
    const isRegistered = await isNodeTypeRegistered(nodeType);
    if (!isRegistered) {
      return false;
    }

    const definition = await getPluginDefinition(nodeType);
    if (!definition) {
      return false;
    }

    if (definition.validation?.maxChildren !== undefined) {
      return definition.validation.maxChildren > 0;
    }

    if (definition.ui?.panelComponentPath) {
      return true;
    }

    const category = definition.category?.menuGroup;
    if (category === 'container' || category === 'basic') {
      return true;
    }

    return true;
  }

  async getAllowedChildTypes(parentType: NodeType): Promise<NodeType[]> {
    const isRegistered = await isNodeTypeRegistered(parentType);
    if (!isRegistered) {
      return [];
    }

    const supportsChildren = await this.supportsChildren(parentType);
    if (!supportsChildren) {
      return [];
    }

    const definition = await getPluginDefinition(parentType);
    if (!definition) {
      return [];
    }

    if (definition.validation?.allowedChildTypes) {
      return definition.validation.allowedChildTypes as NodeType[];
    }

    const allTypes = await getCreatableNodeTypes();
    const parentCategory = definition.category?.menuGroup;

    if (parentCategory === 'container') {
      return allTypes as NodeType[];
    } else if (parentCategory === 'document') {
      return allTypes.filter((type) => !['project', 'basemap'].includes(type)) as NodeType[];
    }

    return allTypes as NodeType[];
  }

  async hasCapability(nodeType: NodeType, capability: string): Promise<boolean> {
    const definition = await getPluginDefinition(nodeType);
    if (!definition) {
      return false;
    }

    switch (capability) {
      case 'create':
        return !!definition.ui?.dialogComponentPath;

      case 'ui':
        return !!(definition.ui?.dialogComponentPath || definition.ui?.panelComponentPath);

      case 'api':
        return !!definition.api;

      case 'children':
        return await this.supportsChildren(nodeType);

      case 'export':
        return !!definition.entityHandler;

      case 'lifecycle':
        return !!(
          definition.lifecycle?.beforeCreate ||
          definition.lifecycle?.afterCreate ||
          definition.lifecycle?.beforeUpdate ||
          definition.lifecycle?.afterUpdate ||
          definition.lifecycle?.beforeDelete ||
          definition.lifecycle?.afterDelete
        );

      case 'validation':
        return !!definition.entityHandler;

      case 'search':
        return true;

      case 'permissions':
        return false;

      default:
        return false;
    }
  }

  // Additional methods expected by tests
  async registerNodeType(nodeType: NodeTypeDefinition<any, any, any>): Promise<void> {
    // Map PluginDefinition (core) to SimpleNodeTypeRegistry config (lightweight)
    const config: Partial<import('@hierarchidb/common-type').NodeTypeConfig> = {
      icon: nodeType.icon,
      allowedChildren: nodeType.validation?.allowedChildTypes,
      maxChildren: nodeType.validation?.maxChildren,
      // Sensible defaults for basic operations in the simple registry
      canBeDeleted: true,
      canBeRenamed: true,
      canBeMoved: true,
    };
    this.pluginRegistry.register(nodeType.nodeType, config as any);
  }

  async unregisterNodeType(nodeType: NodeType): Promise<void> {
    return this.pluginRegistry.unregister(nodeType);
  }

  async listNodeTypes(): Promise<NodeType[]> {
    return this.pluginRegistry.getAll();
  }

  async getNodeTypeDefinition(
    nodeType: NodeType
  ): Promise<NodeTypeDefinition<any, any, any> | null> {
    // Delegate to plugin registry which holds full plugin definitions in worker
    const def = await getPluginDefinition(nodeType);
    return (def as unknown as NodeTypeDefinition<any, any, any>) ?? null;
  }

  async getNodeTypesByCategory(category: string): Promise<NodeType[]> {
    const allTypes = await this.listNodeTypes();
    const categorizedTypes: NodeType[] = [];

    for (const type of allTypes) {
      const definition: any = await this.getNodeTypeDefinition(type);
      if (definition?.category?.menuGroup === category) {
        categorizedTypes.push(type);
      }
    }

    return categorizedTypes;
  }

  async isNodeTypeRegistered(nodeType: NodeType): Promise<boolean> {
    return await isNodeTypeRegistered(nodeType);
  }

  async canContainChild(parentType: NodeType, childType: NodeType): Promise<boolean> {
    const allowedChildTypes = await this.getAllowedChildTypes(parentType);
    return allowedChildTypes.includes(childType);
  }

  async getNodeTypeMetadata(nodeType: NodeType): Promise<PluginDefinition | null> {
    const pluginDef = await getPluginDefinition(nodeType);
    return (pluginDef as any)?.meta ?? null;
  }

  async updateNodeTypeMetadata(_nodeType: NodeType, _metadata: PluginDefinition): Promise<void> {
    // Metadata updates are not supported in the simple registry bridge.
    // In a full implementation, this would update the plugin definition in the registry.
    throw new Error('Updating node type metadata is not supported in this environment');
  }

  async validateNodeType(node: TreeNode): Promise<{ valid: boolean; errors: string[] }> {
    const definition = await this.getNodeTypeDefinition(node.nodeType);
    if (!definition) {
      return {
        valid: false,
        errors: [`Node type ${node.nodeType} is not registered`],
      };
    }

    const errors: string[] = [];

    // Run validation rules if they exist
    if (definition.validation?.customValidators) {
      for (const validator of definition.validation.customValidators) {
        try {
          const result = await validator.validate(node as any);
          if (!result.valid) {
            // result is { valid: false; message: string } in this branch
            errors.push(
              (result as Extract<ValidationResult, { valid: false }>).message ??
                `Validation failed: ${validator.name}`
            );
          }
        } catch (error) {
          errors.push(
            `Validation error in ${validator.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async getNodeTypeHooks(nodeType: NodeType): Promise<NodeLifecycleHooks<any> | null> {
    const definition = await this.getNodeTypeDefinition(nodeType);
    if (!definition || !definition.lifecycle) {
      return null;
    }
    return definition.lifecycle;
  }

  async getNodeTypeStats(): Promise<Record<NodeType, number>> {
    const allTypes = await this.listNodeTypes();
    const stats: Record<NodeType, number> = {};

    // Initialize all registered types to 0
    for (const type of allTypes) {
      stats[type] = 0;
    }

    try {
      // Count nodes by type using search functionality as substitute
      for (const nodeType of allTypes) {
        try {
          // TreeQueryService.searchNodes requires a rootNodeId and returns TreeNode[]
          // In this simplified stats implementation, we skip querying and default to 0.
          // A full implementation could traverse from known roots and count by type.
          stats[nodeType] = 0;
        } catch (error) {
          stats[nodeType] = 0;
        }
      }
    } catch (error) {
      // If there's an error getting stats, return zeros
    }

    return stats;
  }

  private async isNodeDescendantOf(potentialParentId: NodeId, nodeId: NodeId): Promise<boolean> {
    try {
      let currentNodeId: NodeId | null = nodeId;
      const visitedNodes = new Set<NodeId>();

      while (currentNodeId && !visitedNodes.has(currentNodeId)) {
        visitedNodes.add(currentNodeId);

        const node = await this.queryService.getNode(currentNodeId);
        if (!node || !node.parentId) {
          break;
        }

        if (node.parentId === potentialParentId) {
          return true;
        }

        currentNodeId = node.parentId;
      }

      return false;
    } catch (error) {
      return true; // Assume circular reference on error
    }
  }
}
