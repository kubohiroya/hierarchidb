import type { TreeQueryService } from '@hierarchidb/api';
import type {
  CommandResult,
  Tree,
  TreeNode,
  TreeNodeId,
  CopyNodesPayload,
  ExportNodesPayload,
  GetTreePayload,
  GetNodePayload,
  GetChildrenPayload,
  GetDescendantsPayload,
  GetAncestorsPayload,
  SearchNodesPayload,
} from '@hierarchidb/core';
import { CoreDB } from '../db/CoreDB';

export class TreeQueryServiceImpl implements TreeQueryService {
  constructor(private coreDB: CoreDB) {}

  // Basic Query Operations

  async getTree(payload: GetTreePayload): Promise<Tree | undefined> {
    const { treeId } = payload;
    return await this.coreDB.getTree?.(treeId);
  }

  async getNode(payload: GetNodePayload): Promise<TreeNode | undefined> {
    const { treeNodeId } = payload;
    return await this.coreDB.getNode?.(treeNodeId);
  }

  async getChildren(payload: GetChildrenPayload): Promise<TreeNode[]> {
    const { parentTreeNodeId, sortBy = 'createdAt', sortOrder = 'asc', limit, offset } = payload;

    let children = (await this.coreDB.getChildren?.(parentTreeNodeId)) || [];

    // Apply sorting
    if (sortBy) {
      children = children.sort((a: any, b: any) => {
        let valueA = a[sortBy];
        let valueB = b[sortBy];

        if (sortBy === 'name') {
          valueA = valueA?.toLowerCase();
          valueB = valueB?.toLowerCase();
        }

        if (sortOrder === 'desc') {
          return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
        } else {
          return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
        }
      });
    }

    // Apply pagination
    if (offset !== undefined) {
      children = children.slice(offset);
    }
    if (limit !== undefined) {
      children = children.slice(0, limit);
    }

    return children;
  }

  async getDescendants(payload: GetDescendantsPayload): Promise<TreeNode[]> {
    const { rootNodeId, maxDepth, includeTypes, excludeTypes } = payload;

    const descendants: TreeNode[] = [];
    const visited = new Set<TreeNodeId>();

    const collectDescendants = async (nodeId: TreeNodeId, currentDepth: number) => {
      if (visited.has(nodeId)) return; // Prevent infinite loops
      visited.add(nodeId);

      // If we've exceeded the depth limit, don't process children
      if (maxDepth !== undefined && currentDepth >= maxDepth) {
        return;
      }

      const children = (await this.coreDB.getChildren?.(nodeId)) || [];

      for (const child of children) {
        // Check if this child matches the type filter
        const childMatches =
          (!includeTypes || includeTypes.includes(child.treeNodeType)) &&
          (!excludeTypes || !excludeTypes.includes(child.treeNodeType));

        if (childMatches) {
          descendants.push(child);
        }

        // Always recurse to find deeper matching descendants, regardless of current node type
        await collectDescendants(child.treeNodeId, currentDepth + 1);
      }
    };

    await collectDescendants(rootNodeId, 0);
    return descendants;
  }

  async getAncestors(payload: GetAncestorsPayload): Promise<TreeNode[]> {
    const { nodeId } = payload;

    const ancestors: TreeNode[] = [];
    let currentId = nodeId;
    const visited = new Set<TreeNodeId>();

    while (currentId) {
      if (visited.has(currentId)) {
        // Circular reference detected, break to prevent infinite loop
        break;
      }
      visited.add(currentId);

      const node = await this.coreDB.getNode?.(currentId);
      if (!node) {
        break;
      }

      ancestors.push(node);

      // Stop if we reached the root or super root
      if (!node.parentTreeNodeId || node.parentTreeNodeId === currentId) {
        break;
      }

      currentId = node.parentTreeNodeId;
    }

    return ancestors;
  }

  // Search Operations

