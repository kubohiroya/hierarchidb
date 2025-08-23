/**
 * Types for TreeConsoleToolbar package
 */

/**
 * Action types and their parameters for TreeConsoleToolbar
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
  | { action: 'setRowClickAction'; params: 'Select' | 'Edit' | 'Navigate' };

/**
 * Parameters type for TreeConsoleToolbar actions
 */
export type TreeConsoleToolbarActionParams = 
  | undefined
  | ('Select' | 'Edit' | 'Navigate')| {treeId: string } |{templateId: string};

export interface TreeConsoleToolbarController {
  searchText?: string;
  handleSearchTextChange?: (value: string) => void;
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
   * Tree root node ID for operations
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
  rowClickAction?: 'Select' | 'Edit' | 'Navigate';

  /**
   * Callback when row click action changes
   */
  onRowClickActionChange?: (action: 'Select' | 'Edit' | 'Navigate') => void;

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
}
