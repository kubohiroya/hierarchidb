/**
 * @hierarchidb/ui-treeconsole-breadcrumb
 *
 * Breadcrumb navigation component for HierarchiDB TreeConsole
 */

// Main component
export { TreeConsoleBreadcrumb } from './components/TreeConsoleBreadcrumb';

// Sub containers (can be customized via props)
export { NodeTypeIcon } from './components/NodeTypeIcon';
export { NodeContextMenu } from './components/NodeContextMenu';

// Types
export type {
  BreadcrumbNode,
  TreeConsoleBreadcrumbContext,
  TreeConsoleBreadcrumbProps,
} from './types';

// Re-export the NodeContextMenuProps type for consumers
export type { NodeContextMenuProps } from './components/NodeContextMenu';
