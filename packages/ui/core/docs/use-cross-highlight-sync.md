# useCrossHighlightSync — 相互ハイライト/イベント配線の共通フック

最終更新: 2025-09-11

`useCrossHighlightSync` は CrossViewStyles を簡単に導入するための共通フックで、
表側（GenericDataGrid）の props、deck.gl のアクセサ/イベント、MapLibre のイベントバインディングをまとめて提供します。

## 使い方

```tsx
import { useCrossHighlightSync, CrossViewSnackbar } from '@hierarchidb/ui-core';

const datasetId = `shape:${tableId}`;
const { rowSets, dataGrid, deck, bindMapLibre } = useCrossHighlightSync({ datasetId });

// 表
<GenericDataGrid
  columns={cols}
  rows={rows}
  selectedRows={rowSets.selected}
  hoveredRows={rowSets.hovered}
  matchedRows={rowSets.matched}
  disabledRows={rowSets.disabled}
  draggingRows={rowSets.dragging}
  dropTargetRows={rowSets.dropTarget}
  onRowHover={dataGrid.onRowHover}
  onRowLeave={dataGrid.onRowLeave}
  rowSx={dataGrid.rowSx}
/>;

// deck.gl
new GeoJsonLayer({
  id: 'layer',
  data,
  getFillColor: deck.getFillColor,
  getLineColor: deck.getLineColor,
  getLineWidth: deck.getLineWidth,
  onHover: deck.onHover,
  onClick: deck.onClick,
});

// MapLibre
React.useEffect(() => bindMapLibre(map, 'sourceId', ['layerId'], { selectOnClick: true }), [map]);

// Snackbar
<CrossViewSnackbar datasetId={datasetId} />
```

## API

```ts
function useCrossHighlightSync(options: { datasetId: string; withDeckAccessors?: boolean }): {
  rowSets: { hovered:Set<Id>; selected:Set<Id>; matched:Set<Id>; disabled:Set<Id>; dragging:Set<Id>; dropTarget:Set<Id> };
  dataGrid: {
    hoveredRows: Set<Id>; selectedRows: Set<Id>; matchedRows: Set<Id>; disabledRows: Set<Id>; draggingRows: Set<Id>; dropTargetRows: Set<Id>;
    onRowHover: (row:any, rowId:Id)=>void;
    onRowLeave: (row:any, rowId:Id)=>void;
    rowSx: (state:{rowId:Id})=>any;
  };
  deck: { getFillColor?:(d:any)=>any; getLineColor?:(d:any)=>any; getLineWidth?:(d:any)=>any; getElevation?:(d:any)=>any; onHover:(info:any)=>void; onClick:(info:any)=>void };
  bindMapLibre: (map:any, sourceId:string, layerIds:string[], opts?:{selectOnClick?:boolean})=>()=>void;
}
```

## 補足

- `rowSets` は CrossViewStyles の現在値スナップショットです。視覚状態の変更は `setState()` から行ってください。
- deck/gl の `onHover/onClick` は既存のハンドラに合成して使う場合、ラップして呼び出してください。
- MapLibre 側は `applyMapLibreFeatureState` を自動的に呼ばないため、必要に応じて適宜呼び出すか、イベントハンドラ内で呼び出してください。

