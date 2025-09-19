// Main components
export {
  LRUSplitView,
  PaneHeader,
} from './components/index.js';

export type {
  LRUSplitViewProps,
  PaneHeaderComponentProps,
} from './components/index.js';

// Types
export type {
  PaneConfig,
  PaneState,
  PaneProgress,
  LRUSplitViewConfig,
  PaneHeaderProps,
  UseLRUPanesResult,
} from './types/index.js';

// Hooks
export { useLRUPanes } from './hooks/index.js';

// Utilities
export {
  createPane,
  createProgress,
  calculateProgress,
  findLRUPane,
  findMRUPane,
  sortByAccessTime,
  getCollapsiblePanes,
  calculateOptimalSizes,
  AutoExpandPresets,
  batchUpdateProgress,
} from './utils/index.js';