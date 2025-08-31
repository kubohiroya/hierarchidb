# @hierarchidb/runtime-search-result-window

検索結果ウィンドウコンポーネントパッケージ

## 概要

このパッケージは、HierarchiDBの検索結果を表示・操作するためのウィンドウコンポーネントを提供します。検索結果の表示、複数選択、地図上でのハイライト機能などを統合的に管理します。

## 主要機能

- **検索結果テーブル表示**: 検索結果を表形式で表示
- **複数選択機能**: 単一選択、範囲選択、全選択をサポート
- **地図連携**: 選択したノードを地図上でハイライト表示
- **フローティングウィンドウ**: ドラッグ可能な独立ウィンドウとして表示

## 状態管理アーキテクチャ

### Jotai導入（2024年実装）

複雑な状態管理を簡素化するため、Jotaiライブラリを採用しました。

#### 導入背景
- 複数選択、範囲選択、ハイライト状態の同期が複雑化
- MapとTableコンポーネント間の状態共有が困難
- useStateの乱立によるコードの可読性低下

#### Jotaiによる改善点
1. **統一された状態管理**: atomsによる一元的な状態定義
2. **派生状態の自動計算**: 選択状態から全選択/部分選択を自動導出
3. **アクションの分離**: 状態更新ロジックをatomアクションとして整理
4. **コンポーネント間の連携簡素化**: Provider不要でグローバル状態を共有

### State Atoms構成

#### searchResult.atoms.ts
検索結果と選択状態を管理するatoms：

```typescript
// データ
searchResultsAtom           // 検索結果配列
selectedNodeIdsAtom         // 選択されたノードIDのSet
lastSelectedIndexAtom       // 最後に選択したインデックス（範囲選択用）

// 派生状態
selectedResultItemsAtom     // 選択された結果アイテム
isAllSelectedAtom          // 全選択状態
isSomeSelectedAtom         // 部分選択状態
selectionRangeAtom         // 範囲選択の計算結果

// アクション
selectNodeAtom             // 単一選択
toggleNodeSelectionAtom    // 選択トグル
selectRangeAtom           // 範囲選択
selectAllAtom             // 全選択
clearSelectionAtom        // 選択クリア
```

#### mapHighlight.atoms.ts
地図ハイライト機能のatoms：

```typescript
// 状態
searchMatchedNodeIdsAtom   // 検索でマッチしたノード
highlightedNodeIdsAtom     // ハイライト表示するノード
focusedNodeIdAtom         // フォーカス中のノード
highlightStylesAtom       // ハイライトスタイル設定

// 派生状態
mapHighlightStateAtom     // 統合ハイライト状態

// アクション
setSearchMatchedNodesAtom // 検索マッチ設定
setHighlightedNodesAtom   // ハイライト設定
setFocusedNodeAtom       // フォーカス設定
clearAllHighlightsAtom   // 全ハイライトクリア
```

## 使用方法

### 基本的な使用例

```tsx
import { SearchResultWindow } from '@hierarchidb/runtime-search-result-window';
import { Provider } from 'jotai';

function App() {
  return (
    <Provider>
      <SearchResultWindow
        results={searchResults}
        onSelectionChange={handleSelectionChange}
        onMapFocus={handleMapFocus}
      />
    </Provider>
  );
}
```

### Hooksの使用

#### useMultiSelection（Jotaiベース）
```tsx
const {
  selectedResults,        // 選択されたノードIDのSet
  selectedResultItems,    // 選択された結果アイテム
  handleResultSelect,     // 選択処理
  selectAll,             // 全選択
  clearSelection,        // 選択クリア
} = useMultiSelection({
  results,
  onSelectionChange,
});
```

#### useMapHighlight（Jotaiベース）
```tsx
const {
  highlightState,        // ハイライト状態
  setSearchMatched,      // 検索マッチ設定
  setSelected,          // 選択ハイライト設定
  setFocused,           // フォーカス設定
  clearAll,             // 全クリア
} = useMapHighlight({
  mapInstance,
  onStateChange,
});
```

## コンポーネント構成

### SearchResultTable
- 検索結果を表形式で表示
- チェックボックスによる選択UI
- ダブルクリックで地図フォーカス

### MapHighlightProvider
- 地図ハイライト機能のコンテキスト提供
- Jotai atomsをラップして互換性を維持

### 選択モード

1. **単一選択**: 通常クリック
2. **トグル選択**: Cmd/Ctrl + クリック
3. **範囲選択**: Shift + クリック
4. **全選択**: ヘッダーチェックボックス

## 技術的詳細

### パフォーマンス最適化
- Jotaiの自動的なレンダリング最適化
- 派生状態の自動メモ化
- 必要なコンポーネントのみ再レンダリング

### 型安全性
- TypeScriptによる完全な型定義
- NodeId branded typeの使用
- SearchResult型の厳密な定義

## 依存関係

- `jotai`: ^2.13.1 - 状態管理
- `@mui/material`: UI コンポーネント
- `@hierarchidb/common-type`: 共通型定義
- `@hierarchidb/ui-floating-window`: フローティングウィンドウ

## Storybook

### 実行方法

プロジェクトルートから：
```bash
# Storybookを起動
pnpm storybook:ui-core
```

### 利用可能なStories

1. **SearchResultTable**
   - `SearchResult/SearchResultTable`
   - 基本表示、選択状態、大量データなどのバリエーション

2. **MapHighlightProvider** 
   - `SearchResult/MapHighlightProvider`
   - ハイライト状態管理のデモとテスト

3. **useMultiSelection**
   - `SearchResult/useMultiSelection` 
   - 複数選択機能のインタラクティブデモ

### Storybookでテストできる機能

- **複数選択**: 単一選択、範囲選択、全選択の操作
- **ハイライト管理**: 検索マッチ、選択状態、フォーカスの制御
- **パフォーマンス**: 大量データでの動作確認
- **コールバック**: 状態変更イベントのモニタリング

## 今後の拡張予定

- [ ] 仮想スクロール対応（大量データ対応）
- [ ] 列のカスタマイズ機能
- [ ] エクスポート機能
- [ ] フィルタリング機能の強化

## マイグレーションガイド

### 従来のuseState実装からの移行

1. **Provider追加**: アプリケーションルートにJotai Providerを追加（オプション）
2. **Hook置き換え**: useMultiSelectionは互換性を維持
3. **MapHighlightService**: 内部でJotai atomsを使用するよう変更

既存のAPIは維持されているため、破壊的変更はありません。