/**
 * @hierarchidb/ui-treeconsole-breadcrumb
 *
 * Breadcrumb navigation component for HierarchiDB TreeConsole
 */

// Main component
export { TreeConsoleBreadcrumb } from './components/TreeConsoleBreadcrumb.js';

// Sub containers (can be customized via props)
export { NodeTypeIcon } from './components/NodeTypeIcon.js';
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
