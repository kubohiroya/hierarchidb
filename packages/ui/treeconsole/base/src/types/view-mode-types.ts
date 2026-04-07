/**
 * View mode type definitions for TreeConsole.
 *
 * Defines the three display modes (icon / list / column), sort modes,
 * icon positioning, and the composite ViewProperties persisted on TreeNode.
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
 * Per-folder view settings persisted on `TreeNode.viewProperties`.
 *
 * All fields are optional — absent values are resolved via {@link VIEW_MODE_DEFAULTS}
 * at the atom initialisation layer, NOT at the data layer.
 */
export interface ViewProperties {
    viewMode?: ViewMode;
    zoomLevel?: number;
    sortMode?: SortMode;
    iconPosition?: IconPosition;
}

/**
 * Default values applied when a TreeNode has no persisted `viewProperties`.
 *
 * `iconPosition` is intentionally excluded — it has no meaningful default
 * (only relevant in icon-view free-positioning mode).
 */
export const VIEW_MODE_DEFAULTS = {
    viewMode: 'list' as const,
    zoomLevel: 50,
    sortMode: 'none' as const,
} satisfies Required<Omit<ViewProperties, 'iconPosition'>>;
