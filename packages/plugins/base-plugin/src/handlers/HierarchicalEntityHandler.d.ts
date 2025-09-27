/**
 * @file HierarchicalEntityHandler.ts
 * @description Base handler for entities with hierarchical parent-child relationships
 */
import type { BaseEntity, NodeId } from '@hierarchidb/common-type';
import type { Collection } from 'dexie';
import { BaseEntityHandler } from './BaseEntityHandler.js';
import type { BaseSearchCriteria } from '../types.js';
/**
 * Entity interface for hierarchical structures
 */
export interface HierarchicalEntity extends BaseEntity {
    nodeId: NodeId;
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
export declare abstract class HierarchicalEntityHandler<TEntity extends HierarchicalEntity, TCreateData extends Partial<TEntity> = Partial<TEntity>, TSearchCriteria extends HierarchicalSearchCriteria = HierarchicalSearchCriteria> extends BaseEntityHandler<TEntity, TCreateData, TSearchCriteria> {
    /**
     * Get direct children of a node
     */
    getChildren(parentId: NodeId): Promise<TEntity[]>;
    /**
     * Get all descendants of a node
     */
    getDescendants(nodeId: NodeId): Promise<TEntity[]>;
    /**
     * Get ancestors of a node (from parent to root)
     */
    getAncestors(nodeId: NodeId): Promise<TEntity[]>;
    /**
     * Get the path from root to node
     */
    getPath(nodeId: NodeId): Promise<TEntity[]>;
    /**
     * Build tree structure from flat list
     */
    buildTree(entities: TEntity[], rootParentId?: NodeId): TreeNode<TEntity>[];
    /**
     * Get subtree starting from a node
     */
    getSubtree(nodeId: NodeId, maxDepth?: number): Promise<TreeNode<TEntity>>;
    /**
     * Recursively populate subtree
     */
    private populateSubtree;
    /**
     * Move a node to a new parent
     */
    moveNode(nodeId: NodeId, newParentId: NodeId | null): Promise<TEntity>;
    /**
     * Validate that moving a node won't create circular reference
     */
    private validateMove;
    /**
     * Calculate depth of a node based on its parent
     */
    private calculateDepth;
    /**
     * Calculate path string for a node
     */
    private calculatePath;
    /**
     * Count children of a node
     */
    countChildren(nodeId: NodeId): Promise<number>;
    /**
     * Check if node has children
     */
    hasChildren(nodeId: NodeId): Promise<boolean>;
    /**
     * Get root nodes (nodes without parent)
     */
    getRootNodes(): Promise<TEntity[]>;
    /**
     * Get siblings of a node
     */
    getSiblings(nodeId: NodeId, includeSelf?: boolean): Promise<TEntity[]>;
    /**
     * Sort tree nodes (can be overridden by derived classes)
     */
    protected sortTreeNodes(nodes: TreeNode<TEntity>[]): TreeNode<TEntity>[];
    /**
     * Delete node and optionally its descendants
     */
    deleteNodeWithDescendants(nodeId: NodeId, deleteDescendants?: boolean): Promise<void>;
    /**
     * Apply additional search criteria for hierarchical entities
     */
    protected applyAdditionalSearchCriteria(query: Collection<TEntity>, criteria: TSearchCriteria): Collection<TEntity, any>;
}
//# sourceMappingURL=HierarchicalEntityHandler.d.ts.map