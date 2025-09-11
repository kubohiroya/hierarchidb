# GenericDataGrid 行状態とスタイル連携ガイド

最終更新: 2025-09-11

GenericDataGrid は、外部から Set<RowId> で行の視覚状態を制御でき、`rowStyle/rowClassName/rowSx` により複合条件の見た目もカスタム可能です。本書は主な props と連携例をまとめます。

## 行状態（Set<RowId>）

- `selectedRows`: 選択中の行
- `hoveredRows`: マウスホバー中の行（外部制御）
- `matchedRows`: 検索マッチ等で強調する行
- `disabledRows`: 操作不可の行
- `draggingRows`: ドラッグ中の行
- `dropTargetRows`: ドロップターゲットの行

> `hoveredRows` は内部で :hover を使った見た目と併用可能です。相互同期（表↔地図）を行う場合は外部で制御するのが便利です。

## 行フォーカスイベント

- `onRowHover(row, rowId)` と `onRowLeave(row, rowId)` を用意。CrossViewStyles と組み合わせて、地図側の hover と相互同期できます。

```tsx
<GenericDataGrid
  rows={rows}
  columns={cols}
  onRowHover={(row,rowId) => CrossViewStyles.setState(datasetId,'rows','hovered', new Set([rowId]))}
  onRowLeave={() => CrossViewStyles.setState(datasetId,'rows','hovered', new Set())}
/> 
```

## 見た目のカスタマイズ

既定のレイヤー（低優先）

- `matched` → 左インセットの強調線
- `selected` → 背景色（primary.light）
- `hovered` → 薄いアウトライン
- `dragging` → 透明度
- `dropTarget` → 破線アウトライン
- `disabled` → 半透明＋pointerEvents none＋軽いグレースケール

カスタムの適用（上書き）

```tsx
<GenericDataGrid
  rows={rows}
  columns={cols}
  rowSx={(state) => {
    if (state.selected && state.matched) return { outline: '2px solid #1976d2', backgroundColor: 'primary.light' };
    if (state.disabled) return { opacity: 0.6 };
    return undefined;
  }}
  rowClassName={(state) => state.dragging ? 'row--dragging' : undefined}
  rowStyle={(state) => state.dropTarget ? { boxShadow:'inset 0 0 0 2px #1976d2' } : undefined}
/> 
```

## 推奨: CrossViewStyles との併用

CrossViewStyles を用いると、行状態と地図フィーチャの状態・スタイルを一元的に制御できます。Snackbar での詳細表示も簡単です。詳細は `packages/ui/core/docs/cross-view-styles.md` を参照してください。

