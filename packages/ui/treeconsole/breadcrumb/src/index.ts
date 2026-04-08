/**
 * @hierarchidb/ui-treeconsole-breadcrumb
 *
 * Breadcrumb navigation component for HierarchiDB TreeConsole
 */

// Main component
export { TreeConsoleBreadcrumb } from './components/TreeConsoleBreadcrumb.js';

// Sub containers (can be customized via props)
export { NodeTypeIcon } from '@hierarchidb/components';
export { NodeContextMenu } from './components/NodeContextMenu.js';

// Types
export type {
  BreadcrumbNode,
  TreeConsoleBreadcrumbContext,
  TreeConsoleBreadcrumbProps,
  TreeConsoleBreadcrumbRendererProps,
} from './types.js';

// Utilities
export { buildTreeConsoleLinkHref } from './utils/linkFactory.js';
export type { BuildTreeConsoleLinkOptions } from './utils/linkFactory.js';
export { getPluginIconColor, isFolderNodeType } from './utils/nodeTypeIconColor.js';

// Re-export the NodeContextMenuProps type for consumers
export type { NodeContextMenuProps, OpenStepOption } from './components/NodeContextMenu.js';

// Create menu items builder (shared by NodeContextMenu and BackgroundContextMenu)
export { buildCreateMenuItems } from './components/buildCreateMenuItems.js';
export type { CreateMenuEntry, CreateMenuEntryInput } from './components/buildCreateMenuItems.js';
