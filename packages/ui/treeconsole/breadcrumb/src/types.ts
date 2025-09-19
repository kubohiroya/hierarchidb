/**
 * Types for TreeConsoleBreadcrumb package
 */

export interface BreadcrumbNode {
  treeNodeId?: string;
  id?: string;
  nodeType?: string;
  type?: string;
  name?: string;
  parentId?: string | null;
  isClickable?: boolean;
}

export interface TreeConsoleBreadcrumbContext {
  isTrashPage?: boolean;
  isProjectsPage?: boolean;
}

export interface TreeConsoleBreadcrumbProps {
  /**
   * Path of nodes from root to current
   */
  nodePath?: readonly BreadcrumbNode[];

  /**
   * Current node ID
   */
  currentNodeId?: string;

  /**
   * Callback when a breadcrumb is clicked
   */
  onNodeClick?: (nodeId: string, node?: BreadcrumbNode) => void;

  /**
   * Visual variant
   */
  variant?: 'default' | 'minimal';

  /**
   * Context information
   */
  context?: TreeConsoleBreadcrumbContext;

  /**
   * Depth offset for indentation
   */
  depthOffset?: number;

  /**
   * Custom icon component
   */
  NodeTypeIcon?: React.ComponentType<{ nodeType: string; size?: string }>;

  /**
   * Custom context menu component
   */
  NodeContextMenu?: React.ComponentType<any>;

  /**
   * Optional treeId for context-aware create menus ('r' | 't' | 'p').
   */
  treeId?: string;

  /**
   * Called when a node is dropped onto a breadcrumb item.
   * Enables reparenting via drag & drop onto the breadcrumb.
   */
  onDropToNode?: (targetNodeId: string, draggedNodeId: string) => void;
}
