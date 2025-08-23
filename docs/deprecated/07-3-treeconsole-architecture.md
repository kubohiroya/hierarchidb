# 7.3 TreeConsole新アーキテクチャ設計書

## 概要

TreeConsoleパッケージ（`@hierarchidb/ui-treeconsole`）の移植において、元のコードベースが抱える技術的負債を解消しながら、クリーンなアーキテクチャで再実装する設計を行います。

## 設計原則

### 1. 責務の分離
- **Presentation層**: 表示のみの責務を持つPure Components
- **State層**: Jotaiによる中央集権的な状態管理
- **Orchestration層**: ユーザーストーリーに基づく状態遷移管理
- **Service層**: Worker APIとの通信

### 2. 技術的負債の解消
- 元のTreeTableCoreの複雑な依存関係を整理
- 状態管理とビューロジックの混在を分離
- テスタビリティの向上

### 3. 段階的移植
- Phase 1: 基本的なテーブル表示
- Phase 2: データ取得とバインディング
- Phase 3: 展開/折りたたみ機能
- Phase 4: 選択機能
- Phase 5: ドラッグ&ドロップ
- Phase 6: 仮想スクロール

## デザインパターン

### 1. ファサードパターン (Facade Pattern)

#### WorkerAPI層での適用

WorkerAPIは、複雑な内部サービスを統一されたインターフェースで提供するファサードとして機能します：

```typescript
// packages/api/src/WorkerAPI.ts
export interface WorkerAPI extends 
  TreeObservableService,  // 購読・監視機能（約70行）
  TreeMutationService,     // 変更操作（約70行）
  TreeQueryService {       // 読み取り操作（約40行）
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}
```

**利点**：
- 各サービスが独立して開発・テスト可能
- インターフェース分離の原則（ISP）を遵守
- ファイル行数を100行以下に抑制

#### TreeTableOrchestrator層での適用（リファクタリング後）

オーケストレーター層も同様にファサードパターンを適用し、ユーザーストーリー単位で分割：

```typescript
// packages/ui-treeconsole/src/containers/TreeTable/orchestrator/openstreetmap-type.ts
export class TreeTableOrchestrator {
  private selectionOrchestrator: SelectionOrchestrator;
  private expansionOrchestrator: ExpansionOrchestrator;
  private editingOrchestrator: EditingOrchestrator;
  private dragDropOrchestrator: DragDropOrchestrator;
  private searchOrchestrator: SearchOrchestrator;
  private subscriptionOrchestrator: SubscriptionOrchestrator;
  
  // ファサードメソッド
  handleSelectNode(nodeId: string) {
    return this.selectionOrchestrator.selectNode(nodeId);
  }
  
  handleToggleExpanded(nodeId: string) {
    return this.expansionOrchestrator.toggleNode(nodeId);
  }
}
```

### 2. アダプターパターン (Adapter Pattern)

#### WorkerAPIAdapter層での適用

新しいObservable APIを既存のコールバックベースのコードで使用可能にするアダプター：

```typescript
// packages/ui-treeconsole/src/adapters/WorkerAPIAdapter.ts
export class WorkerAPIAdapter {
  // 責務別アダプター
  private mutationAdapter: TreeMutationCommandsAdapter;
  private workingCopyAdapter: WorkingCopyCommandsAdapter;  
  private subscriptionManager: SubscriptionManager;
  
  // Legacy API → Modern API 変換
  async subscribeToSubtree(
    nodeId: TreeNodeId,
    expandedCallback: LegacyCallback,
    changesCallback: LegacyCallback
  ): Promise<LegacyUnsubscribe> {
    // Observable → Callback 変換
    const subscription = await this.subscriptionManager
      .createObservableSubscription(nodeId)
      .subscribe({
        next: (event) => {
          if (event.type === 'expanded-changed') {
            expandedCallback(this.transformToLegacy(event));
          } else if (event.type === 'subtree-changed') {
            changesCallback(this.transformToLegacy(event));
          }
        }
      });
      
    return () => subscription.unsubscribe();
  }
}
```

