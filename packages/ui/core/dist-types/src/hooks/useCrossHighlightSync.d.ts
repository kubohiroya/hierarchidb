export interface UseCrossHighlightSyncOptions {
    datasetId: string;
    /** When true, deck.gl accessors (fill/line/width/elevation) are included */
    withDeckAccessors?: boolean;
}
export declare function useCrossHighlightSync({ datasetId, withDeckAccessors }: UseCrossHighlightSyncOptions): {
    rowSets: {
        hovered: Set<import("../sync/CrossViewStyles").Id>;
        selected: Set<import("../sync/CrossViewStyles").Id>;
        matched: Set<import("../sync/CrossViewStyles").Id>;
        disabled: Set<import("../sync/CrossViewStyles").Id>;
        dragging: Set<import("../sync/CrossViewStyles").Id>;
        dropTarget: Set<import("../sync/CrossViewStyles").Id>;
    };
    dataGrid: {
        hoveredRows: Set<import("../sync/CrossViewStyles").Id>;
        selectedRows: Set<import("../sync/CrossViewStyles").Id>;
        matchedRows: Set<import("../sync/CrossViewStyles").Id>;
        disabledRows: Set<import("../sync/CrossViewStyles").Id>;
        draggingRows: Set<import("../sync/CrossViewStyles").Id>;
        dropTargetRows: Set<import("../sync/CrossViewStyles").Id>;
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