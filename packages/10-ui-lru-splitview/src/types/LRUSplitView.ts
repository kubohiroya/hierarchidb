/**
 * @fileoverview Types for LRU-managed split view component
 * @module @hierarchidb/ui-lru-splitview/types
 */

import type { ReactNode } from 'react';

/** Base pane configuration */
export interface PaneConfig {
  /** Unique identifier for the pane */
  id: string;
  /** Display title */
  title: string;
  /** Optional icon component */
  icon?: ReactNode;
  /** Background color when expanded */
  color?: string;
  /** Whether pane starts expanded */
  defaultExpanded?: boolean;
  /** Minimum size when collapsed (px) */
  collapsedSize?: number;
  /** Content to render in the pane body */
  content: ReactNode;
  /** Optional header actions */
  headerActions?: ReactNode;
  /** Custom header component (overrides default) */
  customHeader?: ReactNode;
}

/** Pane state (internal) */
export interface PaneState extends Omit<PaneConfig, 'content' | 'headerActions' | 'customHeader'> {
  /** Whether pane is currently expanded */
  isExpanded: boolean;
  /** Last access timestamp for LRU management */
  lastAccessTime: number;
  /** Computed background color */
  color: string;
}

/** Progress information for a pane */
export interface PaneProgress {
  /** Pane ID */
  paneId: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current task count */
  taskCount?: number;
  /** Completed task count */
  completedCount?: number;
  /** Custom status text */
  status?: string;
}

/** LRU split view configuration */
export interface LRUSplitViewConfig {
  /** Array of pane configurations */
  panes: PaneConfig[];
  /** Maximum number of expanded panes */
  maxExpandedPanes?: number;
  /** Default collapsed size (px) */
  defaultCollapsedSize?: number;
  /** Whether to use vertical orientation */
  vertical?: boolean;
  /** Auto-expand behavior configuration */
  autoExpand?: {
    /** Enable auto-expand on progress completion */
    onComplete?: boolean;
    /** Enable auto-expand on task start */
    onStart?: boolean;
    /** Custom auto-expand logic */
    custom?: (progress: PaneProgress[], currentStates: PaneState[]) => string | null;
  };
  /** Progress tracking for auto-expand */
  progress?: PaneProgress[];
  /** Callback when pane expansion changes */
  onPaneToggle?: (paneId: string, isExpanded: boolean) => void;
  /** Callback when pane order changes */
  onPaneReorder?: (paneIds: string[]) => void;
}

/** Pane header props */
export interface PaneHeaderProps {
  /** Pane configuration */
  pane: PaneConfig;
  /** Current pane state */
  state: PaneState;
  /** Progress information */
  progress?: PaneProgress;
  /** Toggle expansion callback */
  onToggle: (paneId: string) => void;
  /** Whether header is clickable */
  clickable?: boolean;
}

/** Hook result for LRU pane management */
export interface UseLRUPanesResult {
  /** Current pane states */
  paneStates: PaneState[];
  /** Toggle pane expansion */
  togglePane: (paneId: string) => void;
  /** Expand specific pane */
  expandPane: (paneId: string) => void;
  /** Collapse specific pane */
  collapsePane: (paneId: string) => void;
  /** Expand multiple panes */
  expandPanes: (paneIds: string[]) => void;
  /** Collapse all panes */
  collapseAll: () => void;
  /** Get expanded pane IDs */
  getExpandedPanes: () => string[];
  /** Get calculated sizes for Allotment */
  getSizes: () => number[];
}