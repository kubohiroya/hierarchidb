/**
 * TreeTable State Atoms - Central Export
 *
 * すべてのatomを統合エクスポート
 * 機能別・種類別に整理された構造
 */

// Core Data Atoms
export {
  tableDataAtom,
  searchTermAtom,
  filteredDataAtom,
  totalCountAtom,
  filteredCountAtom,
  isEmptyAtom,
} from './core/data.atoms';

// Table State Atoms
export {
  sortingAtom,
  columnSizingAtom,
} from './core/table.atoms';

// Selection Feature
export {
  rowSelectionAtom,
  selectionModeAtom,
  rowClickActionAtom,
  selectedNodeIdsAtom,
  selectedCountAtom,
  clearSelectionAtom,
  selectAllAtom,
  type SelectionMode,
  type RowClickAction,
} from './features/selection.atoms';

// Expansion Feature
export {
  expandedAtom,
  toggleExpandedAtom,
  toggleAllExpandedAtom,
} from './features/expansion.atoms';

// Editing Feature
export {
  editingNodeIdAtom,
  editingValueAtom,
} from './features/editing.atoms';

// Drag & Drop Feature
export {
  draggingNodeIdAtom,
  dropTargetNodeIdAtom,
  forbiddenDropTargetsAtom,
} from './features/dragDrop.atoms';

// Subscription Feature
export {
  subscribedRootNodeIdAtom,
  subscriptionIdAtom,
  subscriptionDepthAtom,
  lastUpdateTimestampAtom,
  pendingUpdatesAtom,
} from './features/subscription.atoms';

// View Configuration
export {
  viewHeightAtom,
  viewWidthAtom,
  useTrashColumnsAtom,
  depthOffsetAtom,
} from './config/view.atoms';

// UI State
export {
  isLoadingAtom,
  errorAtom,
} from './config/ui.atoms';
