// Main plugin system exports
export { UIPluginRegistry, getUIPluginRegistry } from './registry/UIPluginRegistry';
import { getUIPluginRegistry } from './registry/UIPluginRegistry';
export { NodeDataAdapter } from './adapters/NodeDataAdapter';
export { UnifiedNodeOperations } from './operations/UnifiedNodeOperations';

// React hooks
export { useDynamicCreateMenu, useCreateMenuItem } from './hooks/useDynamicCreateMenu';

// React containers
export { DynamicCreateMenu, SimpleDynamicCreateMenu } from './components/DynamicCreateMenu';

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
} from './types';

// Plugin registration helper
export function registerAllUIPlugins(): void {
  const registry = getUIPluginRegistry();
  
  console.log('Starting UI plugin registration...');

  // Register Shape plugin
  try {
    // Create a simple Shape UI plugin definition inline for now
    const ShapeUIPlugin = {
      nodeType: 'shape',
      displayName: 'Geographic Shapes',
      description: 'Manage geographic shape data with batch processing capabilities',
      
      components: {
        icon: () => null, // Will be replaced with actual icon
        createDialog: () => null,
        editDialog: () => null,
        panel: () => null,
        form: () => null,
      },
      
      dataSource: {
        requiresEntity: true,
        entityType: 'shape',
        workingCopyEnabled: true,
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
      
      hooks: {},
      
      style: {
        iconColor: '#4CAF50',
        backgroundColor: '#E8F5E9',
        borderColor: '#4CAF50',
      },
    };
    
    registry.register(ShapeUIPlugin as any);
    console.log('✓ Shape UI Plugin registered');
  } catch (error) {
    console.error('Failed to register Shape UI Plugin:', error);
  }

  // Log all registered plugins
  const allPlugins = registry.getAll();
  console.log(`Total UI plugins registered: ${allPlugins.length}`);
  allPlugins.forEach((plugin, index) => {
    console.log(`  ${index + 1}. ${plugin.nodeType}`);
  });
  console.log('UI Plugin system initialized successfully');
}
