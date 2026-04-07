/**
 * Types for TreeConsoleToolbar_Deprecated package
 */

import type { BuildContinuationPolicy } from '../../../../build-api';

export type TreeConsoleSearchMode = 'local';

/**
 * Action types and their parameters for TreeConsoleToolbar_Deprecated
 */
export type TreeConsoleToolbarAction =
  | { action: 'undo' }
  | { action: 'redo' }
  | { action: 'copy' }
  | { action: 'paste' }
  | { action: 'duplicate' }
  | { action: 'archive' }
  | { action: 'restore' }
  | { action: 'empty' }
  | { action: 'import' }
  | { action: 'export' }
  | { action: 'setRowClickAction'; params: 'Select/Navigate' | 'Edit' }
  | { action: 'setAutosaveEnabled'; params: boolean }
  | { action: 'setDialogBackdropDismissEnabled'; params: boolean }
  | { action: 'setZoomBandBoundaries'; params: number[] }
  | { action: 'setBuildContinuationPolicy'; params: BuildContinuationPolicy };

/**
 * Parameters type for TreeConsoleToolbar_Deprecated actions
 */
export type TreeConsoleToolbarActionParams =
  | undefined
  | ('Select/Navigate' | 'Edit')
  | { treeId: string }
  | { templateId: string }
  | { archiveNodeId: string }
  | boolean
  | number[]
  | BuildContinuationPolicy;

export interface TreeConsoleToolbarController {
  searchText?: string;
  handleSearchTextChange?: (value: string) => void;
  /**
   * Called when the search input loses focus to commit the current value.
   */
  handleSearchCommit?: () => void;
}

export interface TreeConsoleToolbarContext {
  isProjectsPage?: boolean;
  isResourcesPage?: boolean;
  isArchivePage?: boolean;
}

export interface TreeConsoleToolbarProps {
  /**
   * Hide the entire toolbar
   */
  hideConsole?: boolean;

  /**
   * Show only search field
   */
  showSearchOnly?: boolean;

  /**
   * Page context flags
   */
  isProjectsPage?: boolean;
  isResourcesPage?: boolean;

  /**
   * TreeTypes root node ID for operations
   */
  treeRootNodeId?: string;

  /**
   * Controller for search and other operations
   */
  controller?: TreeConsoleToolbarController | null;

  /**
   * Whether there are items in archive
   */
  hasArchiveItems?: boolean;

  /**
   * Identifier for the archive root or folder used when opening the archive dialog.
   */
  archiveNodeId?: string;

  /**
   * Whether current node has children
   */
  hasChildren?: boolean;

  /**
   * Custom action handlers
   */
  onAction?: (action: string, params?: TreeConsoleToolbarActionParams) => void;

  /**
   * Row click action setting
   */
  rowClickAction?: 'Select/Navigate' | 'Edit';

  /**
   * Callback when row click action changes
   */
  onRowClickActionChange?: (action: 'Select/Navigate' | 'Edit') => void;

  /**
   * Toggle dialog autosave for plugin dialogs.
   */
  autosaveEnabled?: boolean;

  /**
   * Callback when autosave toggle changes.
   */
  onAutosaveEnabledChange?: (enabled: boolean) => void;

  /**
   * Toggle closing plugin dialogs by clicking outside the dialog.
   */
  dialogBackdropDismissEnabled?: boolean;

  /**
   * Callback when backdrop dismiss toggle changes.
   */
  onDialogBackdropDismissEnabledChange?: (enabled: boolean) => void;

  /**
   * Default zoom band boundaries used by build dialogs.
   */
  zoomBandBoundaries?: number[];


  /**
   * Callback when zoom band boundaries change.
   */
  onZoomBandBoundariesChange?: (boundaries: number[]) => void;

  /**
   * Build continuation policy for build processing.
   */
  buildContinuationPolicy?: BuildContinuationPolicy;

  /**
   * Callback when build continuation policy changes.
   */
  onBuildContinuationPolicyChange?: (policy: BuildContinuationPolicy) => void;


  /**
   * Undo/Redo availability
   */
  canUndo?: boolean;
  canRedo?: boolean;

  /**
   * Copy/Paste availability
   */
  canCopy?: boolean;
  canPaste?: boolean;

  /**
   * Selection-based actions availability
   */
  canDuplicate?: boolean;
  /**
   * Enables the "Move to Archive" toolbar action.
   */
  canArchive?: boolean;

  /**
   * Importable templates for the current console. If empty or undefined,
   * the "Import Template" menu item will be hidden.
   */
  availableTemplates?: Array<{ id: string; label?: string }>;

  /**
   * When false, disables Import from JSON / Import template menu entries.
   * Defaults to true for backward compatibility.
   */
  allowImport?: boolean;

  /**
   * Displays developer-only tools (e.g., IndexedDB reset) when true.
   */
  developerModeEnabled?: boolean;

  /**
   * Current view mode for the TreeConsole content area.
   */
  viewMode?: import('@hierarchidb/ui-treeconsole-base').ViewMode;

  /**
   * Callback when view mode changes.
   */
  onViewModeChange?: (mode: import('@hierarchidb/ui-treeconsole-base').ViewMode) => void;

  /**
   * Current sort mode.
   */
  sortMode?: import('@hierarchidb/ui-treeconsole-base').SortMode;

  /**
   * Callback when sort mode changes.
   */
  onSortModeChange?: (mode: import('@hierarchidb/ui-treeconsole-base').SortMode) => void;
}
