/**
 * Zoom-level-to-layout mapping utility.
 *
 * Computes icon size and cell size from a zoom level (0–100).
 * The mapping is a pure function with strictly monotonically increasing iconSize.
 */

/** Layout dimensions derived from a zoom level. */
export interface ZoomLayout {
    /** Icon size in pixels, strictly monotonically increasing with zoomLevel. */
    iconSize: number;
    /** Cell size for grid layout and free positioning coordinate scaling. */
    cellSize: { width: number; height: number };
}

/** Gap between cells in pixels (fixed). */
export const CELL_GAP_PX = 8;

/** Minimum width for the name label area. */
export const NAME_MIN_WIDTH_PX = 8 * 16; // 8em * 16px base font = 128px

/** Minimum height for the name label area (2 lines). */
export const NAME_MIN_HEIGHT_PX = 2 * 16; // 2em * 16px base font = 32px

/**
 * Computes icon size and cell size from a zoom level (0–100).
 *
 * - iconSize: strictly monotonically increasing with zoomLevel
 *   - zoomLevel 0 → 32px, zoomLevel 100 → 256px
 *   - Uses Math.round(32 + zoomLevel * 2.24). Since the step per integer
 *     increment is always >= 2.0, rounding cannot collapse adjacent values.
 * - cellSize.width: max(iconSize, nameMinWidth) + gap
 * - cellSize.height: iconSize + nameMinHeight + gap
 *
 * @param zoomLevel - Integer in [0, 100]
 * @throws Error if zoomLevel is not a finite number in [0, 100]
 */
export function computeZoomLayout(zoomLevel: number): ZoomLayout {
    if (!Number.isFinite(zoomLevel) || zoomLevel < 0 || zoomLevel > 100) {
        throw new Error(`zoomLevel must be a finite number in [0, 100], got: ${zoomLevel}`);
    }

    const iconSize = Math.round(16 + zoomLevel * 1.12);

    return {
        iconSize,
        cellSize: {
            width: Math.max(iconSize + CELL_GAP_PX * 4, NAME_MIN_WIDTH_PX) + CELL_GAP_PX,
            height: iconSize + NAME_MIN_HEIGHT_PX + CELL_GAP_PX,
        },
    };
}

/** Position assignment for a single node after reorganization. */
export interface ReorganizedPosition {
    nodeId: string;
    col: number;
    row: number;
}

/**
 * Compute grid positions for reorganizing icons.
 *
 * 1. Calculate columns from viewport width and cell size
 * 2. Sort nodes by name (localeCompare)
 * 3. Assign row-major grid positions
 *
 * Pure function — no side effects.
 *
 * @param nodes - Array of nodes with id and name
 * @param viewportWidth - Container width in pixels (must be > 0)
 * @param cellSize - Cell dimensions from computeZoomLayout
 * @returns Array of positions, one per input node
 */
export function computeReorganizedPositions(
    nodes: ReadonlyArray<{ id: string; metadata: { name: string } }>,
    viewportWidth: number,
    cellSize: { width: number; height: number },
): ReorganizedPosition[] {
    if (nodes.length === 0) return [];

    const columns = Math.max(1, Math.floor(viewportWidth / (cellSize.width + CELL_GAP_PX)));

    const sorted = [...nodes].sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));

    return sorted.map((node, i) => ({
        nodeId: node.id,
        col: i % columns,
        row: Math.floor(i / columns),
    }));
}
