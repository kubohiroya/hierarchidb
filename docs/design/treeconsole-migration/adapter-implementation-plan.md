# APIアダプター実装計画

## 概要

問題が起こりがちなAPI変換コードを`adapters/`ディレクトリに集約し、新旧APIの差異を段階的に解決する。

## 🟡 アダプター構造（問題集約型）

```
src/adapters/
├── WorkerAPIAdapter.ts           # メインアダプタークラス
├── commands/                     # コマンド変換
│   ├── TreeMutationCommands.ts  # CRUD系コマンド変換
│   ├── WorkingCopyCommands.ts   # WorkingCopy系コマンド変換
│   └── HistoryCommands.ts       # Undo/Redo系コマンド変換
├── subscriptions/               # サブスクリプション変換
│   ├── TreeObservableAdapter.ts # Observable → Callback変換
│   └── SubscriptionManager.ts   # サブスクリプション管理
├── types.ts                     # アダプター専用型定義
└── utils.ts                     # CommandEnvelope生成等ヘルパー
```

## 段階的実装アプローチ

### Phase 1: 基本構造とユーティリティ

#### 1.1 CommandEnvelope生成ヘルパー

```typescript
// adapters/utils.ts
export function createCommand<K extends string, P>(
  kind: K,
  payload: P,
  options?: {
    groupId?: string;
    sourceViewId?: string;
    onNameConflict?: OnNameConflict;
  }
): CommandEnvelope<K, P> {
  return {
    commandId: generateUUID(),
    groupId: options?.groupId || generateUUID(),
    kind,
    payload,
    issuedAt: Date.now(),
    sourceViewId: options?.sourceViewId,
    onNameConflict: options?.onNameConflict || 'auto-rename'
  };
}
```

#### 1.2 アダプター専用型定義

```typescript
// adapters/types.ts
export type LegacyCallback<T> = (data: T) => void;
export type LegacySubscription = () => void;

export interface AdapterContext {
  viewId: string;
  groupId: string;
  onNameConflict: OnNameConflict;
}

export interface CommandAdapterOptions {
  context: AdapterContext;
  retryConfig?: RetryConfig;
}
```

### Phase 2: サブスクリプション変換（最重要）

#### 2.1 Observable → Callback変換

**要確認ポイント**:
- 古いコード: `subscribeSubTree(nodeId, expandedCallback, subtreeCallback)`
- 新しいコード: `observeSubtree(CommandEnvelope) → Observable<TreeChangeEvent>`

```typescript
// adapters/subscriptions/TreeObservableAdapter.ts
export class TreeObservableAdapter {
  private subscriptions = new Map<string, () => void>();

  async subscribeToSubtree(
    nodeId: TreeNodeId,
    expandedChangesCallback: (changes: ExpandedStateChanges) => void,
    subtreeChangesCallback: (changes: SubTreeChanges) => void,
    context: AdapterContext
  ): Promise<() => void> {
    // 🟡 要確認: TreeChangeEvent → ExpandedStateChanges/SubTreeChanges変換
    const command = createCommand('observeSubtree', {
      rootNodeId: nodeId,
      includeInitialSnapshot: true,
      maxDepth: undefined // 🟡 要確認: 既存コードでの深度制限
    }, { groupId: context.groupId });

    const observable = await this.api.observeSubtree(command);
    
    // 🟡 要確認: イベント変換ロジック
    const subscription = observable.subscribe((event: TreeChangeEvent) => {
      this.convertAndDispatch(event, expandedChangesCallback, subtreeChangesCallback);
    });

    const unsubscribe = () => {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    };

    const subscriptionId = generateUUID();
    this.subscriptions.set(subscriptionId, unsubscribe);
    
    return unsubscribe;
  }

  // 🟡 要確認: TreeChangeEvent → 旧形式変換の詳細
  private convertAndDispatch(
    event: TreeChangeEvent,
    expandedCallback: LegacyCallback<ExpandedStateChanges>,
    subtreeCallback: LegacyCallback<SubTreeChanges>
  ) {
    // TODO: 実装時に既存データ構造を確認して変換ロジックを作成
  }
}
```

### Phase 3: CRUD コマンド変換

#### 3.1 ノード移動コマンド

