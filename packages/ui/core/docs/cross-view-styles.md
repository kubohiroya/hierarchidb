# CrossViewStyles と CrossViewSnackbar — 表と地図の相互ハイライト/詳細表示ガイド

最終更新: 2025-09-11

本書は、行（RowId）と地図フィーチャ（FeatureId）に同じスタイルモデルを適用しつつ、ホバー/選択/検索マッチを相互同期し、さらにフォーカスイベントで詳細情報を MUI Snackbar に表示する方法をまとめたものです。

## コンセプト

- datasetId ごとにチャネルを分け、表（DataGrid）と地図（MapLibre/Deck.gl）が同一の状態とスタイル辞書を共有します。
- Map<StyleId, StyleSpec> の辞書に、表用(row.sx/style/className) と地図用(map.fillColor など) の両方を記述できます。
- rowId ↔ featureId のマッピングを持つため、片側の状態（hovered/selected/matched）更新をもう片側へ自動反映できます。
- CrossViewSnackbar が subscribeFocus でフォーカスイベントを購読し、（名前・種類・説明・座標など）を表示できます。

## API 概要（抜粋）

```ts
import { CrossViewStyles } from '@hierarchidb/ui-core';

// マッピング（行 → フィーチャ群）
CrossViewStyles.setMapping(datasetId, [
  { rowId: 'r1', featureIds: ['f10','f11'] },
]);

// スタイル辞書
CrossViewStyles.setStyles(datasetId, new Map([
  ['hover', { priority: 10, composeMode:'merge', row: { sx: { outline: '2px solid #1976d2' } }, map: { lineWidth: 3, featureState:{ hovered:true } } }],
  ['select', { priority: 20, composeMode:'merge', row: { sx: { backgroundColor: '#e3f2fd' } }, map: { fillColor: [25,118,210,128], featureState:{ selected:true } } }],
]));

// スタイル割当（行/フィーチャ）
CrossViewStyles.assignRows(datasetId, 'select', new Set(['r1','r2']));
CrossViewStyles.assignFeatures(datasetId, 'hover', new Set(['f10']));

// 状態セット（hovered/selected/matched/disabled/dragging/dropTarget）
CrossViewStyles.setState(datasetId, 'rows', 'hovered', new Set(['r1']));
// ← mapping により、features.hovered にも対応反映される

// deck.gl アクセサ
const acc = CrossViewStyles.getDeckAccessors(datasetId);
// → getFillColor/getLineColor/getLineWidth/getElevation をレイヤに渡す

// MapLibre feature-state の反映
CrossViewStyles.applyMapLibreFeatureState(datasetId, map, 'mySourceId');

// フォーカスイベント（snackbar 用）
CrossViewStyles.emitFocus(datasetId, { datasetId, source: 'row', id: 'r1', data: { name:'名称', type:'種類', description:'説明', coordinates:[139.7,35.6] } });
CrossViewStyles.emitBlur(datasetId);
```

## DataGrid 側の使い方

GenericDataGrid に、行状態とスタイルを外部制御するための props を追加しています。

```tsx
<GenericDataGrid
  columns={cols}
  rows={rows}
  // 視覚状態セット（任意）
  selectedRows={rowSets.selected}
  hoveredRows={rowSets.hovered}
  matchedRows={rowSets.matched}
  disabledRows={rowSets.disabled}
  draggingRows={rowSets.dragging}
  dropTargetRows={rowSets.dropTarget}
  // 行フォーカスイベント
  onRowHover={(row,rowId) => {
    CrossViewStyles.setState(datasetId, 'rows', 'hovered', new Set([rowId]));
    CrossViewStyles.emitFocus(datasetId, { datasetId, source:'row', id: rowId, data: row });
  }}
  onRowLeave={(row,rowId) => {
    CrossViewStyles.setState(datasetId, 'rows', 'hovered', new Set());
    CrossViewStyles.emitBlur(datasetId);
  }}
  // 行スタイル合成（辞書から最終形を解決）
  rowSx={(state) => CrossViewStyles.resolveRowStyle(datasetId, state.rowId)?.sx}
/> 
```

> 行IDの解決は `getRowId`（省略時は `row.id` or インデックス）で行います。行IDとフィーチャIDの対応は setMapping() で登録してください。

## Deck.gl 側の使い方

```ts
const acc = CrossViewStyles.getDeckAccessors(datasetId);
const layer = new GeoJsonLayer({
  id: 'shape-layer',
  data,
  getFillColor: acc.getFillColor,
  getLineColor: acc.getLineColor,
  getLineWidth: acc.getLineWidth,
  onHover: (info) => {
    if (info?.object?.id) {
      CrossViewStyles.setState(datasetId, 'features', 'hovered', new Set([info.object.id]));
      CrossViewStyles.emitFocus(datasetId, { datasetId, source:'feature', id: info.object.id, data: info.object.properties });
    }
  },
  onClick: (info) => {
    if (info?.object?.id) {
      CrossViewStyles.setState(datasetId, 'features', 'selected', new Set([info.object.id]));
    }
  },
});
```

## MapLibre 側の使い方

```ts
map.on('mousemove', 'layer-id', (e) => {
  const f = e.features?.[0];
  if (!f?.id) return;
  CrossViewStyles.setState(datasetId, 'features', 'hovered', new Set([f.id as any]));
  CrossViewStyles.emitFocus(datasetId, { datasetId, source:'feature', id: f.id as any, data: f.properties });
  CrossViewStyles.applyMapLibreFeatureState(datasetId, map, 'source-id');
});
map.on('mouseleave', 'layer-id', () => CrossViewStyles.emitBlur(datasetId));
```

> MapLibre の視覚表現は paint/line-paint の式側で feature-state を参照して指定してください（例: `['case',['boolean',['feature-state','selected'],false], ...]`）。

### 自動同期フック（useMapLibreFeatureState）

```ts
import { useMapLibreFeatureState } from '@hierarchidb/ui-core';
useMapLibreFeatureState({ datasetId, map, sourceId: 'source-id', throttleMs: 16 });
```

CrossViewStyles の状態変更時に applyMapLibreFeatureState を自動呼び出しします。throttleMs で描画負荷を抑えられます。

## Snackbar での詳細表示

コンポーネント `CrossViewSnackbar` を配置し、subscribeFocus() の結果（FocusEventPayload）を表示します。format() でタイトル/本文を加工できます。

```tsx
import { CrossViewSnackbar } from '@hierarchidb/ui-core';

<CrossViewSnackbar
  datasetId={datasetId}
  autoHideDuration={3000}
  format={(ev) => ({
    title: `[${ev.source}] ${ev.data?.type ?? ''}`.trim(),
    message: [ev.data?.name ?? ev.id, ev.data?.description, Array.isArray(ev.data?.coordinates) ? `(${ev.data.coordinates[0]},${ev.data.coordinates[1]})` : '']
      .filter(Boolean).join(' / '),
  })}
/>
```

## ベストプラクティス

- datasetId の命名規則を統一（例: `${nodeType}:${tableId}`）。
- 行ID/フィーチャIDの安定化（行の getRowId・GeoJSON の feature.id を必ず設定）。
- StyleSpec の priority を決めて、選択＞ホバー＞マッチ の順に上書きされるよう整理。
- MapLibre の feature-state はクリアを忘れない（必要なら `map.removeFeatureState` を併用）。
