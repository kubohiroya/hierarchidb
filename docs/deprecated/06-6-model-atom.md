# 6.6 Jotai Atomsによる状態管理モデル

## 概要

TreeConsoleパッケージ（`@hierarchidb/ui-treeconsole`）では、Jotaiを用いた中央集権的な状態管理を採用しています。本章では、アーキテクチャ図に記載されている各Atomの役割と実装について詳しく説明します。

## ファイル構造とハイブリッドアプローチ

### ディレクトリ構成

状態管理の複雑性に対応するため、機能グループとatom種別を組み合わせたハイブリッドアプローチを採用：

```
state/
├── openstreetmap-type.ts                    # 統合エクスポート
├── core/                       # コアデータ層
│   ├── data.atoms.ts          # テーブルデータ（50行）
│   └── table.atoms.ts         # TanStack Table状態（20行）
├── features/                   # 機能別atom群
│   ├── selection.atoms.ts     # 選択機能（60行）
│   ├── expansion.atoms.ts     # 展開機能（45行）
│   ├── editing.atoms.ts       # 編集機能（15行）
│   ├── dragDrop.atoms.ts      # D&D機能（20行）
│   └── subscription.atoms.ts  # 購読機能（25行）
└── config/                     # 設定層
    ├── view.atoms.ts          # ビュー設定（20行）
    └── ui.atoms.ts            # UI状態（15行）
```

### ハイブリッドアプローチの利点

1. **機能的凝集性**: 関連するatomを同一ファイルに配置
2. **適切なファイルサイズ**: 各ファイル15-60行で管理しやすい
3. **明確な依存関係**: core → features → config の階層構造
4. **容易なテスト**: 機能単位でのユニットテスト記述が簡単
5. **並行開発**: チームメンバーが異なる機能を独立して開発可能

## Atomsの分類と責務

### 1. Core Data Atoms（コアデータ）
**ファイル**: `state/core/data.atoms.ts`

#### tableDataAtom
```typescript
export const tableDataAtom = atom<TreeNode[]>([]);
```
**責務**: TreeConsoleで表示する全ノードデータを保持
- Workerから取得した生のツリーノードデータ
- SubTree購読による更新を反映
- 他のatomsの計算基盤となる原データ

#### searchTermAtom
```typescript
export const searchTermAtom = atom<string>('');
```
**責務**: 検索文字列の管理
- ユーザー入力の検索キーワード保持
- filteredDataAtomのトリガー
- 検索状態のクリア管理

#### filteredDataAtom
```typescript
export const filteredDataAtom = atom<TreeNode[]>((get) => {
  const data = get(tableDataAtom);
  const searchTerm = get(searchTermAtom);
  
  if (!searchTerm) return data;
  
  return data.filter(node => 
    node.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
});
```
**責務**: 検索条件に基づくフィルタリング済みデータ
- searchTermAtomと連動した派生状態
- 表示用データの提供
- リアクティブな検索結果の更新

#### 派生データatoms
```typescript
export const totalCountAtom = atom<number>((get) => 
  get(tableDataAtom).length
);

export const filteredCountAtom = atom<number>((get) => 
  get(filteredDataAtom).length
);

export const isEmptyAtom = atom<boolean>((get) => 
  get(filteredDataAtom).length === 0
);
```
**責務**: データ統計情報の提供

### 2. UI State Atoms（UI状態）
**ファイル**: `state/config/ui.atoms.ts`

#### isLoadingAtom
```typescript
export const isLoadingAtom = atom<boolean>(false);
```
**責務**: ローディング状態の管理
- データ取得中のフラグ
- スピナー表示制御
- ユーザー操作の無効化制御

#### errorAtom
```typescript
export const errorAtom = atom<string | null>(null);
```
**責務**: エラー状態の管理
- API通信エラーの保持
- エラーメッセージの表示制御
- エラーリカバリーのトリガー

### 3. Table State Atoms（テーブル状態）
**ファイル**: `state/core/table.atoms.ts`

#### sortingAtom
```typescript
export const sortingAtom = atom<SortingState>([]);
```
**責務**: ソート状態の管理
- カラムごとのソート方向
- 複数カラムソートの順序
- ソートロジックの適用

#### columnSizingAtom
```typescript
export const columnSizingAtom = atom<ColumnSizingState>({});
```
**責務**: カラムサイズの管理
- 各カラムの幅設定
- リサイズ状態の保持
- レスポンシブ対応

### 4. Selection Feature Atoms（選択機能）
**ファイル**: `state/features/selection.atoms.ts`

#### rowSelectionAtom
```typescript
export const rowSelectionAtom = atom<RowSelectionState>({});
```
**責務**: 行選択状態の管理
- 選択されたノードIDのマップ
- 複数選択時の状態保持
- 選択カウンターの計算基盤

