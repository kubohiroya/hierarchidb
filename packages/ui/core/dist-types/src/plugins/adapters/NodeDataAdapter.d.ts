import type { NodeId } from '@hierarchidb/common-type';
import type { UnifiedNodeData } from '../types.js';
/**
 * Node Data Adapter
 *
 * Bridges the Worker API with the UI Plugin system by providing a unified
 * interface for node data operations. Handles both TreeNode-only nodes (folders)
 * and Entity-based nodes (maps, projects) transparently.
 */
export declare class NodeDataAdapter {
    private readonly workerAPI;
    constructor(workerAPI: WorkerAPI);
    /**
     * Get direct access to workerAPI for advanced operations
     * @returns WorkerAPI instance
     */
    getWorkerAPI(): WorkerAPI;
    /**
     * Get unified node data for UI consumption
     *
     * Combines TreeNode and Entity data based on plugin configuration
     *
     * @param nodeId - The node ID to fetch
     * @param nodeType - The node type
     * @returns Unified node data for UI
     */
    getNodeData(nodeId: NodeId, nodeType: string): Promise<UnifiedNodeData>;
    /**
     * Create a new node
     *
     * @param parentId - Parent node ID
     * @param nodeType - Type of node to create
     * @param data - Node data
     * @returns Created node ID
     */
    createNode(parentId: NodeId, nodeType: string, data: any): Promise<NodeId>;
    /**
     * Update an existing node
     *
     * @param nodeId - Node ID to update
     * @param nodeType - Node type
     * @param changes - Changes to apply
     */
    updateNode(nodeId: NodeId, nodeType: string, changes: any): Promise<void>;
    /**
     * Delete a node
     *
     * @param nodeId - Node ID to delete
     * @param nodeType - Node type (for validation)
     */
    deleteNode(nodeId: NodeId, nodeType: string): Promise<void>;
    /**
     * Get children of a node
     *
     * @param nodeId - Parent node ID
     * @returns Array of child nodes
     */
    getChildren(nodeId: NodeId): Promise<readonly any[]>;
    /**
     * Check if a node has children
     *
     * @param nodeId - Node ID to check
     * @returns True if the node has children
     */
    hasChildren(nodeId: NodeId): Promise<boolean>;
    /**
     * Get child count for a node
     *
     * @param nodeId - Node ID to check
     * @returns Number of children
     */
    getChildCount(nodeId: NodeId): Promise<number>;
    /**
     * Move a node to a new parent
     *
     * @param nodeId - Node to move
     * @param newParentId - New parent node ID
     */
    moveNode(nodeId: NodeId, newParentId: NodeId): Promise<void>;
    /**
     * Create folder-plugin-specific combined data
     *
     * @param treeNode - TreeNode data
     * @param nodeId - Node ID for additional queries
     * @returns Combined data for folders
     */
    private createFolderData;
    /**
     * Create entity-specific combined data
     *
     * @param treeNode - TreeNode data
     * @param entity - Entity data
     * @returns Combined data for entity-based nodes
     */
    private createEntityData;
    /**
     * Extract TreeNode changes from a changes object
     *
     * @param changes - All changes
     * @returns TreeNode-specific changes
     */
    private extractTreeNodeChanges;
    /**
     * Extract Entity changes from a changes object
     *
     * @param changes - All changes
     * @returns Entity-specific changes
     */
    private extractEntityChanges;
    /**
     * Get the full path to a node
     *
     * @param nodeId - Node ID
     * @returns Array of node IDs representing the path
     */
    private getNodePath;
    /**
     * Calculate folder-plugin size (recursive)
     *
     * @param nodeId - Folder node ID
     * @returns Size in bytes (estimated)
     */
    private calculateFolderSize;
    /**
     * Calculate entity size
     *
     * @param entity - Entity data
     * @returns Size estimate in bytes
     */
    private calculateEntitySize;
}
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
//# sourceMappingURL=NodeDataAdapter.d.ts.map