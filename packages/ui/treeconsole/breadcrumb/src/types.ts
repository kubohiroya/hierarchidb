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
   * Custom icons component
   */
  NodeTypeIcon?: React.ComponentType<{ nodeType: string; size?: string }>;

  /**
   * Custom context menu component
   */
  NodeContextMenu?: React.ComponentType<any>;
}
