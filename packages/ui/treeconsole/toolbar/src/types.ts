/**
 * Types for TreeConsoleToolbar_Deprecated package
 */

/**
 * Action types and their parameters for TreeConsoleToolbar_Deprecated
 */
export type TreeConsoleToolbarAction =
  | { action: 'undo' }
  | { action: 'redo' }
  | { action: 'copy' }
  | { action: 'paste' }
  | { action: 'duplicate' }
  | { action: 'remove' }
  | { action: 'restore' }
  | { action: 'empty' }
  | { action: 'import' }
  | { action: 'export' }
  | { action: 'setRowClickAction'; params: 'Select/Navigate' | 'Edit' };

/**
 * Parameters type for TreeConsoleToolbar_Deprecated actions
 */
export type TreeConsoleToolbarActionParams =
  | undefined
  | ('Select/Navigate' | 'Edit')
  | { treeId: string }
  | { templateId: string }
  | { trashNodeId: string };

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
  isTrashPage?: boolean;
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
   * Whether there are items in trash
   */
  hasTrashItems?: boolean;

  /**
   * Identifier for the trash root or folder used when opening the trash dialog.
   */
  trashNodeId?: string;

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
  canRemove?: boolean;

  /**
   * Importable templates for the current tree. If empty or undefined,
   * the "Import Template" menu item will be hidden.
   */
  availableTemplates?: Array<{ id: string; label?: string }>;
}
