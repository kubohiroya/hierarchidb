import type { NodeId } from '@hierarchidb/common-core';
import type { UIPluginDefinition } from '../types';
import { getUIPluginRegistry } from '../registry/UIPluginRegistry';
import { NodeDataAdapter } from '../adapters/NodeDataAdapter';

/**
 * Unified Node Operations
 *
 * Provides a consistent interface for CRUD operations across all node types.
 * Handles the coordination between plugins, data adapters, and UI services.
 */
export class UnifiedNodeOperations {
  constructor(
    private readonly nodeAdapter: NodeDataAdapter,
    private readonly notificationService: NotificationService,
    private readonly navigationService: NavigationService,
    private readonly dataRefreshService: DataRefreshService,
    private readonly dialogService: DialogService
  ) {}

  /**
   * Create a new node
   *
   * @param parentId - Parent node ID
   * @param nodeType - Type of node to create
   */
  async createNode(parentId: NodeId, nodeType: string): Promise<void> {
    const plugin = getUIPluginRegistry().get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }

    try {
      // 1. Pre-creation checks
      const beforeResult = await this.executeBeforeShowCreateDialog(plugin, parentId, nodeType);
      if (!beforeResult?.proceed) {
        if (beforeResult?.message) {
          this.notificationService.showWarning(beforeResult.message);
        }
        return;
      }

      // 2. Show creation dialog
      await this.showCreateDialog(plugin, parentId, nodeType);
    } catch (error) {
      console.error('Error creating node:', error);
      this.notificationService.showError(`Failed to create ${plugin.displayName}`);
    }
  }

  /**
   * Edit an existing node
   *
   * @param nodeId - Node ID to edit
   * @param nodeType - Node type
   */
  async editNode(nodeId: NodeId, nodeType: string): Promise<void> {
    const plugin = getUIPluginRegistry().get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }

    try {
      // Get current data
      const nodeData = await this.nodeAdapter.getNodeData(nodeId, nodeType);

      // Pre-edit checks
      const beforeResult = await this.executeBeforeStartEdit(plugin, nodeId, nodeData.combinedData);
      if (!beforeResult?.proceed) {
        if (beforeResult?.message) {
          this.notificationService.showWarning(beforeResult.message);
        }
        return;
      }

      // Show edit dialog
      await this.showEditDialog(plugin, nodeId, nodeData.combinedData);
    } catch (error) {
      console.error('Error editing node:', error);
      this.notificationService.showError(`Failed to edit ${plugin.displayName}`);
    }
  }

  /**
   * Delete one or more nodes
   *
   * @param nodeIds - Array of node IDs to delete
   */
  async deleteNodes(nodeIds: readonly NodeId[]): Promise<void> {
    if (nodeIds.length === 0) return;

    try {
      // Group nodes by type for efficient processing
      const nodesByType = await this.groupNodesByType(nodeIds);

      // Execute pre-delete checks for each type
      const confirmMessages: string[] = [];
      for (const [nodeType, nodes] of nodesByType) {
        const plugin = getUIPluginRegistry().get(nodeType);
        if (!plugin) continue;

        const beforeResult = await this.executeBeforeDelete(plugin, nodes);
        if (!beforeResult?.proceed) {
          this.notificationService.showWarning(
            `Cannot delete ${plugin.displayName}(s): ${beforeResult?.confirmMessage || 'Operation not allowed'}`
          );
          return;
        }

        if (beforeResult?.confirmMessage) {
          confirmMessages.push(beforeResult.confirmMessage);
        }
      }

      // Show confirmation dialog if needed
      if (confirmMessages.length > 0) {
        const confirmed = await this.dialogService.showConfirmDialog({
          title: 'Confirm Deletion',
          message: confirmMessages.join('\n\n'),
          confirmText: 'Delete',
          cancelText: 'Cancel',
        });

        if (!confirmed) return;
      }

      // Execute deletions
      await this.executeDeletions(nodesByType);

      // Show success message
      this.notificationService.showSuccess(`${nodeIds.length} item(s) deleted successfully`);
    } catch (error) {
      console.error('Error deleting nodes:', error);
      this.notificationService.showError('Failed to delete items');
    }
  }

  /**
   * Get context menu items for a node
   *
   * @param nodeId - Node ID
   * @param nodeType - Node type
   * @param mousePosition - Mouse position for context menu
   * @returns Array of context menu items
   */
  async getContextMenuItems(
    nodeId: NodeId,
    nodeType: string,
    mousePosition: { x: number; y: number }
  ): Promise<readonly any[]> {
    const plugin = getUIPluginRegistry().get(nodeType);
    if (!plugin || !plugin.hooks.onContextMenu) {
      return this.getDefaultContextMenuItems(nodeId, nodeType);
    }

    try {
      const nodeData = await this.nodeAdapter.getNodeData(nodeId, nodeType);

      return await plugin.hooks.onContextMenu({
        nodeId,
        data: nodeData.combinedData,
        mousePosition,
      });
    } catch (error) {
      console.error('Error getting context menu:', error);
      return this.getDefaultContextMenuItems(nodeId, nodeType);
    }
  }

  /**
   * Export nodes in the specified format
   *
   * @param nodeIds - Node IDs to export
   * @param format - Export format
   * @returns Export data as Blob
   */
  async exportNodes(nodeIds: readonly NodeId[], format: string): Promise<Blob> {
    if (nodeIds.length === 0) {
      throw new Error('No nodes selected for export');
    }

    // Group nodes by type
    const nodesByType = await this.groupNodesByType(nodeIds);

    // For now, handle single type exports
    if (nodesByType.size > 1) {
      throw new Error('Mixed node type exports not yet supported');
    }

    const firstEntry = Array.from(nodesByType.entries())[0];
    if (!firstEntry) {
      throw new Error('No nodes found for export');
    }
    const [nodeType, nodes] = firstEntry;
    const plugin = getUIPluginRegistry().get(nodeType);

    if (!plugin || !plugin.hooks.onExport) {
      throw new Error(`Export not supported for ${nodeType}`);
    }

    try {
      return await plugin.hooks.onExport({
        nodeIds: nodes.map((n: any) => n.id),
        format,
      });
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private methods

  private async executeBeforeShowCreateDialog(
    plugin: UIPluginDefinition,
    parentId: NodeId,
    nodeType: string
  ) {
    if (!plugin.hooks.beforeShowCreateDialog) {
      return { proceed: true };
    }

    return await plugin.hooks.beforeShowCreateDialog({
      parentNodeId: parentId,
      nodeType,
      context: await this.getCurrentContext(),
    });
  }

  private async showCreateDialog(
    plugin: UIPluginDefinition,
    parentId: NodeId,
    nodeType: string
  ): Promise<void> {
    if (plugin.hooks.onShowCreateDialog) {
      await plugin.hooks.onShowCreateDialog({
        parentNodeId: parentId,
        nodeType,
        onSubmit: async (data) => {
          await this.executeCreate(plugin, parentId, nodeType, data);
        },
        onCancel: () => {
          // Handle cancellation
        },
      });
    } else {
      await this.showDefaultCreateDialog(plugin, parentId, nodeType);
    }
  }

  private async executeCreate(
    plugin: UIPluginDefinition,
    parentId: NodeId,
    nodeType: string,
    data: any
  ): Promise<void> {
    // Validate form data
    if (plugin.hooks.onValidateCreateForm) {
      const validation = await plugin.hooks.onValidateCreateForm({
        formData: data,
        parentNodeId: parentId,
      });

      if (!validation.valid) {
        const errorMessage = Object.values(validation.errors || {}).join(', ');
        this.notificationService.showError(`Validation failed: ${errorMessage}`);
        return;
      }

      if (validation.warnings?.length) {
        for (const warning of validation.warnings) {
          this.notificationService.showWarning(warning);
        }
      }
    }

    // Create the node
    const nodeId = await this.nodeAdapter.createNode(parentId, nodeType, data);

    // Execute after-create hooks
    if (plugin.hooks.afterCreate) {
      const afterResult = await plugin.hooks.afterCreate({
        nodeId,
        data,
        parentNodeId: parentId,
      });

      if (afterResult.showMessage) {
        this.notificationService.showSuccess(afterResult.showMessage);
      }

      if (afterResult.navigateTo) {
        this.navigationService.navigateTo(afterResult.navigateTo);
      }

      if (afterResult.refreshNodes) {
        this.dataRefreshService.refresh(afterResult.refreshNodes);
      }
    } else {
      this.notificationService.showSuccess(`${plugin.displayName} created successfully`);
    }
  }

  private async executeBeforeStartEdit(
    plugin: UIPluginDefinition,
    nodeId: NodeId,
    currentData: any
  ) {
    if (!plugin.hooks.beforeStartEdit) {
      return { proceed: true };
    }

    return await plugin.hooks.beforeStartEdit({
      nodeId,
      currentData,
      editMode: 'dialog',
    });
  }

  private async showEditDialog(
    plugin: UIPluginDefinition,
    nodeId: NodeId,
    currentData: any
  ): Promise<void> {
    if (plugin.hooks.onShowEditDialog) {
      await plugin.hooks.onShowEditDialog({
        nodeId,
        currentData,
        onSubmit: async (changes) => {
          await this.executeUpdate(plugin, nodeId, changes);
        },
        onCancel: () => {
          // Handle cancellation
        },
      });
    } else {
      await this.showDefaultEditDialog(plugin, nodeId, currentData);
    }
  }

  private async executeUpdate(
    plugin: UIPluginDefinition,
    nodeId: NodeId,
    changes: any
  ): Promise<void> {
    // Update the node
    await this.nodeAdapter.updateNode(nodeId, plugin.nodeType, changes);

    // Get updated data for after-update hooks
    const updatedData = await this.nodeAdapter.getNodeData(nodeId, plugin.nodeType);

    // Execute after-update hooks
    if (plugin.hooks.afterUpdate) {
      const afterResult = await plugin.hooks.afterUpdate({
        nodeId,
        changes,
        updatedData: updatedData.combinedData,
      });

      if (afterResult.showMessage) {
        this.notificationService.showSuccess(afterResult.showMessage);
      }

      if (afterResult.refreshNodes) {
        this.dataRefreshService.refresh(afterResult.refreshNodes);
      }
    } else {
      this.notificationService.showSuccess(`${plugin.displayName} updated successfully`);
    }
  }

  private async executeBeforeDelete(plugin: UIPluginDefinition, nodes: readonly any[]) {
    if (!plugin.hooks.beforeDelete) {
      return { proceed: true };
    }

    const hasChildren = await this.checkAnyHasChildren(nodes.map((n) => n.id));

    return await plugin.hooks.beforeDelete({
      nodeIds: nodes.map((n) => n.id),
      entities: nodes,
      hasChildren,
    });
  }

  private async executeDeletions(nodesByType: Map<string, readonly any[]>): Promise<void> {
    const allParentIds = new Set<NodeId>();

    for (const [nodeType, nodes] of nodesByType) {
      const plugin = getUIPluginRegistry().get(nodeType);
      if (!plugin) continue;

      // Collect parent IDs before deletion
      for (const node of nodes) {
        if (node.parentId) {
          allParentIds.add(node.parentId);
        }
      }

      // Delete all nodes of this type
      await Promise.all(nodes.map((node) => this.nodeAdapter.deleteNode(node.id, nodeType)));

      // Execute after-delete hooks
      if (plugin.hooks.afterDelete) {
        await plugin.hooks.afterDelete({
          deletedNodeIds: nodes.map((n) => n.id),
          parentIds: Array.from(allParentIds),
        });
      }
    }

    // Refresh all affected parent nodes
    this.dataRefreshService.refresh(Array.from(allParentIds));
  }

  private async groupNodesByType(
    nodeIds: readonly NodeId[]
  ): Promise<Map<string, readonly any[]>> {
    const nodesByType = new Map<string, any[]>();

    for (const nodeId of nodeIds) {
      const treeNode = await this.nodeAdapter.getWorkerAPI().getTreeNode(nodeId);
      const nodeType = treeNode.nodeType;

      if (!nodesByType.has(nodeType)) {
        nodesByType.set(nodeType, []);
      }

      nodesByType.get(nodeType)!.push({
        id: nodeId,
        ...treeNode,
      });
    }

    return nodesByType;
  }

  private async checkAnyHasChildren(nodeIds: readonly NodeId[]): Promise<boolean> {
    for (const nodeId of nodeIds) {
      if (await this.nodeAdapter.hasChildren(nodeId)) {
        return true;
      }
    }
    return false;
  }

  private async getCurrentContext() {
    // TODO: Implement context gathering
    return {
      userId: 'current-user',
      permissions: [],
      currentPath: [],
      selectedNodes: [],
      theme: 'light' as const,
      locale: 'en',
    };
  }

  private getDefaultContextMenuItems(nodeId: NodeId, nodeType: string) {
    return [
      {
        label: 'Edit',
        icon: 'edit',
        action: () => this.editNode(nodeId, nodeType),
      },
      {
        label: 'Delete',
        icon: 'delete',
        action: () => this.deleteNodes([nodeId]),
      },
    ];
  }

  private async showDefaultCreateDialog(
    _plugin: UIPluginDefinition,
    _parentId: NodeId,
    nodeType: string
  ): Promise<void> {
    // TODO: Implement default create dialog
    console.log(`Show default create dialog for ${nodeType}`);
  }

  private async showDefaultEditDialog(
    _plugin: UIPluginDefinition,
    nodeId: NodeId,
    _currentData: any
  ): Promise<void> {
    // TODO: Implement default edit dialog
    console.log(`Show default edit dialog for ${nodeId}`);
  }
}

// Service interfaces (placeholders - should match actual implementations)
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