#### selectionModeAtom & rowClickActionAtom
```typescript
export type SelectionMode = 'none' | 'single' | 'multiple';
export const selectionModeAtom = atom<SelectionMode>('single');

export type RowClickAction = 'select' | 'edit' | 'navigate';
export const rowClickActionAtom = atom<RowClickAction>('select');
```
**責務**: 選択動作の制御

#### 選択関連の派生atom
```typescript
export const selectedNodeIdsAtom = atom<string[]>((get) => {
  const selection = get(rowSelectionAtom);
  return Object.keys(selection).filter((id) => selection[id]);
});

export const selectedCountAtom = atom<number>((get) => 
  get(selectedNodeIdsAtom).length
);
```

### 5. Expansion Feature Atoms（展開機能）
**ファイル**: `state/features/expansion.atoms.ts`

#### expandedAtom
```typescript
export const expandedAtom = atom<ExpandedState>({});
```
**責務**: ツリー展開状態の管理
- 展開されたノードIDのマップ
- 階層表示の制御
- 永続化対象の状態

#### 展開アクションatom
```typescript
export const toggleExpandedAtom = atom(null, (get, set, nodeId: string) => {
  const expanded = get(expandedAtom);
  const newExpanded = { ...expanded };
  
  if (newExpanded[nodeId]) {
    delete newExpanded[nodeId];
  } else {
    newExpanded[nodeId] = true;
  }
  
  set(expandedAtom, newExpanded);
});
```

### 6. Drag & Drop Feature Atoms（ドラッグ&ドロップ機能）
**ファイル**: `state/features/dragDrop.atoms.ts`

#### draggingNodeIdAtom
```typescript
export const draggingNodeIdAtom = atom<string | null>(null);
```
**責務**: ドラッグ中のノード識別
- 現在ドラッグ中のノードID
- ドラッグオーバーレイの表示制御
- ドラッグ状態の管理

#### dropTargetNodeIdAtom
```typescript
export const dropTargetNodeIdAtom = atom<string | null>(null);
```
**責務**: ドロップターゲットの管理
- ホバー中のドロップ先ノードID
- ドロップ可能性の視覚的フィードバック
- ドロップ位置の計算

#### forbiddenDropTargetsAtom
```typescript
export const forbiddenDropTargetsAtom = atom<Set<string>>(new Set());
```
**責務**: ドロップ禁止ノードの管理
- 循環参照を防ぐためのバリデーション
- 自分自身や子孫へのドロップ防止
- ドロップ可能性の事前判定

### 7. Editing Feature Atoms（編集機能）
**ファイル**: `state/features/editing.atoms.ts`

#### editingNodeIdAtom & editingValueAtom
```typescript
export const editingNodeIdAtom = atom<string | null>(null);
export const editingValueAtom = atom<string>('');
```
**責務**: インライン編集の管理
- 編集中のノード識別
- 編集中の値の保持
- 編集モードの制御

### 8. Subscription Feature Atoms（購読機能）
**ファイル**: `state/features/subscription.atoms.ts`

#### 購読管理atoms
```typescript
export const subscribedRootNodeIdAtom = atom<string | null>(null);
export const subscriptionIdAtom = atom<string | null>(null);
export const subscriptionDepthAtom = atom<number>(2);
export const lastUpdateTimestampAtom = atom<number>(0);
export const pendingUpdatesAtom = atom<any[]>([]);
```
**責務**: SubTree購読の管理
- 購読セッションの識別
- 更新のバッチング
- リアルタイム同期

### 9. View Configuration Atoms（ビュー設定）
**ファイル**: `state/config/view.atoms.ts`

#### ビュー設定atoms
```typescript
export const viewHeightAtom = atom<number>(400);
export const viewWidthAtom = atom<number>(800);
export const useTrashColumnsAtom = atom<boolean>(false);
export const depthOffsetAtom = atom<number>(0);
```
**責務**: 表示設定の管理
- ビューポートサイズ
- カラム表示設定
- 深度表示オフセット

## Action Atoms（アクションアトム）

### 選択アクションatoms
**ファイル**: `state/features/selection.atoms.ts`

```typescript
export const clearSelectionAtom = atom(null, (_get, set) => {
  set(rowSelectionAtom, {});
});

export const selectAllAtom = atom(null, (get, set) => {
  const data = get(filteredDataAtom);
  const newSelection: RowSelectionState = {};
  data.forEach((item) => {
    if (item.id) {
      newSelection[item.id] = true;
    }
  });
  set(rowSelectionAtom, newSelection);
});
```

### 展開アクションatoms
**ファイル**: `state/features/expansion.atoms.ts`

```typescript
export const toggleExpandedAtom = atom(null, (get, set, nodeId: string) => {
  const expanded = get(expandedAtom);
  const newExpanded = { ...expanded };
  
  if (newExpanded[nodeId]) {
    delete newExpanded[nodeId];
  } else {
    newExpanded[nodeId] = true;
  }
  
  set(expandedAtom, newExpanded);
});

export const toggleAllExpandedAtom = atom(null, (get, set) => {
  const data = get(tableDataAtom);
  const expanded = get(expandedAtom);
  const hasExpanded = Object.keys(expanded).length > 0;
  
  if (hasExpanded) {
    set(expandedAtom, {});
  } else {
    const newExpanded: ExpandedState = {};
    data.forEach((item) => {
      if (item.id && item.hasChildren) {
        newExpanded[item.id] = true;
      }
    });
    set(expandedAtom, newExpanded);
  }
});
```

