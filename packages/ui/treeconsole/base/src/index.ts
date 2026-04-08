// Main containers
export { TreeConsolePanel } from './components/TreeConsolePanel.js';
export { TagsLinkButton } from './components/TagsLinkButton.js';
export type { TreeConsolePanelProps, TreeConsoleBreadcrumbRendererProps } from './components/TreeConsolePanel.js';

// TreeTable containers
export { TreeTableView, TreeTableFooter, RowContextMenu } from './components/TreeTable/index.js';

export type {
  TreeTableViewProps,
  TreeTableColumn,
  TreeTableToolbarProps,
  TreeTableFooterProps,
  RowContextMenuProps,

} from './components/TreeTable/index.js';

// Types
export type {
  HierarchicalTreeNode,
  SelectionState,
  ExpansionState,
  SortState,
  FilterState,
  ViewState,
  TreeTableState,
  NavigationState,
  LoadingState,
  ErrorState,
} from './types/index.js';

// View mode types
export type { ViewMode, SortMode, IconPosition, ViewProperties } from './types/view-mode-types.js';
export { VIEW_MODE_DEFAULTS } from './types/view-mode-types.js';

// View mode state
export { viewModeAtomFamily, sortModeAtomFamily, zoomLevelAtomFamily } from './state/view-mode-atoms.js';

// View mode sync hook
export { useViewModeSync } from './hooks/useViewModeSync.js';
export type { UseViewModeSyncArgs } from './hooks/useViewModeSync.js';

// Background context menu
export { BackgroundContextMenu } from './components/BackgroundContextMenu.js';
export type { BackgroundContextMenuProps } from './components/BackgroundContextMenu.js';

// Zoom layout utilities
export { computeZoomLayout, computeReorganizedPositions, CELL_GAP_PX } from './utils/zoom-layout.js';
export type { ZoomLayout, ReorganizedPosition } from './utils/zoom-layout.js';
