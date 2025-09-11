# 既存 Route / Shape / Location 地図コードへの useCrossHighlightSync 導入ガイド

最終更新: 2025-09-11

本書は、既存の Route / Shape / Location の地図表示コードに、相互ハイライト/選択/検索マッチ同期（CrossViewStyles）と、
共通フック（useCrossHighlightSync / useMapLibreFeatureState）を組み込むための詳細ガイドです。ここではコード変更は行わず、
実装の流れとスニペットを提示します。

---

## 概要: 何を達成するか

- 表（DataGrid）と地図（MapLibre / deck.gl）の「hover / select / match」状態を同期
- スタイル辞書（StyleId → StyleSpec）を行/フィーチャ双方へ適用（composeMode: override/merge）
- 行/フィーチャのフォーカスイベントを MUI Snackbar で表示（名前・種類・説明・座標など）

利用する主なAPI/コンポーネント（@hierarchidb/ui-core）

- CrossViewStyles（状態・スタイルの中核）
- useCrossHighlightSync（表/地図のイベント配線を共通化）
- useMapLibreFeatureState（MapLibre の feature-state を自動同期）
- CrossViewSnackbar（フォーカスイベント表示）

---

## 導入方針（全プラグイン共通）

1) datasetId を決める

- 例: `route:${tableId}` / `shape:${tableId}` / `location:${tableId}`
- datasetId 単位で表と地図のチャンネルを共有します

2) 行IDとフィーチャIDの対応登録（setMapping）

- 行ID: DataGrid の getRowId（既定: `row.id ?? index`）
- フィーチャID: deck.gl の `object.id` または MapLibre の Feature `id`
- `CrossViewStyles.setMapping(datasetId, Array<{ rowId, featureIds[] }>)` で登録

3) スタイル辞書の準備（オプション）

```ts
CrossViewStyles.setStyles(datasetId, new Map([
  ['hover',  { priority:10, composeMode:'merge', row: { sx: { outline:'2px solid #1976d2' } }, map: { lineWidth:3,  featureState:{ hovered:true } } }],
  ['select', { priority:20, composeMode:'merge', row: { sx: { backgroundColor:'#e3f2fd' } }, map: { fillColor:[25,118,210,128], featureState:{ selected:true } } }],
  ['match',  { priority: 5, composeMode:'merge', row: { sx: { boxShadow:'inset 3px 0 0 0 #1976d2' } }, map: { lineColor:[0,0,0,200] } }],
]));
```

4) 共通フックの導入

```tsx
import { useCrossHighlightSync, useMapLibreFeatureState, CrossViewSnackbar } from '@hierarchidb/ui-core';

const datasetId = `${nodeType}:${tableId}`; // 例: 'route:table-123'
const { rowSets, dataGrid, deck, bindMapLibre } = useCrossHighlightSync({ datasetId });

// MapLibre の feature-state 自動同期（任意）
useMapLibreFeatureState({ datasetId, map, sourceId: 'your-source-id', throttleMs: 16 });

// Snackbar を画面のどこかに配置
<CrossViewSnackbar datasetId={datasetId} />
```

5) 表と地図へ配線

- DataGrid に `dataGrid` の props をそのまま渡す（hover/leave, rowSx, 状態セット）
- deck.gl レイヤへ `deck` のアクセサ/イベントを渡す
- MapLibre へ `bindMapLibre(map, sourceId, [layerIds], { selectOnClick:true })` を useEffect 等で一度だけバインド

---

## Route への組み込み（例: RoutePanel / deck.gl + TabularPreview）

前提:
- ルート結果の GeoJSON 上で各 Feature に `id` が付与されている
- 下段に TabularPreview（表）があり、`row.id` がルートID（またはカーソル用ID）である

1) datasetId の決定

```ts
const datasetId = `route:${tableId}`;
```

2) 行→フィーチャの対応作成

```ts
const pairs = routes.map((r) => ({ rowId: r.id, featureIds: r.featureIds }));
CrossViewStyles.setMapping(datasetId, pairs);
```

3) 表の配線（TabularPreview を使わない場合の例）

