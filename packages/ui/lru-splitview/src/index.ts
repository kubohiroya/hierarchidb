// Main components

export type { LRUSplitView2Pane, LRUSplitView2Props, LRUSplitView2RenderContext } from './components/LRUSplitView2.js';
export type { LRUSplitViewProps } from './components/LRUSplitView.js';
export type { PaneHeaderComponentProps } from './components/PaneHeader.js';
export { LRUSplitView } from './components/LRUSplitView.js';
export { LRUSplitView2 } from './components/LRUSplitView2.js';
export { PaneHeader } from './components/PaneHeader.js';
// Hooks
export { useLRUPanes } from './hooks/useLRUPanes.js';
// Types
export type { LRUSplitViewConfig, PaneConfig, PaneHeaderProps, PaneProgress, PaneState, UseLRUPanesResult } from './types/LRUSplitView.js';

// Utilities
export { AutoExpandPresets, batchUpdateProgress, calculateOptimalSizes, calculateProgress, createPane, createProgress, findLRUPane, findMRUPane, getCollapsiblePanes, sortByAccessTime } from './utils/lruUtils.js';
