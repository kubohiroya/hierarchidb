import type { Id } from '../sync/CrossViewStyles.js';
export interface UseCrossHighlightSyncOptions {
    datasetId: string;
    /** When true, deck.gl accessors (fill/line/width/elevation) are included */
    withDeckAccessors?: boolean;
}
export declare function useCrossHighlightSync({ datasetId, withDeckAccessors }: UseCrossHighlightSyncOptions): {
    rowSets: {
        hovered: Set<Id>;
        selected: Set<Id>;
        matched: Set<Id>;
        disabled: Set<Id>;
        dragging: Set<Id>;
        dropTarget: Set<Id>;
    };
    dataGrid: {
        hoveredRows: Set<Id>;
        selectedRows: Set<Id>;
        matchedRows: Set<Id>;
        disabledRows: Set<Id>;
        draggingRows: Set<Id>;
        dropTargetRows: Set<Id>;
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