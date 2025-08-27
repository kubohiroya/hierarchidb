/**
 * @file TreeQueryAPI.ts
 * @description Read-only data access API for tree and node queries
 * 
 * This API provides efficient query operations for retrieving tree structures,
 * node information, and performing searches without modifying data.
 */

import type { TreeId, NodeId, Tree, TreeNode } from '@hierarchidb/common-core';

/**
 * Read-only data access API for tree and node queries
 * 
 * Provides comprehensive query capabilities for tree structures including
 * hierarchy traversal, node relationships, and advanced search functionality.
 * All operations are read-only and do not modify the underlying data.
 * 
 * @remarks
 * This API is optimized for performance with caching strategies and
 * efficient query patterns. Large result sets are automatically paginated.
 */
export interface TreeQueryAPI {
  /**
   * Retrieve tree information by ID
   * 
   * @param treeId - Unique identifier of the tree to retrieve
   * @returns Tree object if found, undefined if not exists
   * 
   * @example
   * ```typescript
   * const tree = await queryAPI.getTree('tree-123' as TreeId);
   * if (tree) {
   *   console.log(`Tree name: ${tree.name}`);
   *   console.log(`Root node: ${tree.rootId}`);
   * }
   * ```
   * 
   * @throws {Error} If database connection fails
   */
  getTree(treeId: TreeId): Promise<Tree | undefined>;

  /**
   * List all available trees in the system
   * 
   * @returns Array of all trees, empty array if none exist
   * 
   * @example
   * ```typescript
   * const trees = await queryAPI.listTrees();
   * trees.forEach(tree => {
   *   console.log(`${tree.name} (${tree.id})`);
   * });
   * ```
   * 
   * @remarks
   * Results are cached for performance. Cache invalidates on tree creation/deletion.
   * For large datasets, consider pagination through WorkerAPI.
   */
  listTrees(): Promise<Tree[]>;

  /**
   * Retrieve node information by ID
   * 
   * @param nodeId - Unique identifier of the node to retrieve
   * @returns TreeNode object if found, undefined if not exists
   * 
   * @example
   * ```typescript
   * const node = await queryAPI.getNode('node-456' as NodeId);
   * if (node) {
   *   console.log(`Node: ${node.name}`);
   *   console.log(`Type: ${node.nodeType}`);
   *   console.log(`Parent: ${node.parentId}`);
   * }
   * ```
   * 
   * @remarks
   * This method checks both active nodes and trash.
   * Use `node.isRemoved` to determine if node is in trash.
   */
  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;

  /**
   * List immediate children of a specified node
   * 
   * @param parentId - ID of the parent node
   * @returns Array of child nodes, sorted by creation time
   * 
   * @example
   * ```typescript
   * const children = await queryAPI.listChildren(parentNodeId);
   * console.log(`Found ${children.length} children`);
   * 
   * // Process each child
   * for (const child of children) {
   *   console.log(`- ${child.name} (${child.nodeType})`);
   * }
   * ```
   * 
   * @remarks
   * Only returns direct children (depth=1). For all descendants, use `listDescendants`.
   * Results exclude nodes in trash unless parent is trash root.
   */
  listChildren(parentId: NodeId): Promise<TreeNode[]>;

  /**
   * List all descendant nodes from a specified starting point
   * 
   * @param nodeId - Starting node ID for traversal
   * @param maxDepth - Maximum traversal depth (unlimited if omitted)
   * @returns Array of descendant nodes in depth-first order
   * 
   * @example
   * ```typescript
   * // Get all descendants
   * const allDescendants = await queryAPI.listDescendants(rootId);
   * 
   * // Get descendants up to 2 levels deep
   * const shallowDescendants = await queryAPI.listDescendants(rootId, 2);
   * 
   * // Count total nodes in subtree
   * const nodeCount = allDescendants.length + 1; // +1 for root
   * ```
   * 
   * @remarks
   * - Returns empty array if node has no descendants
   * - Performance: O(n) where n is number of descendants
   * - For large trees, consider using pagination or streaming
   * 
   * @throws {Error} If nodeId doesn't exist
   */
  listDescendants(nodeId: NodeId, maxDepth?: number): Promise<TreeNode[]>;

  /**
   * List all ancestor nodes from a node to root
   * 
   * @param nodeId - Starting node ID
   * @returns Array of ancestors ordered from root to immediate parent
   * 
   * @example
   * ```typescript
   * const ancestors = await queryAPI.listAncestors(nodeId);
   * 
   * // Build breadcrumb path
   * const breadcrumb = ancestors
   *   .map(node => node.name)
   *   .join(' > ');
   * 
   * // Get immediate parent (last item)
   * const parent = ancestors[ancestors.length - 1];
   * 
   * // Check depth in tree
   * const depth = ancestors.length;
   * ```
   * 
   * @remarks
   * - Returns empty array for root nodes
   * - Includes all nodes from root to immediate parent
   * - Does not include the node itself
   * 
   * @throws {Error} If nodeId doesn't exist
   */
  listAncestors(nodeId: NodeId): Promise<TreeNode[]>;

  /**
   * Advanced node search with flexible matching options
   * 
   * Performs efficient text-based search across node names and optionally descriptions.
   * Supports multiple matching modes and search constraints for performance optimization.
   * 
   * @param options - Search configuration object
   * @param options.rootNodeId - Starting node for search scope
   * @param options.query - Search query string (min 1 character)
   * @param options.mode - Text matching strategy:
   *   - 'exact': Full string match
   *   - 'prefix': Starts with query
   *   - 'suffix': Ends with query  
   *   - 'partial': Contains query (default)
   * @param options.maxDepth - Maximum tree depth to search (unlimited if omitted)
   * @param options.maxResults - Maximum results to return (default: 100)
   * @param options.caseSensitive - Enable case-sensitive matching (default: false)
   * @param options.searchInDescription - Include descriptions in search (default: false)
   * 
   * @returns Array of matching nodes sorted by relevance
   * 
   * @example
   * ```typescript
   * // Simple search
   * const results = await queryAPI.searchNodes({
   *   rootNodeId: treeRootId,
   *   query: 'config'
   * });
   * 
   * // Advanced search with options
   * const advancedResults = await queryAPI.searchNodes({
   *   rootNodeId: folderNode,
   *   query: 'test',
   *   mode: 'prefix',
   *   maxDepth: 3,
   *   maxResults: 50,
   *   caseSensitive: false,
   *   searchInDescription: true
   * });
   * 
   * // Process results
   * advancedResults.forEach(node => {
   *   console.log(`Found: ${node.name} at ${node.parentId}`);
   * });
   * ```
   * 
   * @remarks
   * - Empty query returns empty array
   * - Special characters are escaped in regex modes
   * - Results are deduplicated
   * - Performance scales with tree size and maxDepth
   * - Consider using subscriptions for real-time search updates
   * 
   * @throws {Error} If rootNodeId doesn't exist
   * @throws {RangeError} If query length exceeds 256 characters
   */
  searchNodes(options: {
    rootNodeId: NodeId;
    query: string;
    mode?: 'exact' | 'prefix' | 'suffix' | 'partial';
    maxDepth?: number;
    maxResults?: number;
    caseSensitive?: boolean;
    searchInDescription?: boolean;
  }): Promise<TreeNode[]>;
}