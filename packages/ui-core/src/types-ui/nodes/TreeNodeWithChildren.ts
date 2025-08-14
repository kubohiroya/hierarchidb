/**
 * @file TreeNodeEntityWithChildre.ts
 * @description Extended tree node type that includes hierarchical structure information
 * @module types
 */

import { DescendantsState, TreeNodeDatabaseEntity } from './';

/**
 * Represents a tree node with complete hierarchical information including children and descendants.
 * This is the primary type used throughout the UI for representing tree structures.
 *
 * @typedef {Object} TreeNodeEntityWithChildren
 * @extends {TreeNodeDatabaseEntity}
 *
 * @property {TreeNodeEntityWithChildren[]} [children] - Array of direct child nodes.
 *   - undefined: Children have not been loaded yet
 *   - empty array: Node has no children (leaf node)
 *   - populated array: Node has children that have been loaded
 *
 * @property {DescendantsState} [descendants] - Cached information about all descendants.
 *   Contains counts and metadata about the entire subtree for performance optimization.
 *   Used to display descendant counts without traversing the tree.
 *
 * @property {number} [depth] - Zero-based depth level in the tree hierarchy.
 *   - 0: Root node
 *   - 1: Direct children of root
 *   - n: Nodes at the nth level
 *   Used for indentation and visual hierarchy in tree tables.
 *
 * @example
 * ```typescript
 * const folderNode: TreeNodeEntityWithChildre = {
 *   id: 'folder-123',
 *   parentId: 'root',
 *   name: 'My Folder',
 *   type: TreeNodeTypes.ResourceFolder,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   children: [
 *     {
 *       id: 'file-456',
 *       parentId: 'folder-123',
 *       name: 'My File',
 *       type: TreeNodeTypes.StyleMap,
 *       createdAt: new Date(),
 *       updatedAt: new Date(),
 *       children: [],
 *       depth: 2
 *     }
 *   ],
 *   descendants: {
 *     count: 1,
 *     hasGrandchildren: false
 *   },
 *   depth: 1
 * };
 * ```
 *
 * @remarks
 * - Used by tree table components for rendering hierarchical data
 * - Children are loaded lazily to improve performance
 * - The descendants property is maintained by the database layer
 * - Depth is calculated during tree building operations
 */
export type TreeNodeEntityWithChildren = TreeNodeDatabaseEntity & {
  children?: Array<TreeNodeEntityWithChildren>;
  descendants?: DescendantsState;
  depth?: number;
};
