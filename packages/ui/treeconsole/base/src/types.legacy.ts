// Core tree node interface
export interface TreeNodeData {
  readonly id: string;
  readonly name: string;
  readonly nodeType: string;
  readonly parentId?: string;
  readonly children?: readonly TreeNodeData[];
  readonly hasChildren?: boolean;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly size?: number;
  readonly status?: 'active' | 'inactive' | 'error';
}

// TreeNode type enum/constants
export type TreeNodeType = string;

// Selection state
export interface SelectionState {
  readonly selectedIds: readonly string[];
  readonly lastSelectedId?: string;
}

// Expansion state
export interface ExpansionState {
  readonly expandedIds: readonly string[];
}

// Sort state
export interface SortState {
  readonly sortBy?: string;
  readonly sortDirection?: 'asc' | 'desc';
}

// Filter state
export interface FilterState {
  readonly filterBy?: string;
  readonly searchTerm?: string;
}

// View state
export interface ViewState {
  readonly viewMode: 'list' | 'grid';
  readonly dense: boolean;
  readonly showCheckboxes: boolean;
  readonly showIcons: boolean;
}

// Combined table state
export interface TreeTableState {
  readonly selection: SelectionState;
  readonly expansion: ExpansionState;
  readonly sort: SortState;
  readonly filter: FilterState;
  readonly view: ViewState;
}

// Navigation state
export interface NavigationState {
  readonly currentNodeId?: string;
  readonly history: readonly string[];
  readonly historyIndex: number;
}

// Loading state
export interface LoadingState {
  readonly isLoading: boolean;
  readonly loadingMessage?: string;
  readonly progress?: number;
}

// Error state
export interface ErrorState {
  readonly error?: string;
  readonly warning?: string;
  readonly info?: string;
  readonly success?: string;
}
