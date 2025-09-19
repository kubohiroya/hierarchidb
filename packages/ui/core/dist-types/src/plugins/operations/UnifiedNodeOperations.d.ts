import type { NodeId } from '@hierarchidb/common-type';
import { NodeDataAdapter } from '../adapters/NodeDataAdapter.js';
/**
 * Unified Node Operations
 *
 * Provides a consistent interface for CRUD operations across all node types.
 * Handles the coordination between plugins, data adapters, and UI services.
 */
export declare class UnifiedNodeOperations {
    private readonly nodeAdapter;
    private readonly notificationService;
    private readonly navigationService;
    private readonly dataRefreshService;
    private readonly dialogService;
    constructor(nodeAdapter: NodeDataAdapter, notificationService: NotificationService, navigationService: NavigationService, dataRefreshService: DataRefreshService, dialogService: DialogService);
    /**
     * Create a new node
     *
     * @param parentId - Parent node ID
     * @param nodeType - Type of node to create
     */
    createNode(parentId: NodeId, nodeType: string): Promise<void>;
    /**
     * Edit an existing node
     *
     * @param nodeId - Node ID to edit
     * @param nodeType - Node type
     */
    editNode(nodeId: NodeId, nodeType: string): Promise<void>;
    /**
     * Delete one or more nodes
     *
     * @param nodeIds - Array of node IDs to delete
     */
    deleteNodes(nodeIds: readonly NodeId[]): Promise<void>;
    /**
     * Get context menu items for a node
     *
     * @param nodeId - Node ID
     * @param nodeType - Node type
     * @param mousePosition - Mouse position for context menu
     * @returns Array of context menu items
     */
    getContextMenuItems(nodeId: NodeId, nodeType: string, mousePosition: {
        x: number;
        y: number;
    }): Promise<readonly any[]>;
    /**
     * Export nodes in the specified format
     *
     * @param nodeIds - Node IDs to export
     * @param format - Export format
     * @returns Export data as Blob
     */
    exportNodes(nodeIds: readonly NodeId[], format: string): Promise<Blob>;
    private executeBeforeShowCreateDialog;
    private showCreateDialog;
    private executeCreate;
    private executeBeforeStartEdit;
    private showEditDialog;
    private executeUpdate;
    private executeBeforeDelete;
    private executeDeletions;
    private groupNodesByType;
    private checkAnyHasChildren;
    private getCurrentContext;
    private getDefaultContextMenuItems;
    private showDefaultCreateDialog;
    private showDefaultEditDialog;
}
interface NotificationService {
    showSuccess(message: string): void;
    showError(message: string): void;
    showWarning(message: string): void;
    showInfo(message: string): void;
}
interface NavigationService {
    navigateTo(nodeId: NodeId): void;
    getCurrentPath(): readonly NodeId[];
}
interface DataRefreshService {
    refresh(nodeIds: readonly NodeId[]): void;
    refreshAll(): void;
}
interface DialogService {
    showConfirmDialog(options: {
        title: string;
        message: string;
        confirmText: string;
        cancelText: string;
    }): Promise<boolean>;
}
export {};
//# sourceMappingURL=UnifiedNodeOperations.d.ts.map