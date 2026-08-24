/**
 * Types for TreeConsoleBreadcrumb package
 */

import type { MouseEvent, ReactElement } from 'react';
import type { NodeContextMenuProps, OpenStepOption } from './components/NodeContextMenu.js';

type BreadcrumbBuildMetadata = {
  buildRequired?: boolean;
};

type BreadcrumbNodeMetadata = {
  name?: string;
  description?: string;
  tags?: string[];
  buildMetadata?: BreadcrumbBuildMetadata;
};

export interface BreadcrumbNode {
  treeNodeId?: string;
  id?: string;
  nodeType?: string;
  type?: string;
  name?: string;
  parentId?: string | null;
  isClickable?: boolean;
  depth?: number;
  holderType?: 'draft' | 'archive';
  holderTargetId?: string;
  holderMetaParentId?: string;
  visible?: boolean;
  metadata?: BreadcrumbNodeMetadata;
  draftMetadata?: BreadcrumbNodeMetadata | null;
}

export interface TreeConsoleBreadcrumbContext {
  isArchivePage?: boolean;
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
  NodeTypeIcon?: React.ComponentType<{
    nodeType: string;
    size?: string;
    clickable?: boolean;
    color?: 'inherit' | 'primary' | 'secondary' | 'action' | 'disabled' | 'error';
    htmlColor?: string;
    isDraft?: boolean;
    buildRequired?: boolean;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    disabled?: boolean;
  }>;

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
   * Optional page node id (e.g., Archive dialog context)
   */
  pageNodeId?: string;

  /**
   * Enable archive-specific link generation for breadcrumb items.
   */
  useArchiveColumns?: boolean;

  /**
   * Archive action context when useArchiveColumns is true.
   */
  archiveAction?: 'restore' | 'empty';

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
    options?: {
      navigateToParent?: boolean;
      expandTarget?: boolean;
      source?: 'breadcrumb';
      nextVisible?: boolean;
    }
  ) => void;

  /**
   * Optional element rendered to the left of breadcrumbs.
   */
  leftSlot?: ReactElement;
  /**
   * Optional resolver for Open-step submenu.
   */
  resolveOpenSteps?: (nodeId: string, nodeType: string) => Promise<OpenStepOption[]>;

  /**
   * Optional renderer override for host-specific breadcrumb presentation.
   */
  renderer?: (props: TreeConsoleBreadcrumbRendererProps) => ReactElement;

  /**
   * Optional node-id set where move-to-archive should be disabled.
   */
  archiveDisabledNodeIds?: ReadonlySet<string>;

  /**
   * Optional node-id set with queued or running build sessions.
   */
  activeBuildNodeIds?: ReadonlySet<string>;

  /**
   * Optional descendant collector used to resolve folder build availability.
   */
  collectDescendantNodes?: (nodeId: string) => readonly BreadcrumbNode[];

  /** Current view mode to preserve in breadcrumb navigation links. */
  viewMode?: string;
  /** Current sort mode to preserve in breadcrumb navigation links. */
  sortMode?: string;
}

export type TreeConsoleBreadcrumbRendererProps = {
  readonly items: readonly BreadcrumbNode[];
  readonly defaultRendererProps: TreeConsoleBreadcrumbProps;
  readonly defaultRenderer: () => ReactElement;
};
