/**
 * @file HierarchicalEntityHandler.ts
 * @description Base handler for entities with hierarchical parent-child relationships
 */

import type { NodeId } from '@hierarchidb/common-core';
import type { Collection } from 'dexie';
import { BaseEntityHandler } from './BaseEntityHandler';
import type { BaseEntity, BaseWorkingCopy, BaseSearchCriteria } from '../types';

/**
 * Entity interface for hierarchical structures
 */
export interface HierarchicalEntity extends BaseEntity {
  parentId?: NodeId;
  depth?: number;
  path?: string;
  childCount?: number;
}

/**
 * Search criteria for hierarchical entities
 */
export interface HierarchicalSearchCriteria extends BaseSearchCriteria {
  parentId?: NodeId;
  maxDepth?: number;
  minDepth?: number;
  hasChildren?: boolean;
}

/**
 * Tree node representation for hierarchical data
 */
export interface TreeNode<TEntity extends HierarchicalEntity> {
  entity: TEntity;
  children: TreeNode<TEntity>[];
  expanded?: boolean;
}

/**
 * Abstract base class for hierarchical entity handlers
 * Provides tree structure operations
 */
export abstract class HierarchicalEntityHandler<
  TEntity extends HierarchicalEntity,
  TWorkingCopy extends BaseWorkingCopy,
  TCreateData extends Partial<TEntity> = Partial<TEntity>,
  TSearchCriteria extends HierarchicalSearchCriteria = HierarchicalSearchCriteria
