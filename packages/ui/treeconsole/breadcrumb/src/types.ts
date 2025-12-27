/**
 * Types for TreeConsoleBreadcrumb package
 */

import type { NodeContextMenuProps } from './components/NodeContextMenu.js';

export interface BreadcrumbNode {
  treeNodeId?: string;
  id?: string;
  nodeType?: string;
  type?: string;
  name?: string;
  parentId?: string | null;
  isClickable?: boolean;
  depth?: number;
  holderType?: 'draft' | 'trash';
  holderTargetId?: string;
  holderMetaParentId?: string;
  invisible?: boolean;
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
  NodeContextMenu?: React.ComponentType<NodeContextMenuProps>;

  /**
   * Optional treeId for context-aware create menus ('r' | 't' | 'p').
   */
  treeId?: string;

  /**
   * Called when a node is dropped onto a breadcrumb item.
   * Enables reparenting via drag & drop onto the breadcrumb.
   */
  onDropToNode?: (targetNodeId: string, draggedNodeId: string) => void;

  /**
   * Optional page node id (e.g., Trash dialog context)
   */
  pageNodeId?: string;

  /**
   * Enable trash-specific link generation for breadcrumb items.
   */
  useTrashColumns?: boolean;

  /**
   * Trash action context when useTrashColumns is true.
   */
  trashAction?: 'restore' | 'empty';

  /**
   * Whether node-type icons should respond to clicks (context menu).
   * Defaults to true.
   */
  iconInteractive?: boolean;

  /**
   * Optional callback invoked when the breadcrumb context menu triggers an action.
   * The node argument corresponds to the breadcrumb entry that initiated the action.
   */
  onContextAction?: (
    action: string,
    node: BreadcrumbNode,
    options?: { navigateToParent?: boolean; expandTarget?: boolean; source?: 'breadcrumb' },
  ) => void;
}
