import type { ListChildrenOptions, TreeQueryAPI } from '@hierarchidb/common-api';
import type {
  CommandResult,
  CopyNodesPayload,
  ExportNodesPayload,
  GetAncestorsPayload,
  GetChildrenPayload,
  GetDescendantsPayload,
  NodeId,
  Tree,
  TreeId,
  TreeNode,
} from '@hierarchidb/common-types';
import { SingletonMixin } from '@hierarchidb/util';
import type { CoreDB } from './CoreDB.js';

export class TreeQueryService implements TreeQueryAPI {
  static async getSingleton(coreDB: CoreDB): Promise<TreeQueryService> {
    return SingletonMixin.getSingleton('TreeQueryService', () => {
      return new TreeQueryService(coreDB);
    });
  }

  constructor(private coreDB: CoreDB) {}

  // Basic Query Operations

  async getTrees(): Promise<Tree[]> {
    return (await this.coreDB.listTrees()) || [];
  }

  async getTree(treeId: TreeId): Promise<Tree | undefined> {
    const result = await this.coreDB.getTree(treeId);

    return result;
  }

  async listTrees(): Promise<Tree[]> {
    return (await this.coreDB.listTrees()) || [];
  }

  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    // Validate that nodeId is present and valid
    if (!nodeId || typeof nodeId !== 'string') {
      console.warn('Invalid node ID provided to getNode:', nodeId);
      return undefined;
    }