```tsx
<GenericDataGrid
  columns={cols}
  rows={rows}
  selectedRows={rowSets.selected}
  hoveredRows={rowSets.hovered}
  matchedRows={rowSets.matched}
  disabledRows={rowSets.disabled}
  onRowHover={dataGrid.onRowHover}
  onRowLeave={dataGrid.onRowLeave}
  rowSx={dataGrid.rowSx}
/>
```

4) deck.gl の配線

```ts
const layer = new GeoJsonLayer({
  id: 'route-layer',
  data: routeGeojson,
  getFillColor: deck.getFillColor,
  getLineColor: deck.getLineColor,
  getLineWidth: deck.getLineWidth,
  onHover: deck.onHover,
  onClick: deck.onClick,
});
```

5) MapLibre の配線

```ts
React.useEffect(() => bindMapLibre(map, 'route-source', ['route-line-layer','route-symbol-layer'], { selectOnClick:true }), [map]);
useMapLibreFeatureState({ datasetId, map, sourceId: 'route-source', throttleMs: 16 });
```

---

## Shape への組み込み（例: Shape の BatchProcessingDialog / deck.gl）

1) datasetId

```ts
const datasetId = `shape:${tableId}`;
```

2) マッピング

```ts
const pairs = features.map((f) => ({ rowId: f.properties.rowId, featureIds: [f.id] }));
CrossViewStyles.setMapping(datasetId, pairs);
```

3) deck.gl / DataGrid / Snackbar は Route の例を踏襲

---

## Location への組み込み（例: BatchProgressDialog / MapLibre中心）

1) datasetId

```ts
const datasetId = `location:${tableId}`;
```

2) マッピング

```ts
const pairs = locations.map((loc) => ({ rowId: loc.id, featureIds: [loc.featureId] }));
CrossViewStyles.setMapping(datasetId, pairs);
```

3) MapLibre 配線

```ts
React.useEffect(() => bindMapLibre(map, 'location-source', ['location-points'], { selectOnClick:true }), [map]);
useMapLibreFeatureState({ datasetId, map, sourceId: 'location-source', throttleMs: 16 });
```

---

## スタイル辞書のベストプラクティス

- 優先度（priority）は「選択 > ホバー > マッチ」の順で大きくする
- composeMode:'merge' を使うと、選択＋ホバーのような組み合わせ表現が簡単
- MapLibre の feature-state は、塗り/線の式で参照できるよう、boolean フラグ（selected/hovered など）を与えておく

例:

```ts
CrossViewStyles.setStyles(datasetId, new Map([
  ['match',  { priority: 5,  composeMode:'merge', map:{ lineColor:[0,0,0,180] } }],
  ['hover',  { priority: 10, composeMode:'merge', row:{ sx:{ outline:'2px solid #1976d2' } }, map:{ featureState:{ hovered:true } } }],
  ['select', { priority: 20, composeMode:'merge', row:{ sx:{ backgroundColor:'#e3f2fd' } }, map:{ featureState:{ selected:true } } }],
]));
```

---

## よくある質問

- Q. feature.id が無い場合は？
  - A. データ作成時に安定した ID を必ず付与してください（GeoJSON Feature.id / MapLibre の source フィーチャ ID）。
- Q. 表の行IDとフィーチャIDが1:n の場合？
  - A. `setMapping()` は複数 ID を配列で受け取れます。双方向マップを内部で自動構築します。
- Q. Snackbar に表示する内容を変更したい
  - A. CrossViewSnackbar に `format(ev)` を渡してください（タイトル/本文を自由に加工）。
- Q. MapLibre の feature-state が残る
  - A. `applyMapLibreFeatureState` を更新毎に呼び出す/`removeFeatureState` を適宜呼ぶ/`useMapLibreFeatureState` を利用。

---

## 参考
- `packages/ui/core/docs/cross-view-styles.md` — CrossViewStyles と Snackbar の基本ガイド
- `packages/ui/core/docs/use-cross-highlight-sync.md` — 共通フックの詳細
- `packages/ui/data-grid/docs/row-state-styling.md` — DataGrid の行状態/スタイルガイド

