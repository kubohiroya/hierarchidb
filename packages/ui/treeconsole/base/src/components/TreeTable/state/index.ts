/**
  * TreeTable State Atoms - Central Export
  * atom
   */

// Core Data Atoms
export {
  tableDataAtom,
  searchTermAtom,
  filteredDataAtom,
  totalCountAtom,
  filteredCountAtom,
  isEmptyAtom,
} from './core/data.atoms.js';

// Table State Atoms
export {
  sortingAtom,
  columnSizingAtom,
} from './core/table.atoms.js';

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
} from './features/selection.atoms.js';

// Expansion Feature
export {
  expandedAtom,
  toggleExpandedAtom,
  toggleAllExpandedAtom,
} from './features/expansion.atoms.js';

// Editing Feature
export {
  editingNodeIdAtom,
  editingValueAtom,
} from './features/editing.atoms.js';

// Drag & Drop Feature
export {
  draggingNodeIdAtom,
  dropTargetNodeIdAtom,
  forbiddenDropTargetsAtom,
} from './features/dragDrop.atoms.js';

// Subscription Feature
export {
  subscribedRootNodeIdAtom,
  subscriptionIdAtom,
  subscriptionDepthAtom,
  lastUpdateTimestampAtom,
  pendingUpdatesAtom,
} from './features/subscription.atoms.js';

// View Configuration
export {
  viewHeightAtom,
  viewWidthAtom,
  useArchiveColumnsAtom,
  depthOffsetAtom,
} from './config/view.atoms.js';

// UI State
export {
  isLoadingAtom,
  errorAtom,
} from './config/ui.atoms.js';