## インポート戦略

### 統合インポート（推奨）
```typescript
// すべてのatomsを一箇所からインポート
import {
  tableDataAtom,
  searchTermAtom,
  rowSelectionAtom,
  expandedAtom,
  draggingNodeIdAtom,
  clearSelectionAtom,
  toggleExpandedAtom
} from '~/containers/TreeTable/state';
```

### 機能別インポート（部分的使用時）
```typescript
// 特定機能のatomsのみインポート
import {
  rowSelectionAtom,
  selectedNodeIdsAtom,
  clearSelectionAtom
} from '~/containers/TreeTable/state/features/selection.atoms';
```

## Atomsの連携パターン

### 1. 派生状態パターン
```typescript
// 選択されたノード数を計算
export const selectedCountAtom = atom((get) => {
  const selection = get(rowSelectionAtom);
  return Object.keys(selection).length;
});

// 選択可能なアクションを計算
export const availableActionsAtom = atom((get) => {
  const count = get(selectedCountAtom);
  const mode = get(selectionModeAtom);
  
  return {
    delete: count > 0,
    copy: count === 1,
    paste: count === 1 && mode === 'single'
  };
});
```

### 2. 非同期処理パターン
```typescript
export const loadSubTreeAtom = atom(
  null,
  async (get, set, { nodeId, depth }) => {
    set(isLoadingAtom, true);
    set(errorAtom, null);
    
    try {
      const controller = get(controllerAtom);
      const data = await controller.getSubTree(nodeId, depth);
      set(tableDataAtom, data);
    } catch (error) {
      set(errorAtom, error);
    } finally {
      set(isLoadingAtom, false);
    }
  }
);
```

### 3. 購読管理パターン
```typescript
export const subscribeToSubTreeAtom = atom(
  null,
  (get, set, { rootNodeId, depth, onUpdate }) => {
    const controller = get(controllerAtom);
    
    // 既存の購読を解除
    const oldId = get(subscriptionIdAtom);
    if (oldId) {
      controller.unsubscribeFromSubTree(oldId);
    }
    
    // 新規購読
    const newId = controller.subscribeToSubTree({
      rootNodeId,
      depth,
      onUpdate: (changes) => {
        set(applySubTreeChangesAtom, changes);
        onUpdate?.(changes);
      }
    });
    
    set(subscriptionIdAtom, newId);
    set(subTreeAtom, { rootNodeId, depth, nodes: new Map() });
  }
);
```

## パフォーマンス最適化

### 1. Atom分割の原則
- 頻繁に更新される状態は独立したAtomに
- 大きなデータは必要最小限のAtomに分割
- 派生状態は計算Atomで実装

### 2. メモ化戦略
```typescript
// 重い計算は選択的に実行
export const expensiveComputationAtom = atom((get) => {
  const data = get(filteredDataAtom);
  const expanded = get(expandedAtom);
  
  // useMemoと同等の効果
  return computeVisibleNodes(data, expanded);
});
```

### 3. バッチ更新
```typescript
export const batchUpdateAtom = atom(
  null,
  (_get, set, updates: BatchUpdates) => {
    // Jotaiは自動的にバッチ処理
    updates.forEach(({ atom, value }) => {
      set(atom, value);
    });
    // 1回の再レンダリングで全更新が反映
  }
);
```

## テスト戦略

### Atomのユニットテスト
```typescript
describe('rowSelectionAtom', () => {
  it('should handle single selection', () => {
    const { result } = renderHook(() => useAtom(rowSelectionAtom));
    
    act(() => {
      result.current[1]({ node1: true });
    });
    
    expect(result.current[0]).toEqual({ node1: true });
  });
});
```

### 統合テスト
```typescript
describe('SubTree Subscription', () => {
  it('should apply changes from worker', async () => {
    const { result } = renderHook(() => {
      const [data] = useAtom(tableDataAtom);
      const [, applyChanges] = useAtom(applySubTreeChangesAtom);
      return { data, applyChanges };
    });
    
    const changes: SubTreeChanges = {
      added: [{ id: 'new1', name: 'New Node' }],
      timestamp: Date.now()
    };
    
    act(() => {
      result.current.applyChanges(changes);
    });
    
    expect(result.current.data).toContainEqual(
      expect.objectContaining({ id: 'new1' })
    );
  });
});
```

## まとめ

Jotai Atomsによる状態管理は、TreeConsoleの複雑な状態を効率的に管理し、Workerとの連携を実現する重要な基盤です。各Atomは単一責任の原則に従い、明確な役割を持ち、テスタブルで保守性の高い実装を実現しています。