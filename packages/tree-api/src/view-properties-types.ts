/**
 * View-related property types persisted on TreeNode.
 *
 * These types define the shape of the `viewProperties` field on TreeNode,
 * enabling per-node persistence of view mode settings (viewMode, sortMode,
 * zoomLevel) and icon positioning data.
 */

/** Display mode for the TreeConsole content area. */
export type ViewMode = 'icon' | 'list' | 'column';

/** Sort ordering applied to nodes in the current view. */
export type SortMode =
  | 'none'
  | 'name'
  | 'type'
  | 'lastOpened'
  | 'created'
  | 'modified'
  | 'size'
  | 'tag';

/** Absolute x/y position of an icon in free-positioning (sortMode "none") mode. */
export interface IconPosition {
  x: number;
  y: number;
}

/**
 * Per-node view settings persisted on `TreeNode.viewProperties`.
 *
 * All fields are optional — absent values are resolved via defaults
 * at the UI/atom initialisation layer, NOT at the data layer.
 */
export interface ViewProperties {
  viewMode?: ViewMode;
  zoomLevel?: number;
  sortMode?: SortMode;
  iconPosition?: IconPosition;
}
