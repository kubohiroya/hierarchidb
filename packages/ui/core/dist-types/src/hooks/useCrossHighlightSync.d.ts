export interface UseCrossHighlightSyncOptions {
    datasetId: string;
    /** When true, deck.gl accessors (fill/line/width/elevation) are included */
    withDeckAccessors?: boolean;
}
export declare function useCrossHighlightSync({ datasetId, withDeckAccessors }: UseCrossHighlightSyncOptions): {
    rowSets: {
        hovered: Set<import("../sync/CrossViewStyles.js").Id>;
        selected: Set<import("../sync/CrossViewStyles.js").Id>;
        matched: Set<import("../sync/CrossViewStyles.js").Id>;
        disabled: Set<import("../sync/CrossViewStyles.js").Id>;
        dragging: Set<import("../sync/CrossViewStyles.js").Id>;
        dropTarget: Set<import("../sync/CrossViewStyles.js").Id>;
    };
    dataGrid: {
        hoveredRows: Set<import("../sync/CrossViewStyles.js").Id>;
        selectedRows: Set<import("../sync/CrossViewStyles.js").Id>;
        matchedRows: Set<import("../sync/CrossViewStyles.js").Id>;
        disabledRows: Set<import("../sync/CrossViewStyles.js").Id>;
        draggingRows: Set<import("../sync/CrossViewStyles.js").Id>;
        dropTargetRows: Set<import("../sync/CrossViewStyles.js").Id>;
        onRowHover: (row: any, rowId: string | number) => void;
        onRowLeave: (_row: any, _rowId: string | number) => void;
        rowSx: (state: {
            rowId: string | number;
        }) => Record<string, any> | undefined;
    };
    deck: {
        onHover: (info: any) => void;
        onClick: (info: any) => void;
        getFillColor?: ((d: any) => [number, number, number, number]) | undefined;
        getLineColor?: ((d: any) => [number, number, number, number]) | undefined;
        getLineWidth?: ((d: any) => number) | undefined;
        getElevation?: ((d: any) => number) | undefined;
    };
    bindMapLibre: (map: any, sourceId: string, layerIds: string[], opts?: {
        selectOnClick?: boolean;
    }) => () => void;
};
//# sourceMappingURL=useCrossHighlightSync.d.ts.map