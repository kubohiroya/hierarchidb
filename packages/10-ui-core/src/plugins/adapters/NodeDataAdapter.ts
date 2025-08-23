import type { NodeId } from '@hierarchidb/00-core';
import type { UnifiedNodeData } from '../types';
import { getUIPluginRegistry } from '../registry/UIPluginRegistry';

/**
 * Node Data Adapter
 *
 * Bridges the Worker API with the UI Plugin system by providing a unified
 * interface for node data operations. Handles both TreeNode-only nodes (folders)
 * and Entity-based nodes (maps, projects) transparently.
 */
export class NodeDataAdapter {
  constructor(private readonly workerAPI: WorkerAPI) {}

  /**
   * Get direct access to workerAPI for advanced operations
   * @returns WorkerAPI instance
   */
  getWorkerAPI(): WorkerAPI {
    return this.workerAPI;
  }

  /**
   * Get unified node data for UI consumption
   *
   * Combines TreeNode and Entity data based on plugin configuration
   *
   * @param nodeId - The node ID to fetch
   * @param nodeType - The node type
   * @returns Unified node data for UI
   */
  async getNodeData(nodeId: NodeId, nodeType: string): Promise<UnifiedNodeData> {
    const plugin = getUIPluginRegistry().get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown plugin type: ${nodeType}`);
    }

    // 1. Always fetch TreeNode data (common to all node types)
    const treeNode = await this.workerAPI.getTreeNode(nodeId);

    if (!plugin.dataSource.requiresEntity) {
      // Folder-like nodes: TreeNode only
      return {
        treeNode,
        entity: null,
        combinedData: await this.createFolderData(treeNode, nodeId),
      };
    } else {
      // Entity-based nodes: TreeNode + Entity
      const entity = await this.workerAPI.getEntity(nodeId, plugin.dataSource.entityType!);
      return {
        treeNode,
        entity,
        combinedData: this.createEntityData(treeNode, entity),
      };
    }
  }

  /**
   * Create a new node
   *
   * @param parentId - Parent node ID
   * @param nodeType - Type of node to create
   * @param data - Node data
   * @returns Created node ID
   */
  async createNode(parentId: NodeId, nodeType: string, data: any): Promise<NodeId> {
    const plugin = getUIPluginRegistry().get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown plugin type: ${nodeType}`);
    }

    if (!plugin.dataSource.requiresEntity) {
      // Folder creation: TreeNode only
      return await this.workerAPI.createTreeNode({
        parentId,
        nodeType: nodeType,
        name: data.name,
        description: data.description || '',
      });
    } else {
      // Entity-based node creation: TreeNode + Entity
      return await this.workerAPI.createNodeWithEntity({
        parentId,
        nodeType: nodeType,
        treeNodeData: {
          name: data.name,
          description: data.description || '',
        },
        entityType: plugin.dataSource.entityType!,
        entityData: data,
      });
    }
  }

  /**
   * Update an existing node
   *
   * @param nodeId - Node ID to update
   * @param nodeType - Node type
   * @param changes - Changes to apply
   */
  async updateNode(nodeId: NodeId, nodeType: string, changes: any): Promise<void> {
    const plugin = getUIPluginRegistry().get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown plugin type: ${nodeType}`);
    }

    // Separate TreeNode changes from Entity changes
    const treeNodeChanges = this.extractTreeNodeChanges(changes);
    const entityChanges = this.extractEntityChanges(changes);

    // Update TreeNode if there are changes
    if (Object.keys(treeNodeChanges).length > 0) {
      await this.workerAPI.updateTreeNode(nodeId, treeNodeChanges);
    }

    // Update Entity if plugin requires entity and there are entity changes
    if (plugin.dataSource.requiresEntity && Object.keys(entityChanges).length > 0) {
      await this.workerAPI.updateEntity(nodeId, plugin.dataSource.entityType!, entityChanges);
    }
  }

  /**
   * Delete a node
   *
   * @param nodeId - Node ID to delete
   * @param nodeType - Node type (for validation)
   */
  async deleteNode(nodeId: NodeId, nodeType: string): Promise<void> {
    const plugin = getUIPluginRegistry().get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown plugin type: ${nodeType}`);
    }

    // TreeNode deletion automatically cascades to Entity (existing Worker layer behavior)
    await this.workerAPI.deleteTreeNode(nodeId);
  }

  /**
   * Get children of a node
   *
   * @param nodeId - Parent node ID
   * @returns Array of child nodes
   */
  async getChildren(nodeId: NodeId): Promise<readonly any[]> {
    return await this.workerAPI.getChildren(nodeId);
  }

  /**
   * Check if a node has children
   *
   * @param nodeId - Node ID to check
   * @returns True if the node has children
   */
  async hasChildren(nodeId: NodeId): Promise<boolean> {
    const children = await this.getChildren(nodeId);
    return children.length > 0;
  }

  /**
   * Get child count for a node
   *
   * @param nodeId - Node ID to check
   * @returns Number of children
   */
  async getChildCount(nodeId: NodeId): Promise<number> {
    const children = await this.getChildren(nodeId);
    return children.length;
  }

  /**
   * Move a node to a new parent
   *
   * @param nodeId - Node to move
   * @param newParentId - New parent node ID
   */
  async moveNode(nodeId: NodeId, newParentId: NodeId): Promise<void> {
    await this.workerAPI.moveNode(nodeId, newParentId);
  }

  /**
   * Create folder-specific combined data
   *
   * @param treeNode - TreeNode data
   * @param nodeId - Node ID for additional queries
   * @returns Combined data for folders
   */
  private async createFolderData(treeNode: any, nodeId: NodeId): Promise<any> {
    return {
      id: treeNode.id,
      name: treeNode.name,
      type: treeNode.nodeType,
      parentId: treeNode.parentId,
      description: treeNode.description,
      createdAt: treeNode.createdAt,
      updatedAt: treeNode.updatedAt,

      // Folder-specific display information
      hasChildren: await this.hasChildren(nodeId),
      childCount: await this.getChildCount(nodeId),

      // Additional folder metadata
      path: await this.getNodePath(nodeId),
      size: await this.calculateFolderSize(nodeId),
    };
  }

  /**
   * Create entity-specific combined data
   *
   * @param treeNode - TreeNode data
   * @param entity - Entity data
   * @returns Combined data for entity-based nodes
   */
  private createEntityData(treeNode: any, entity: any): any {
    return {
      // TreeNode basic information
      id: treeNode.id,
      name: treeNode.name,
      type: treeNode.nodeType,
      parentId: treeNode.parentId,
      description: treeNode.description,

      // Entity detailed information (spread entity fields)
      ...entity,

      // Unified timestamps
      createdAt: treeNode.createdAt,
      updatedAt: Math.max(treeNode.updatedAt, entity?.updatedAt || 0),

      // Metadata
      version: entity?.version || 1,
      size: this.calculateEntitySize(entity),

      // Additional computed properties
      entityType: entity?.constructor?.name || 'Unknown',
    };
  }

  /**
   * Extract TreeNode changes from a changes object
   *
   * @param changes - All changes
   * @returns TreeNode-specific changes
   */
  private extractTreeNodeChanges(changes: any): any {
    const treeNodeFields = new Set(['name', 'description']);
    const treeNodeChanges: any = {};

    for (const [key, value] of Object.entries(changes)) {
      if (treeNodeFields.has(key)) {
        treeNodeChanges[key] = value;
      }
    }

    return treeNodeChanges;
  }

  /**
   * Extract Entity changes from a changes object
   *
   * @param changes - All changes
   * @returns Entity-specific changes
   */
  private extractEntityChanges(changes: any): any {
    const treeNodeFields = new Set(['name', 'description']);
    const entityChanges: any = {};

    for (const [key, value] of Object.entries(changes)) {
      if (!treeNodeFields.has(key)) {
        entityChanges[key] = value;
      }
    }

    return entityChanges;
  }

  /**
   * Get the full path to a node
   *
   * @param nodeId - Node ID
   * @returns Array of node IDs representing the path
   */
  private async getNodePath(nodeId: NodeId): Promise<readonly NodeId[]> {
    const path: NodeId[] = [];
    let currentNodeId: NodeId | null = nodeId;

    while (currentNodeId) {
      const node: any = await this.workerAPI.getTreeNode(currentNodeId);
      path.unshift(currentNodeId);
      currentNodeId = node.parentId;
    }

    return path;
  }

  /**
   * Calculate folder size (recursive)
   *
   * @param nodeId - Folder node ID
   * @returns Size in bytes (estimated)
   */
  private async calculateFolderSize(nodeId: NodeId): Promise<number> {
    // Simple implementation - could be optimized
    try {
      const children = await this.getChildren(nodeId);
      let totalSize = 1024; // Base folder overhead

      for (const child of children) {
        if (child.nodeType === 'folder') {
          totalSize += await this.calculateFolderSize(child.id);
        } else {
          totalSize += 4096; // Estimated size for non-folder items
        }
      }

      return totalSize;
    } catch (error) {
      console.warn('Failed to calculate folder size:', error);
      return 0;
    }
  }

  /**
   * Calculate entity size
   *
   * @param entity - Entity data
   * @returns Size estimate in bytes
   */
  private calculateEntitySize(entity: any): number {
    if (!entity) return 0;

    try {
      // Rough estimate based on JSON serialization
      const jsonString = JSON.stringify(entity);
      return new Blob([jsonString]).size;
    } catch (error) {
      console.warn('Failed to calculate entity size:', error);
      return 0;
    }
  }
}

// Worker API interface (placeholder - should match actual implementation)
interface WorkerAPI {
  getTreeNode(nodeId: NodeId): Promise<any>;
  createTreeNode(data: any): Promise<NodeId>;
  updateTreeNode(nodeId: NodeId, changes: any): Promise<void>;
  deleteTreeNode(nodeId: NodeId): Promise<void>;
  getChildren(nodeId: NodeId): Promise<any[]>;
  moveNode(nodeId: NodeId, newParentId: NodeId): Promise<void>;
  getEntity(nodeId: NodeId, entityType: string): Promise<any>;
  createNodeWithEntity(data: any): Promise<NodeId>;
  updateEntity(nodeId: NodeId, entityType: string, changes: any): Promise<void>;
  getAllowedChildTypes?(nodeType: string): Promise<string[]>;
}