**アダプター構造**：
```
WorkerAPIAdapter (ファサード, 約300行)
├── TreeMutationCommandsAdapter (物理操作変換, 約150行)
├── WorkingCopyCommandsAdapter (編集操作変換, 約120行)
├── SubscriptionManager (購読管理, 約180行)
└── TreeObservableAdapter (Observable変換, 約100行)
```

### 3. オブザーバーパターン (Observer Pattern)

#### SubTree購読での適用

Workerからのリアルタイム更新を受信する購読メカニズム：

```typescript
// Orchestrator層でのSubTree購読
class SubscriptionOrchestrator {
  private subscriptions = new Map<string, Subscription>();
  
  async subscribeToSubTree(
    rootNodeId: string,
    depth: number,
    onUpdate: (changes: SubTreeChanges) => void
  ) {
    // Workerからの更新を購読
    const observable = await this.workerAPI.observeSubtree({
      payload: { rootNodeId, depth }
    });
    
    const subscription = observable
      .pipe(
        // バッチング: 100ms以内の更新をまとめる
        bufferTime(100),
        filter(batch => batch.length > 0),
        map(batch => this.mergeChanges(batch))
      )
      .subscribe(merged => onUpdate(merged));
      
    this.subscriptions.set(rootNodeId, subscription);
  }
}
```

## アーキテクチャ構成

```
┌─────────────────────────────────────────────────────┐
│                  Application Layer                   │
│                TreeTableConsolePanel                 │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│                 Orchestration Layer                  │
│               TreeTableOrchestrator                  │
│         (User Story & State Transitions)             │
│            + SubTree Subscription Manager            │
└─────────────────────────────────────────────────────┘
                     ↓              ↑
                     ↓              ↑ Real-time Updates
┌─────────────────────────────────────────────────────┐
│                    State Layer                       │
│                  Jotai Atoms Store                   │
├─────────────────────────────────────────────────────┤
│ Core Data:           │ UI State:                    │
│ • tableDataAtom      │ • isLoadingAtom              │
│ • filteredDataAtom   │ • errorAtom                  │
│ • searchTermAtom     │ • selectionModeAtom          │
│ • subTreeAtom        │ • subscriptionIdAtom         │
├─────────────────────────────────────────────────────┤
│ Table State:         │ D&D State:                   │
│ • rowSelectionAtom   │ • draggingNodeIdAtom         │
│ • expandedAtom       │ • dropTargetNodeIdAtom       │
│ • sortingAtom        │ • forbiddenDropTargetsAtom   │
│ • columnSizingAtom   │                              │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│                 Presentation Layer                   │
│              Pure View Components                    │
├─────────────────────────────────────────────────────┤
│ • TreeTableView      │ • TreeTableRow               │
│ • TreeTableHeader    │ • TreeTableCell              │
│ • TreeTableBody      │ • TreeTableDragOverlay       │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│                   Service Layer                      │
│              WorkerAPIAdapter                        │
│          (Observable to Callback)                    │
│         + SubTree Subscribe/Unsubscribe             │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│                   Worker Thread                      │
│            TreeObservableService                     │
│         (Publishes SubTree Changes)                  │
└─────────────────────────────────────────────────────┘
```

## コンポーネント設計

### Presentation Components（表示層）

#### TreeTableView
```typescript
interface TreeTableViewProps {
  // Data
  data: TreeNode[];
  columns: ColumnDef<TreeNode>[];
  
  // State (読み取り専用)
  rowSelection: RowSelectionState;
  expanded: ExpandedState;
  sorting: SortingState;
  
  // Callbacks (イベント通知のみ)
  onRowClick?: (nodeId: string) => void;
  onExpandedChange?: (nodeId: string) => void;
  onSortingChange?: (columnId: string, direction: 'asc' | 'desc') => void;
}
```

**責務:**
- データの表示
- ユーザーイベントの通知
- スタイリング

**禁止事項:**
- 状態の管理
- ビジネスロジック
- API呼び出し

### State Management（状態管理層）

#### Atoms設計とファイル構造

状態管理の複雑性に対応するため、ハイブリッドアプローチを採用して284行の単一ファイルを機能別に分割：

