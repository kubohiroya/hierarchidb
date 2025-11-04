/**
 * Read-only data access API for console and node queries.
 *
 * This API provides efficient query operations for retrieving console structures,
 * node information, and performing searches without modifying data.
 */
import type { NodeId, Tree, TreeId, TreeNode } from '@hierarchidb/common-types';

/**
 * Read-only data access API for console and node queries
 *
 * Provides comprehensive query capabilities for console structures including
 * hierarchy traversal, node relationships, and advanced search functionality.
 * All operations are read-only and do not modify the underlying data.
 *
 * @remarks
 * This API is optimized for performance with caching strategies and
 * efficient query patterns. Large result sets are automatically paginated.
 */
export interface ListChildrenPrefetchOptions {
  depth: number;
}

export interface ListChildrenOptions {
  prefetch?: ListChildrenPrefetchOptions;
}

export interface TreeQueryAPI {
  /**
   * Retrieve console information by ID
   *
   * @param treeId - Unique identifier of the console to retrieve
   * @returns TreeTypes object if found, undefined if not exists
   *
   * @example
   * ```typescript
   * const console = await queryAPI.getTree('console-123' as TreeId);
   * if (console) {
   *   console.log(`TreeTypes name: ${console.name}`);
   *   console.log(`Root node: ${console.rootId}`);
   * }
   * ```
   *
   * @throws Error - Thrown when the database connection cannot be established.
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
   * trees.forEach(console => {
   *   console.log(`${console.name} (${console.id})`);
   * });
   * ```
   *
   * @remarks
   * Results are cached for performance. Cache invalidates on console creation/deletion.
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
  listChildren(parentId: NodeId, options?: ListChildrenOptions): Promise<TreeNode[]>;

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
   * @throws Error - Thrown when the requested node cannot be found.
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
   * // Check depth in console
   * const depth = ancestors.length;
   * ```
   *
   * @remarks
   * - Returns empty array for root nodes
   * - Includes all nodes from root to immediate parent
   * - Does not include the node itself
   *
   * @throws Error - Thrown when the requested node cannot be found.
   */
  listAncestors(nodeId: NodeId): Promise<TreeNode[]>;

  /**
   * Advanced node search with flexible matching options
   *
   * Performs efficient text-based search across node names and optionally descriptions.
   * Supports multiple matching modes and search constraints for performance optimization.
   *
   * @param options - Search configuration object.
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
   * - Empty query returns empty array.
   * - Special characters are escaped in regex modes.
   * - Results are deduplicated.
   * - Performance scales with console size and `maxDepth`.
   * - Consider using subscriptions for real-time search updates.
   * - `query` must contain at least one character (length ≤ 256 enforced separately).
   * - `rootNodeId` sets the search scope (defaults to the entire console).
   * - `mode` accepts `'exact' | 'prefix' | 'suffix' | 'partial'` (defaults to `'partial'`).
   * - `maxDepth` limits traversal depth; when omitted the search is unbounded.
   * - `maxResults` caps the number of returned nodes (defaults to `100`).
   * - `caseSensitive` toggles case-sensitive comparisons (defaults to `false`).
   * - `searchInDescription` includes description fields in the search (defaults to `false`).
   *
   * @throws Error - Thrown when the `rootNodeId` cannot be resolved.
   * @throws RangeError - Thrown when the query length exceeds 256 characters.
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
