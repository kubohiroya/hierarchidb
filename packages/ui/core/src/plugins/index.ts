// Main plugin system exports
export { UIPluginRegistry, getUIPluginRegistry } from './registry/UIPluginRegistry.js';
import { getUIPluginRegistry } from './registry/UIPluginRegistry.js';
import type { UIActionHooks, UIPluginDefinition } from './types.js';

export { NodeDataAdapter } from './adapters/NodeDataAdapter.js';
export { UnifiedNodeOperations } from './operations/UnifiedNodeOperations.js';

// React hooks
export { useDynamicCreateMenu, useCreateMenuItem } from './hooks/useDynamicCreateMenu.js';

// React containers
export { DynamicCreateMenu, SimpleDynamicCreateMenu } from './components/DynamicCreateMenu.js';

// Types
export type {
  UIPluginDefinition,
  UIActionHooks,
  CreateDialogProps,
  EditDialogProps,
  DetailPanelProps,
  TableCellProps,
  PreviewProps,
  ContextMenuItem,
  UIContext,
  UnifiedNodeData,
  CreateMenuItem,
  // Hook parameter types
  BeforeShowCreateDialogParams,
  BeforeShowCreateDialogResult,
  ShowCreateDialogParams,
  ValidateCreateFormParams,
  ValidateCreateFormResult,
  AfterCreateParams,
  AfterCreateResult,
  FormatDisplayParams,
  GeneratePreviewParams,
  BeforeStartEditParams,
  BeforeStartEditResult,
  ShowEditDialogParams,
  AfterUpdateParams,
  AfterUpdateResult,
  BeforeDeleteParams,
  BeforeDeleteResult,
  AfterDeleteParams,
  AfterDeleteResult,
  ContextMenuParams,
  ExportParams,
  DragStartParams,
  DragStartResult,
  DropParams,
  DropResult,
} from './types.js';

// Plugin registration helper
export function registerAllUIPlugins(): void {
  const registry = getUIPluginRegistry();


  // Register Shape plugin (check if not already registered)
  if (!registry.isRegistered('shape')) {
    try {
      // Create a simple Shape UI plugin definition inline for now
      const shapeHooks: UIActionHooks = {};

      const shapeUIPlugin: UIPluginDefinition = {
        nodeType: 'shape',
        displayName: 'Geographic Shapes',
        description: 'Manage geographic shape-plugin data with batch processing capabilities',

        components: {
          icon: () => null, // Will be replaced with actual icon
        },

        dataSource: {
          requiresEntity: true,
          entityType: 'shape',
        },

        capabilities: {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          canHaveChildren: false,
          canMove: true,
          supportsWorkingCopy: true,
          supportsVersioning: false,
          supportsExport: true,
          supportsBulkOperations: true,
        },

        menu: {
          group: 'advanced' as const,
          createOrder: 25,
          contextMenuItems: [],
        },

        hooks: shapeHooks,

        style: {
          primaryColor: '#4CAF50',
        },
      };

      registry.register(shapeUIPlugin);

    } catch (error) {
      console.error('Failed to register Shape UI Plugin:', error);
    }
  }

}