```
state/
├── openstreetmap-type.ts                    # 統合エクスポート（約50行）
├── core/                       # コアデータ層
│   ├── data.atoms.ts          # テーブルデータ、フィルタリング（50行）
│   └── table.atoms.ts         # TanStack Table状態（20行）
├── features/                   # 機能別atom群
│   ├── selection.atoms.ts     # 選択機能とアクション（60行）
│   ├── expansion.atoms.ts     # 展開機能とアクション（45行）
│   ├── editing.atoms.ts       # インライン編集（15行）
│   ├── dragDrop.atoms.ts      # D&D状態管理（20行）
│   └── subscription.atoms.ts  # SubTree購読（25行）
└── config/                     # 設定層
    ├── view.atoms.ts          # ビュー設定（20行）
    └── ui.atoms.ts            # UI状態（15行）
```

**分割の利点:**
1. **ファイルサイズ最適化**: 最大60行で可読性向上（元284行から78%削減）
2. **機能的凝集性**: 関連atomsが同一ファイル
3. **明確な依存関係**: core → features → config の階層
4. **並行開発**: チームメンバーが独立して作業可能
5. **テスタビリティ**: 機能単位でのテストが容易

#### Atoms使用例
```typescript
// 統合インポート（推奨）
import {
  tableDataAtom,
  rowSelectionAtom,
  expandedAtom,
  clearSelectionAtom,
  toggleExpandedAtom
} from '~/containers/TreeTable/state';

// 機能別インポート（部分使用時）
import {
  rowSelectionAtom,
  selectedNodeIdsAtom,
  clearSelectionAtom
} from '~/containers/TreeTable/state/features/selection.atoms';
```

**特徴:**
- 単一責任の原則に従った小さなatom
- 派生状態は計算atomで実装
- アクションatomで状態更新ロジックをカプセル化

### Orchestration（オーケストレーション層）

#### TreeTableOrchestrator
```typescript
export function useTreeTableOrchestrator(
  controller: TreeViewController | null
): TreeTableOrchestratorResult {
  // SubTree Subscription管理
  useEffect(() => {
    if (!controller) return;
    
    // SubTreeの購読開始
    const subscriptionId = controller.subscribeToSubTree({
      rootNodeId: currentNodeId,
      depth: 2, // 2階層まで購読
      onUpdate: (changes: SubTreeChanges) => {
        // Workerからの更新通知を受信
        handleSubTreeUpdate(changes);
      }
    });
    
    // クリーンアップ
    return () => {
      controller.unsubscribeFromSubTree(subscriptionId);
    };
  }, [controller, currentNodeId]);
  
  // SubTree更新ハンドラー
  const handleSubTreeUpdate = useCallback((changes: SubTreeChanges) => {
    // 1. 追加されたノードの処理
    if (changes.added) {
      addNodesToTree(changes.added);
    }
    
    // 2. 更新されたノードの処理
    if (changes.updated) {
      updateNodesInTree(changes.updated);
    }
    
    // 3. 削除されたノードの処理
    if (changes.removed) {
      removeNodesFromTree(changes.removed);
    }
    
    // 4. 移動されたノードの処理
    if (changes.moved) {
      moveNodesInTree(changes.moved);
    }
  }, [...]);
  
  // User Story: ノード選択
  const handleSelectNode = useCallback((nodeId: string) => {
    // 1. 状態の更新
    // 2. Controllerへの通知
    // 3. 副作用の処理
  }, [...]);
}
```

**責務:**
- ユーザーストーリーの実装
- 状態遷移の管理
- SubTree購読管理
- Workerからの更新反映
- 副作用の処理
- Controllerとの同期

## SubTree Subscription システム

### 概要
SubTree Subscriptionは、Workerスレッドで発生したツリーデータの変更をリアルタイムでUIに反映させる仕組みです。

### データフロー
```
Worker Thread                     Main Thread (UI)
     │                                  │
     ├─ TreeObservableService          │
     │   ├─ detectChanges()            │
     │   └─ publishUpdates() ──────────┤
     │                                  │
     │                            WorkerAPIAdapter
     │                                  │
     │                            TreeTableOrchestrator
     │                                  ├─ subscribeToSubTree()
     │                                  ├─ handleSubTreeUpdate()
     │                                  └─ updateAtoms()
     │                                  │
     │                            Jotai Atoms Store
     │                                  │
     │                            TreeTableView (Re-render)
```