**要確認ポイント**:
- 古いコード: `moveNodes(nodeIds: string[], targetId: string)`  
- 新しいコード: `moveNodes(CommandEnvelope<'moveNodes', MoveNodesPayload>)`

```typescript
// adapters/commands/TreeMutationCommands.ts
export class TreeMutationCommandsAdapter {
  async moveNodes(
    nodeIds: TreeNodeId[],
    targetParentId: TreeNodeId,
    options: CommandAdapterOptions
  ): Promise<void> {
    // 🟡 要確認: onNameConflict の既定値
    const command = createCommand('moveNodes', {
      nodeIds,
      toParentId: targetParentId,
      onNameConflict: options.context.onNameConflict
    }, { 
      groupId: options.context.groupId,
      sourceViewId: options.context.viewId 
    });

    const result = await this.api.moveNodes(command);
    
    // 🟡 要確認: エラーハンドリングと戻り値の処理
    if (!result.success) {
      throw new TreeConsoleError(result.code, result.error);
    }
  }

  // 🟡 要確認: 既存コードでの削除処理パターン
  async deleteNodes(
    nodeIds: TreeNodeId[],
    options: CommandAdapterOptions
  ): Promise<void> {
    // ソフトデリート（ゴミ箱移動）か完全削除かを判定
    // TODO: 既存実装を確認して適切なコマンドを選択
  }
}
```

### Phase 4: Working Copy パターン適合

**要確認ポイント**:
- 古いコード: カスタムWorking Copy管理
- 新しいコード: `createWorkingCopy` → `commitWorkingCopy` フロー

```typescript
// adapters/commands/WorkingCopyCommands.ts
export class WorkingCopyCommandsAdapter {
  // 🟡 要確認: 既存の編集開始パターン
  async startNodeEdit(
    nodeId: TreeNodeId,
    context: AdapterContext
  ): Promise<{ workingCopyId: UUID; currentData: TreeNode }> {
    const workingCopyId = generateUUID();
    
    const command = createCommand('createWorkingCopy', {
      workingCopyId,
      sourceTreeNodeId: nodeId
    }, { groupId: context.groupId });

    await this.api.createWorkingCopy(command);
    
    // 🟡 要確認: 既存コードでの初期データ取得方法
    const currentData = await this.getCurrentNodeData(nodeId);
    
    return { workingCopyId, currentData };
  }

  // 🟡 要確認: 保存時のバリデーションパターン
  async commitNodeEdit(
    workingCopyId: UUID,
    expectedUpdatedAt: Timestamp,
    context: AdapterContext
  ): Promise<void> {
    const command = createCommand('commitWorkingCopy', {
      workingCopyId,
      expectedUpdatedAt,
      onNameConflict: context.onNameConflict
    }, { groupId: context.groupId });

    const result = await this.api.commitWorkingCopy(command);
    
    if (!result.success) {
      throw new TreeConsoleError(result.code, result.error);
    }
  }
}
```

## 実装時の確認プロセス

### 各メソッドごとの確認手順

1. **既存呼び出しパターンの特定**
   ```typescript
   // 既存コード例
   const result = await service.moveNodes(['node1', 'node2'], 'targetParent');
   ```

2. **新API要求形式の確認**
   ```typescript
   // 新API例
   const command = createCommand('moveNodes', { nodeIds, toParentId });
   const result = await api.moveNodes(command);
   ```

3. **アダプターメソッドの実装**
   ```typescript
   // アダプター実装
   async moveNodes(nodeIds, targetId, context) {
     // 変換ロジック
   }
   ```

4. **動作確認とデバッグ**
   - 単体テストでの変換確認
   - 実際のUIでの動作確認
   - エラーケースの確認

## 次のステップ

実装は以下の優先順位で段階的に行います：

1. **Phase 1**: `utils.ts` と `types.ts` (基盤)
2. **Phase 2**: `TreeObservableAdapter.ts` (サブスクリプション変換)
3. **Phase 3**: `TreeMutationCommands.ts` (基本CRUD)  
4. **Phase 4**: `WorkingCopyCommands.ts` (編集フロー)

各フェーズの実装において、メソッドごとに既存コードとの対応を確認しながら進めます。