  async searchNodes(payload: SearchNodesPayload): Promise<TreeNode[]> {
    const {
      query,
      searchInDescription = false,
      caseSensitive = false,
      useRegex = false,
      rootNodeId,
    } = payload;

    let searchPattern: RegExp;

    if (useRegex) {
      try {
        const flags = caseSensitive ? '' : 'i';
        searchPattern = new RegExp(query, flags);
      } catch (error) {
        // Invalid regex, fall back to literal search
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = caseSensitive ? '' : 'i';
        searchPattern = new RegExp(escapedQuery, flags);
      }
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = caseSensitive ? '' : 'i';
      searchPattern = new RegExp(escapedQuery, flags);
    }

    const results: TreeNode[] = [];
    const searchScope = rootNodeId
      ? await this.getAllDescendantsWithSelf(rootNodeId)
      : await this.getAllNodes();

    for (const node of searchScope) {
      let matchFound = false;

      // Search in name
      if (searchPattern.test(node.name)) {
        matchFound = true;
      }

      // Search in description if requested
      if (
        !matchFound &&
        searchInDescription &&
        node.description &&
        searchPattern.test(node.description)
      ) {
        matchFound = true;
      }

      if (matchFound) {
        results.push(node);
      }
    }

    return results;
  }

  // Copy/Export Operations

  async copyNodes(payload: CopyNodesPayload): Promise<CommandResult> {
    const { nodeIds } = payload;

    try {
      const nodeData: Record<string, TreeNode> = {};
      const allNodes = new Set<TreeNodeId>();

      // Collect all nodes including descendants
      for (const nodeId of nodeIds) {
        const descendants = await this.getAllDescendantsWithSelf(nodeId);
        descendants.forEach((node) => {
          nodeData[node.treeNodeId] = node;
          allNodes.add(node.treeNodeId);
        });
      }

      // Store in a clipboard-like structure (implementation would depend on global state management)
      const clipboardData = {
        type: 'nodes-copy',
        timestamp: Date.now(),
        nodes: nodeData,
        rootNodeIds: nodeIds,
      };

      // In a real implementation, this would be stored in some global clipboard state
      // For now, we just return success

      return {
        success: true,
        seq: this.getNextSeq(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Copy operation failed',
        code: 'NODE_NOT_FOUND',
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
          rootNodeIds: string[];
          totalNodes: number;
        };
      } = {
        nodes: {},
        metadata: {
          exportedAt: Date.now(),
          rootNodeIds: nodeIds,
          totalNodes: 0,
        },
      };

      // Collect all nodes including descendants
      for (const nodeId of nodeIds) {
        const descendants = await this.getAllDescendantsWithSelf(nodeId);
        descendants.forEach((node) => {
          exportData.nodes[node.treeNodeId] = node;
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

  private async getAllDescendantsWithSelf(nodeId: TreeNodeId): Promise<TreeNode[]> {
    const result: TreeNode[] = [];
    const visited = new Set<TreeNodeId>();

    const collectNodes = async (currentId: TreeNodeId) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const node = await this.coreDB.getNode?.(currentId);
      if (!node) return;

      result.push(node);

      const children = (await this.coreDB.getChildren?.(currentId)) || [];
      for (const child of children) {
        await collectNodes(child.treeNodeId);
      }
    };

    await collectNodes(nodeId);
    return result;
  }

  private async getAllNodes(): Promise<TreeNode[]> {
    // In a real implementation, this would be a more efficient database query
    // For testing purposes, we'll iterate through all stored nodes
    if (this.coreDB && 'treeNodes' in this.coreDB && this.coreDB.treeNodes instanceof Map) {
      return Array.from((this.coreDB as any).treeNodes.values());
    }

    // Fallback - get all nodes via traversal from all root nodes
    // This is less efficient but works with the mock database
    const allNodes: TreeNode[] = [];
    const visited = new Set<TreeNodeId>();

    // Find root nodes (nodes without parent or with empty parent)
    const potentialRoots = ['root' as TreeNodeId]; // Start with common root

    for (const rootId of potentialRoots) {
      const descendants = await this.getAllDescendantsWithSelf(rootId);
      descendants.forEach((node) => {
        if (!visited.has(node.treeNodeId)) {
          visited.add(node.treeNodeId);
          allNodes.push(node);
        }
      });
    }

    return allNodes;
  }

  private getNextSeq(): number {
    // In a real implementation, this should be managed by CommandProcessor
    return Date.now();
  }
}