### SubTreeChanges インターフェース
```typescript
interface SubTreeChanges {
  // 追加されたノード
  added?: TreeNode[];
  
  // 更新されたノード
  updated?: Array<{
    nodeId: string;
    changes: Partial<TreeNode>;
  }>;
  
  // 削除されたノード
  removed?: string[];
  
  // 移動されたノード
  moved?: Array<{
    nodeId: string;
    oldParentId: string;
    newParentId: string;
    oldIndex: number;
    newIndex: number;
  }>;
  
  // 変更のタイムスタンプ
  timestamp: number;
}
```

### 購読ライフサイクル
1. **購読開始**
   - コンポーネントマウント時にsubscribeToSubTree()を呼び出し
   - rootNodeIdとdepthを指定して購読範囲を設定
   - subscriptionIdを取得して管理

2. **更新受信**
   - Worker側で変更が検出されるとpublishUpdates()が実行
   - RxJS/Comlinkを通じてUIスレッドに通知
   - handleSubTreeUpdate()で変更を処理

3. **状態更新**
   - 変更の種類に応じてJotai Atomsを更新
   - React再レンダリングがトリガーされる
   - UIに変更が反映される

4. **購読解除**
   - コンポーネントアンマウント時にunsubscribeFromSubTree()
   - メモリリークを防ぐためのクリーンアップ

### 最適化戦略
- **バッチング**: 複数の変更を一括で処理
- **デバウンス**: 高頻度の更新を間引く
- **選択的購読**: 必要な深さまでのみ購読
- **差分更新**: 変更があった部分のみ更新

## ユーザーストーリー

### 1. ノード選択
```
Given: ユーザーがテーブルの行を見ている
When: 行をクリックする
Then: 
  - 行が選択状態になる
  - 選択カウンターが更新される
  - ツールバーのアクションが有効化される
```

### 2. ノード展開
```
Given: 子ノードを持つ親ノードがある
When: 展開アイコンをクリックする
Then:
  - 子ノードが表示される
  - 展開状態が保持される
  - 必要に応じて子ノードをロードする
```

### 3. ドラッグ&ドロップ
```
Given: 移動可能なノードが選択されている
When: ノードをドラッグして別のノードにドロップする
Then:
  - 確認ダイアログが表示される
  - 移動が実行される
  - ツリー構造が更新される
```

### 4. リアルタイム同期（SubTree Subscription）
```
Given: ユーザーが特定のサブツリーを表示している
When: 他のユーザーまたはシステムがそのサブツリー内のノードを変更する
Then:
  - Workerから変更通知が送信される
  - UIが自動的に更新される
  - 選択状態や展開状態は維持される
```

## リファクタリング実装結果

### TreeTableOrchestrator分割実装

元の430行の単一ファイルを、ユーザーストーリー単位で6つのファイルに分割：

```
packages/ui-treeconsole/src/components/TreeTable/orchestrator/
├── openstreetmap-type.ts                    (約100行 - ファサード)
├── SelectionOrchestrator.ts     (約120行 - 選択操作)
├── ExpansionOrchestrator.ts     (約100行 - 展開操作)
├── EditingOrchestrator.ts       (約90行 - 編集操作)
├── DragDropOrchestrator.ts      (約150行 - D&D操作)
├── SearchOrchestrator.ts        (約90行 - 検索操作)
├── SubscriptionOrchestrator.ts  (約180行 - 購読管理)
└── TreeTableOrchestrator.ts     (旧実装 - 互換性維持)
```

**利点**：
- 各ファイル100行前後で管理しやすい
- ユーザーストーリー単位でテスト可能
- 並行開発が容易
- 責務が明確で理解しやすい

### 使用例

```typescript
// コンポーネントでの使用
const orchestrator = useTreeTableOrchestrator(controller, workerAPI);

// 個別機能へのアクセス（推奨）
orchestrator.selection.selectNode(nodeId);
orchestrator.expansion.toggleNode(nodeId);
orchestrator.editing.startEdit(nodeId, value);
orchestrator.dragDrop.startDrag(nodeId);
orchestrator.search.searchWithDebounce(term);
orchestrator.subscription.subscribe(rootNodeId);

// よく使う機能のショートカット
const { selectedNodeIds, isLoading, error } = orchestrator;
```

