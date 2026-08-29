/**
 * @hierarchidb/ui-treeconsole-breadcrumb
 *
 * Breadcrumb navigation component for HierarchiDB TreeConsole
 */

// Sub containers (can be customized via props)
export { NodeTypeIcon } from '@hierarchidb/components';
export type { CreateMenuEntry, CreateMenuEntryInput } from './components/buildCreateMenuItems.js';
// Create menu items builder (shared by NodeContextMenu and BackgroundContextMenu)
export { buildCreateMenuItems } from './components/buildCreateMenuItems.js';
// Re-export the NodeContextMenuProps type for consumers
export type {
  NodeContextMenuCommandAction,
  NodeContextMenuProps,
  OpenStepOption,
} from './components/NodeContextMenu.js';
export { NodeContextMenu } from './components/NodeContextMenu.js';
// Main component
export { TreeConsoleBreadcrumb } from './components/TreeConsoleBreadcrumb.js';
// Types
export type {
  BreadcrumbNode,
  TreeConsoleBreadcrumbContext,
  TreeConsoleBreadcrumbProps,
  TreeConsoleBreadcrumbRendererProps,
} from './types.js';
// Utilities
export type { BuildAvailabilityView } from './utils/buildAvailabilityView.js';
export { formatBuildAvailabilityView } from './utils/buildAvailabilityView.js';
export type { BuildTreeConsoleLinkOptions } from './utils/linkFactory.js';
export { buildTreeConsoleLinkHref } from './utils/linkFactory.js';
export { getPluginIconColor, isFolderNodeType } from './utils/nodeTypeIconColor.js';