    return await this.coreDB.getNode(nodeId);
  }

  async listChildren(parentId: NodeId, options?: ListChildrenOptions): Promise<TreeNode[]> {
    const initial = await this.coreDB.listChildren(parentId, options);

    const requestedDepth = options?.prefetch?.depth ?? 1;
    if (requestedDepth <= 1) {
      return initial;
    }

    const hasPrefetchedDescendants = initial.some(
      (node) => node.parentId && node.parentId !== parentId
    );
    if (hasPrefetchedDescendants) {
      return initial;
    }

    const result = [...initial];
    const queue: Array<{ node: TreeNode; depth: number }> = initial.map((node) => ({
      node,
      depth: 1,
    }));
    const visited = new Set<string>(initial.map((node) => String(node.id)));

    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        break;
      }
      const { node, depth } = next;
      if (depth >= requestedDepth) {
        continue;
      }

      const children = await this.coreDB.listChildren(node.id as NodeId);
      if (!children || children.length === 0) {
        continue;
      }

      for (const child of children) {
        const key = String(child.id);
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        result.push(child);
        queue.push({ node: child, depth: depth + 1 });
      }
    }

    return result;
  }

  async listDescendants(nodeId: NodeId, maxDepth?: number): Promise<TreeNode[]> {
    // Iterative DFS to avoid recursion pitfalls and ensure full coverage
    const out: TreeNode[] = [];
    const stack: Array<{ id: NodeId; depth: number }> = [{ id: nodeId, depth: 0 }];
    const seen = new Set<NodeId>();

    while (stack.length) {
      const next = stack.pop();
      if (!next) {
        continue;
      }
      const { id, depth } = next;
      if (maxDepth !== undefined && depth >= maxDepth) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      const children = await this.listChildren(id);
      if (!children || children.length === 0) continue;

      for (const ch of children) {
        out.push(ch);
        stack.push({ id: ch.id, depth: depth + 1 });
      }
    }
    return out;
  }

  async listAncestors(nodeId: NodeId): Promise<TreeNode[]> {
    const ancestors: TreeNode[] = [];
    let currentNodeId: NodeId | undefined = nodeId;

    while (currentNodeId) {
      const node = await this.getNode(currentNodeId);
      if (!node || !node.parentId) break;

      const parent = await this.getNode(node.parentId);
      if (!parent) break;

      ancestors.unshift(parent); // Add to beginning to get root-first order
      currentNodeId = parent.id as NodeId;
    }

    return ancestors;
  }

  async searchNodes(options: {
    rootNodeId: NodeId;
    query: string;
    mode?: 'exact' | 'prefix' | 'suffix' | 'partial';
    maxDepth?: number;
    maxResults?: number;
    caseSensitive?: boolean;
    searchInDescription?: boolean;
  }): Promise<TreeNode[]> {
    const {
      rootNodeId,
      query,
      mode = 'partial',
      maxDepth,
      maxResults,
      caseSensitive = false,
      searchInDescription = false,
    } = options;

    const results: TreeNode[] = [];
    const descendants = await this.listDescendants(rootNodeId, maxDepth);

    const searchString = caseSensitive ? query : query.toLowerCase();

    for (const node of descendants) {
      if (maxResults && results.length >= maxResults) break;

      const nodeName = caseSensitive ? node.metadata.name : node.metadata.name.toLowerCase();
      const rawDescription = node.metadata.description ?? '';
      const nodeDesc = searchInDescription
        ? caseSensitive
          ? rawDescription
          : rawDescription.toLowerCase()
        : '';

      let matches = false;

      const checkMatch = (text: string): boolean => {
        switch (mode) {
          case 'exact':
            return text === searchString;
          case 'prefix':
            return text.startsWith(searchString);
          case 'suffix':
            return text.endsWith(searchString);
          default:
            return text.includes(searchString);
        }
      };

      if (checkMatch(nodeName) || (searchInDescription && checkMatch(nodeDesc))) {
        matches = true;
      }

      if (matches) {
        results.push(node);
      }
    }

    return results;
  }

  // Legacy methods for backward compatibility
  async getChildren(payload: GetChildrenPayload): Promise<TreeNode[]> {
    const { parentId, sortBy = 'createdAt', sortOrder = 'asc', limit, offset } = payload;

    let childNodes = await this.listChildren(parentId);

    // Apply sorting
    if (sortBy) {
      childNodes = childNodes.sort((a, b) => {
        const getComparable = (node: TreeNode): string | number | undefined => {
          switch (sortBy) {
            case 'name':
              return node.metadata.name?.toLowerCase();
            case 'createdAt':
              return node.createdAt;
            case 'updatedAt':
              return node.updatedAt;
            default:
              return undefined;
          }
        };

        const valueA = getComparable(a);
        const valueB = getComparable(b);

        if (valueA == null && valueB == null) return 0;
        if (valueA == null) return sortOrder === 'desc' ? 1 : -1;
        if (valueB == null) return sortOrder === 'desc' ? -1 : 1;

        if (typeof valueA === 'string' && typeof valueB === 'string') {
          const comparison = valueA.localeCompare(valueB);
          return sortOrder === 'desc' ? -comparison : comparison;
        }

        const numericA = Number(valueA);
        const numericB = Number(valueB);
        const comparison = numericA === numericB ? 0 : numericA < numericB ? -1 : 1;
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    if (offset !== undefined) {
      childNodes = childNodes.slice(offset);
    }
    if (limit !== undefined) {
      childNodes = childNodes.slice(0, limit);
    }

    return childNodes;
  }

  async getDescendants(payload: GetDescendantsPayload): Promise<TreeNode[]> {
    const { rootId, maxDepth, includeTypes, excludeTypes } = payload;

    const descendants: TreeNode[] = [];
    const visited = new Set<NodeId>();

    const collectDescendants = async (nodeId: NodeId, currentDepth: number) => {
      if (visited.has(nodeId)) return; // Prevent infinite loops
      visited.add(nodeId);

      // If we've exceeded the depth limit, don't process children
      if (maxDepth !== undefined && currentDepth >= maxDepth) {
        return;
      }

      const childNodes = await this.coreDB.listChildren(nodeId);

      for (const childNode of childNodes) {
        // Check if this childNode matches the type filter
        const childMatches =
          (!includeTypes || includeTypes.includes(childNode.nodeType)) &&
          (!excludeTypes || !excludeTypes.includes(childNode.nodeType));

        if (childMatches) {
          descendants.push(childNode);
        }

        // Always recurse to find deeper matching descendants, regardless of current node type
        await collectDescendants(childNode.id, currentDepth + 1);
      }
    };

    await collectDescendants(rootId, 0);
    return descendants;
  }

  async getAncestors(payload: GetAncestorsPayload): Promise<TreeNode[]> {
    const { nodeId } = payload;

    const ancestors: TreeNode[] = [];
    let currentId = nodeId;
    const visited = new Set<NodeId>();

    while (currentId) {
      if (visited.has(currentId)) {
        // Circular reference detected, break to prevent infinite loop
        break;
      }
      visited.add(currentId);

      const node = await this.coreDB.getNode(currentId);
      if (!node) {
        break;
      }

      ancestors.push(node);

      // Stop if we reached the root or super root
      if (!node.parentId || node.parentId === currentId) {
        break;
      }

      currentId = node.parentId;
    }

    return ancestors;
  }

  // Search Operations - removed duplicate implementation

  // Copy/Export Operations

  /**
   * :
   * :
   * :
   * : DoS
   * : docs/14-copy-paste-analysis.md
   */
  async copyNodes(payload: CopyNodesPayload): Promise<CommandResult> {
    const { nodeIds } = payload;

    try {
      //  : :
      if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
        return {
          success: false,
          error: 'Invalid nodeIds: must be a non-empty array',
          code: 'INVALID_OPERATION',
        };
      }

      //  : DoS:
      const MAX_COPY_NODES = 1000; //  :
      if (nodeIds.length > MAX_COPY_NODES) {
        return {
          success: false,
          error: `Too many nodes specified (max: ${MAX_COPY_NODES})`,
          code: 'INVALID_OPERATION',
        };
      }

      //  : nodeId
      const validNodeIds: NodeId[] = nodeIds.filter(
        (id) => typeof id === 'string' && id.length > 0 && id.length <= 255
      ) as NodeId[];

      if (validNodeIds.length === 0) {
        return {
          success: false,
          error: 'No valid nodeIds provided',
          code: 'INVALID_OPERATION',
        };
      }

      const nodeData: Record<string, TreeNode> = {};
      const allNodes = new Set<NodeId>();

      //  :
      for (const nodeId of validNodeIds) {
        const descendants = await this.getAllDescendantsWithSelf(nodeId);

        //  :
        descendants.forEach((node) => {
          if (!nodeData[node.id]) {
            nodeData[node.id] = node;
            allNodes.add(node.id);
          }
        });

        //  : :
        if (Object.keys(nodeData).length > MAX_COPY_NODES) {
          return {
            success: false,
            error: `Too many descendant nodes (max: ${MAX_COPY_NODES})`,
            code: 'INVALID_OPERATION',
          };
        }
      }

      //  :
      const clipboardData = {
        type: 'nodes-copy' as const, //  :
        timestamp: Date.now(), //  :
        nodes: nodeData, //  :
        rootIds: validNodeIds, //  :
        nodeCount: Object.keys(nodeData).length, //  :
      };

      //  :
      return {
        success: true,
        seq: this.getNextSeq(),
        clipboardData,
      };
    } catch (error) {
      //  :
      console.error('Copy operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Copy operation failed',
        code: 'INVALID_OPERATION',
      };
    }
  }

  async exportNodes(payload: ExportNodesPayload): Promise<CommandResult> {
    const { nodeIds } = payload;

    try {
      const exportData: {
        nodes: Record<string, TreeNode>;
        metadata: {
          exportedAt: number;
          rootIds: string[];
          totalNodes: number;
        };
      } = {
        nodes: {},
        metadata: {
          exportedAt: Date.now(),
          rootIds: nodeIds,
          totalNodes: 0,
        },
      };

      // Collect all nodes including descendants
      for (const nodeId of nodeIds) {
        const descendants = await this.getAllDescendantsWithSelf(nodeId);
        descendants.forEach((node) => {
          exportData.nodes[node.id] = node;
        });
      }

      exportData.metadata.totalNodes = Object.keys(exportData.nodes).length;

      // In a real implementation, this would be written to a file or returned as a download
      // For now, we just return success with the data reference

      return {
        success: true,
        seq: this.getNextSeq(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export operation failed',
        code: 'NODE_NOT_FOUND',
      };
    }
  }

  // Helper Methods

  private async getAllDescendantsWithSelf(nodeId: NodeId): Promise<TreeNode[]> {
    const result: TreeNode[] = [];
    const visited = new Set<NodeId>();

    const collectNodes = async (currentId: NodeId) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const node = await this.coreDB.getNode(currentId);
      // Include the node if it exists (but don't stop if it doesn't - virtual root nodes may not exist)
      if (node) {
        result.push(node);
      }

      // Always process children regardless of whether the parent node exists
      // This handles virtual root nodes that don't exist as records but have children
      const children = await this.coreDB.listChildren(currentId);
      for (const childNode of children) {
        await collectNodes(childNode.id);
      }
    };

    await collectNodes(nodeId);
    return result;
  }

  // getAllNodes helper omitted in this baseline

  private getNextSeq(): number {
    // In a real implementation, this should be managed by CommandProcessor
    return Date.now();
  }

  async searchNodesFulltext(options: {
    rootNodeId: NodeId;
    query: string;
    maxResults?: number;
    locale?: string;
  }): Promise<TreeNode[]> {
    // Fulltext indexing is currently disabled/removed.
    void options;
    return [];
  }
}