### ファイル行数の最適化結果

| レイヤー | 変更前 | 変更後 | 削減率 |
|---------|--------|--------|--------|
| WorkerAPI | 単一ファイル | 3ファイル×70行 | - |
| WorkerAPIAdapter | 単一ファイル | 4ファイル×150行 | - |
| TreeTableOrchestrator | 430行 | 6ファイル×100行 | 77% |

## 移植戦略

### Phase 1: 基本実装（完了）
- [x] Jotai導入
- [x] Atoms定義
- [x] Orchestrator基本実装
- [x] TreeTableView骨格

### Phase 2: データバインディング（進行中）
- [ ] Controllerとの同期
- [ ] データ取得・表示
- [ ] カラム定義

### Phase 3: インタラクション
- [ ] 選択機能
- [ ] 展開/折りたたみ
- [ ] ソート

### Phase 4: 高度な機能
- [ ] ドラッグ&ドロップ
- [ ] インライン編集
- [ ] コンテキストメニュー

### Phase 5: パフォーマンス最適化
- [ ] 仮想スクロール（TanStack Virtual）
- [ ] メモ化最適化
- [ ] レンダリング最適化

### Phase 6: 統合テスト
- [ ] E2Eテスト
- [ ] パフォーマンステスト
- [ ] アクセシビリティテスト

## 技術スタック

- **State Management**: Jotai 2.x
- **Table**: TanStack Table v8
- **Virtual Scrolling**: TanStack Virtual v3
- **Drag & Drop**: @dnd-kit
- **UI Components**: Material-UI v5
- **Styling**: @emotion/styled

## パフォーマンス考慮事項

### レンダリング最適化
- React.memoによるコンポーネントメモ化
- useCallbackによるコールバック安定化
- 仮想スクロールによる大量データ対応

### 状態管理最適化
- Atomの適切な粒度設計
- 派生状態の計算最適化
- 不要な再レンダリング防止

## テスト戦略

### Unit Tests
- Atoms: 状態更新ロジック
- Orchestrator: ユーザーストーリー
- Components: 表示ロジック

### Integration Tests
- Controller統合
- Worker API統合
- ユーザーフロー

### E2E Tests
- 実際のユーザー操作シナリオ
- パフォーマンス計測
- アクセシビリティ検証

## 今後の拡張性

### プラグインアーキテクチャ
- カスタムセルレンダラー
- カスタムアクション
- カスタムバリデーション

### 国際化対応
- メッセージの外部化
- 日付・数値フォーマット
- RTL対応

### アクセシビリティ
- キーボードナビゲーション
- スクリーンリーダー対応
- フォーカス管理

## パッケージ分割計画（2025年1月実施予定）

`ui-treeconsole`パッケージの肥大化に対応するため、責務ごとに複数パッケージへの分割を計画しています：

### 分割後のパッケージ構成

| パッケージ名 | 責務 | 主要コンポーネント |
|------------|------|------------------|
| `ui-treeconsole-breadcrumb` | パンくずリスト | TreeConsoleBreadcrumb |
| `ui-treeconsole-toolbar` | ツールバー | TreeConsoleToolbar, TreeConsoleActions |
| `ui-treeconsole-footer` | フッター | TreeConsoleFooter |
| `ui-treeconsole-treetable` | メインテーブル | TreeTableView, TreeTableCore |
| `ui-treeconsole-trashbin` | ゴミ箱UI | TrashBinColumns, TrashBinActions |
| `ui-treeconsole-speeddial` | スピードダイアル | TreeConsoleSpeedDialDeprecated |
| `ui-treeconsole` | 統合オーケストレーター | TreeTableConsolePanel, Orchestrators, Adapters |

### 分割の利点
- **保守性向上**: 各パッケージが小さく理解しやすい
- **再利用性**: 他プロジェクトでも個別UIコンポーネントを利用可能
- **並行開発**: チームメンバーが独立して作業可能
- **テストの簡素化**: 小さなパッケージは単体テストが書きやすい

詳細は[7.4 TreeConsoleパッケージ分割設計書](./07-4-treeconsole-package-split.md)を参照してください。