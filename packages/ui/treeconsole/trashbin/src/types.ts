/**
 * Types for TreeConsoleTrashbin package
 */

export interface TrashItem {
  id: string;
  name: string;
  nodeType: string;
  type?: string;
  deletedAt?: string | Date;
  deletedBy?: string;
  originalParentId?: string;
  originalPath?: string;
  hasChildren?: boolean;
}

export interface TrashbinController {
  /**
   * List of items in trash
   */
  trashItems?: TrashItem[];

  /**
   * Search text for filtering trash items
   */
  searchText?: string;

  /**
   * Selected trash item IDs
   */
  selectedItemIds?: Set<string>;

  /**
   * Actions
   */
  onRestore?: (itemIds: string[], targetParentId?: string) => void;
  onPermanentDelete?: (itemIds: string[]) => void;
  onEmptyTrash?: () => void;
  onSearchTextChange?: (text: string) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onItemClick?: (itemId: string, item?: TrashItem) => void;
}

export interface TrashbinTableProps {
  /**
   * Controller providing trash data and actions
   */
  controller?: TrashbinController | null;

  /**
   * View dimensions
   */
  viewHeight?: number;
  viewWidth?: number;

  /**
   * Show additional columns for trash metadata
   */
  showMetadata?: boolean;

  /**
   * Allow multiple selection
   */
  allowMultiSelect?: boolean;

  /**
   * Custom containers
   */
  NodeTypeIcon?: React.ComponentType<{ nodeType: string; size?: string }>;
  NodeContextMenu?: React.ComponentType<any>;

  /**
   * Callbacks
   */
  onItemDoubleClick?: (item: TrashItem) => void;
  onItemContextMenu?: (item: TrashItem, event: React.MouseEvent) => void;
}

export interface TrashbinActionsProps {
  /**
   * Controller for actions
   */
  controller?: TrashbinController | null;

  /**
   * Selected item IDs
   */
  selectedItemIds?: Set<string>;

  /**
   * Action handlers
   */
  onRestore?: (itemIds: string[]) => void;
  onPermanentDelete?: (itemIds: string[]) => void;
  onEmptyTrash?: () => void;

  /**
   * Disable specific actions
   */
  disableRestore?: boolean;
  disableDelete?: boolean;
  disableEmptyTrash?: boolean;

  /**
   * Show confirmation dialogs
   */
  showConfirmations?: boolean;
}

export interface TrashbinSearchProps {
  /**
   * Current search text
   */
  searchText?: string;

  /**
   * Search change handler
   */
  onSearchChange?: (text: string) => void;

  /**
   * Search placeholder text
   */
  placeholder?: string;

  /**
   * Search input variant
   */
  variant?: 'standard' | 'outlined' | 'filled';

  /**
   * Size
   */
  size?: 'small' | 'medium';
}