> extends BaseEntityHandler<TEntity, TWorkingCopy, TCreateData, TSearchCriteria> {
  
  /**
   * Get direct children of a node
   */
  async getChildren(parentId: NodeId): Promise<TEntity[]> {
    try {
      return await this.table
        .where('parentId')
        .equals(parentId)
        .toArray();
    } catch (error) {
      console.error('Failed to get children:', error);
      throw error;
    }
  }

  /**
   * Get all descendants of a node
   */
  async getDescendants(nodeId: NodeId): Promise<TEntity[]> {
    try {
      const descendants: TEntity[] = [];
      const queue: NodeId[] = [nodeId];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const children = await this.getChildren(currentId);
        
        descendants.push(...children);
        queue.push(...children.map(child => child.nodeId));
      }

      return descendants;
    } catch (error) {
      console.error('Failed to get descendants:', error);
      throw error;
    }
  }

  /**
   * Get ancestors of a node (from parent to root)
   */
  async getAncestors(nodeId: NodeId): Promise<TEntity[]> {
    try {
      const ancestors: TEntity[] = [];
      let current = await this.getEntityByNodeId(nodeId);

      while (current?.parentId) {
        const parent = await this.getEntityByNodeId(current.parentId);
        if (parent) {
          ancestors.push(parent);
          current = parent;
        } else {
          break;
        }
      }

      return ancestors;
    } catch (error) {
      console.error('Failed to get ancestors:', error);
      throw error;
    }
  }

  /**
   * Get the path from root to node
   */
  async getPath(nodeId: NodeId): Promise<TEntity[]> {
    const ancestors = await this.getAncestors(nodeId);
    ancestors.reverse(); // Root first
    
    const node = await this.getEntityByNodeId(nodeId);
    if (node) {
      ancestors.push(node);
    }
    
    return ancestors;
  }

  /**
   * Build tree structure from flat list
   */
  buildTree(entities: TEntity[], rootParentId?: NodeId): TreeNode<TEntity>[] {
    const nodeMap = new Map<NodeId, TreeNode<TEntity>>();
    const rootNodes: TreeNode<TEntity>[] = [];

    // Create tree nodes
    entities.forEach(entity => {
      nodeMap.set(entity.nodeId, {
        entity,
        children: [],
      });
    });

    // Build parent-child relationships
    entities.forEach(entity => {
      const node = nodeMap.get(entity.nodeId)!;
      
      if (entity.parentId === rootParentId) {
        rootNodes.push(node);
      } else if (entity.parentId) {
        const parent = nodeMap.get(entity.parentId);
        if (parent) {
          parent.children.push(node);
        }
      }
    });

    return this.sortTreeNodes(rootNodes);
  }

  /**
   * Get subtree starting from a node
   */
  async getSubtree(nodeId: NodeId, maxDepth?: number): Promise<TreeNode<TEntity>> {
    const rootEntity = await this.getEntityByNodeId(nodeId);
    if (!rootEntity) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const treeNode: TreeNode<TEntity> = {
      entity: rootEntity,
      children: [],
    };

    if (maxDepth === 0) {
      return treeNode;
    }

    await this.populateSubtree(treeNode, maxDepth);
    return treeNode;
  }

  /**
   * Recursively populate subtree
   */
  private async populateSubtree(
    node: TreeNode<TEntity>,
    maxDepth?: number,
    currentDepth: number = 1
  ): Promise<void> {
    if (maxDepth && currentDepth > maxDepth) {
      return;
    }

    const children = await this.getChildren(node.entity.nodeId);
    
    for (const child of children) {
      const childNode: TreeNode<TEntity> = {
        entity: child,
        children: [],
      };
      
      node.children.push(childNode);
      await this.populateSubtree(childNode, maxDepth, currentDepth + 1);
    }

    node.children = this.sortTreeNodes(node.children);
  }

  /**
   * Move a node to a new parent
   */
  async moveNode(nodeId: NodeId, newParentId: NodeId | null): Promise<TEntity> {
    try {
      // Validate move (prevent circular reference)
      if (newParentId) {
        await this.validateMove(nodeId, newParentId);
      }

      const entity = await this.getEntityByNodeId(nodeId);
      if (!entity) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // Update parent and recalculate depth/path
      const updates = {
        parentId: newParentId || undefined,
        depth: await this.calculateDepth(newParentId),
        path: await this.calculatePath(nodeId, newParentId),
      } as Partial<TEntity>;

      return await this.updateEntity(entity.id, updates);
    } catch (error) {
      console.error('Failed to move node:', error);
      throw error;
    }
  }

  /**
   * Validate that moving a node won't create circular reference
   */
  private async validateMove(nodeId: NodeId, newParentId: NodeId): Promise<void> {
    if (nodeId === newParentId) {
      throw new Error('Cannot move node to itself');
    }

    const descendants = await this.getDescendants(nodeId);
    const descendantIds = descendants.map(d => d.nodeId);
    
    if (descendantIds.includes(newParentId)) {
      throw new Error('Cannot move node to its descendant');
    }
  }

  /**
   * Calculate depth of a node based on its parent
   */
  private async calculateDepth(parentId: NodeId | null): Promise<number> {
    if (!parentId) {
      return 0;
    }

    const parent = await this.getEntityByNodeId(parentId);
    if (!parent) {
      return 0;
    }

    return (parent.depth || 0) + 1;
  }

  /**
   * Calculate path string for a node
   */
  private async calculatePath(nodeId: NodeId, parentId: NodeId | null): Promise<string> {
    if (!parentId) {
      return `/${nodeId}`;
    }

    const parent = await this.getEntityByNodeId(parentId);
    if (!parent) {
      return `/${nodeId}`;
    }

    const parentPath = parent.path || `/${parent.nodeId}`;
    return `${parentPath}/${nodeId}`;
  }

  /**
   * Count children of a node
   */
  async countChildren(nodeId: NodeId): Promise<number> {
    try {
      return await this.table
        .where('parentId')
        .equals(nodeId)
        .count();
    } catch (error) {
      console.error('Failed to count children:', error);
      throw error;
    }
  }

  /**
   * Check if node has children
   */
  async hasChildren(nodeId: NodeId): Promise<boolean> {
    const count = await this.countChildren(nodeId);
    return count > 0;
  }

  /**
   * Get root nodes (nodes without parent)
   */
  async getRootNodes(): Promise<TEntity[]> {
    try {
      return await this.table
        .filter(entity => !entity.parentId)
        .toArray();
    } catch (error) {
      console.error('Failed to get root nodes:', error);
      throw error;
    }
  }

  /**
   * Get siblings of a node
   */
  async getSiblings(nodeId: NodeId, includeSelf: boolean = false): Promise<TEntity[]> {
    try {
      const entity = await this.getEntityByNodeId(nodeId);
      if (!entity) {
        return [];
      }

      let siblings: TEntity[];
      if (entity.parentId) {
        siblings = await this.getChildren(entity.parentId);
      } else {
        siblings = await this.getRootNodes();
      }

      if (!includeSelf) {
        siblings = siblings.filter(s => s.nodeId !== nodeId);
      }

      return siblings;
    } catch (error) {
      console.error('Failed to get siblings:', error);
      throw error;
    }
  }

  /**
   * Sort tree nodes (can be overridden by derived classes)
   */
  protected sortTreeNodes(nodes: TreeNode<TEntity>[]): TreeNode<TEntity>[] {
    return nodes.sort((a, b) => {
      // Default: sort by name if available, otherwise by nodeId
      const aName = (a.entity as any).name || a.entity.nodeId;
      const bName = (b.entity as any).name || b.entity.nodeId;
      return aName.localeCompare(bName);
    });
  }

  /**
   * Delete node and optionally its descendants
   */
  async deleteNodeWithDescendants(nodeId: NodeId, deleteDescendants: boolean = true): Promise<void> {
    try {
      const entity = await this.getEntityByNodeId(nodeId);
      if (!entity) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      if (deleteDescendants) {
        // Delete all descendants first
        const descendants = await this.getDescendants(nodeId);
        for (const descendant of descendants.reverse()) {
          await this.deleteEntity(descendant.id);
        }
      } else {
        // Move children to parent
        const children = await this.getChildren(nodeId);
        for (const child of children) {
          await this.moveNode(child.nodeId, entity.parentId || null);
        }
      }

      // Delete the node itself
      await this.deleteEntity(entity.id);
    } catch (error) {
      console.error('Failed to delete node with descendants:', error);
      throw error;
    }
  }

  /**
   * Apply additional search criteria for hierarchical entities
   */
  protected applyAdditionalSearchCriteria(
    query: Collection<TEntity>,
    criteria: TSearchCriteria
  ): Collection<TEntity, any> {
    if (criteria.parentId !== undefined) {
      query = query.filter(entity => entity.parentId === criteria.parentId);
    }

    if (criteria.maxDepth !== undefined) {
      query = query.filter(entity => (entity.depth || 0) <= criteria.maxDepth!);
    }

    if (criteria.minDepth !== undefined) {
      query = query.filter(entity => (entity.depth || 0) >= criteria.minDepth!);
    }

    if (criteria.hasChildren !== undefined) {
      // This requires async check, so we'll need to handle it differently
      // For now, we'll check childCount if available
      query = query.filter(entity => {
        const hasChildren = (entity.childCount || 0) > 0;
        return hasChildren === criteria.hasChildren;
      });
    }

    return query;
  }
}