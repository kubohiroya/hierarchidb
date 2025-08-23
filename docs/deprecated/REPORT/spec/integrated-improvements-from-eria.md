# eria-cartographからの統合改善仕様

## 1. Draft機能の導入

### 1.1 Draft概念の必要性
ノード種別ごとのエンティティ、サブエンティティが作成を完了していない場合の状態管理として必須。

### 1.2 実装仕様

```typescript
// packages/core/src/types/tree.ts に追加
export interface DraftProperties {
  isDraft?: boolean; // エンティティ作成が未完了のノード
}

export interface WorkingCopyProperties {
  workingCopyOf?: TreeNodeId; // 編集対象の元ノードID（新規作成時はundefined）
  copiedAt?: Timestamp; // Working Copy作成時刻
}

// TreeNodeを拡張
export type TreeNode = TreeNodeBase &
  Partial<ReferenceProperties> &
  Partial<TrashItemProperties> &
  Partial<DraftProperties> &
  Partial<WorkingCopyProperties>;
```

## 2. API設計の階層化

### 2.1 Command/Direct APIの使い分け基準

```typescript
// Undo/Redoが必要な操作 → Command Pattern
interface UndoableCommands {
  commitWorkingCopy: CommandEnvelope<'commitWorkingCopy', CommitWorkingCopyPayload>;
  commitWorkingCopyForCreate: CommandEnvelope<'commitWorkingCopyForCreate', CommitWorkingCopyForCreatePayload>;
  moveNodes: CommandEnvelope<'moveNodes', MoveNodesPayload>;
  duplicateNodes: CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>;
  deleteNodes: CommandEnvelope<'deleteNodes', DeleteNodesPayload>;
}

// Undo/Redoが不要な操作 → Direct API
interface DirectOperations {
  // Working Copy操作（commitを除く）
  createNewDraftWorkingCopy(parentId: TreeNodeId, nodeType: TreeNodeType, baseName: string): Promise<TreeNodeId>;
  createWorkingCopy(treeNode: TreeNode): Promise<TreeNodeId>;
  discardWorkingCopy(workingCopyId: TreeNodeId): Promise<void>;
  
  // 読み取り操作
  getPathToRoot(nodeId: TreeNodeId): Promise<TreeNode[]>;
  getAllDescendants(nodeId: TreeNodeId): Promise<TreeNodeId[]>;
  groupDescendants(ids: TreeNodeId[]): Promise<TreeNode[]>;
}
```

## 3. TreeNode構造の拡張

### 3.1 Descendant情報の強化

```typescript
// packages/core/src/types/tree.ts
export interface DescendantProperties {
  hasChildren?: boolean;      // 子ノードの有無
  descendantCount?: number;    // 直接の子ノード数
  isEstimated?: boolean;       // 推定値フラグ（大量データ時の最適化）
}

export interface TreeNodeWithChildren extends TreeNode, DescendantProperties {
  children?: TreeNodeId[];     // フラット構造維持
}
```

### 3.2 プロパティのMixin構成

```typescript
// packages/core/src/types/tree.ts
import type { Timestamped } from './timestamped';
import type { WorkingCopyProperties } from './workingCopy';
import type { DraftProperties } from './draft';
import type { TrashItemProperties } from './trash';
import type { DescendantProperties } from './descendant';

// 基底型の定義
export interface TreeNodeBase extends Timestamped {
  treeNodeId: TreeNodeId;
  parentTreeNodeId: TreeNodeId;
  treeNodeType: TreeNodeType;
  name: string;
  description?: string;
  data?: Record<string, unknown>;
}

// Mixin構成
export interface TreeNodeEntity extends
  TreeNodeBase,
  Partial<WorkingCopyProperties>,
  Partial<DraftProperties>,
  Partial<TrashItemProperties>,
  Partial<DescendantProperties> {}
```

## 4. 名前重複処理の自動化

### 4.1 実装仕様

```typescript
// packages/worker/src/utils/nameUtil.ts
export function createNewName(siblingNames: string[], baseName: string): string {
  if (!siblingNames.includes(baseName)) {
    return baseName;
  }
  
  let counter = 1;
  let newName: string;
  do {
    newName = `${baseName} (${counter})`;
    counter++;
  } while (siblingNames.includes(newName));
  
  return newName;
}

// packages/worker/src/operations/workingCopyOperations.ts
export async function createNewDraftWorkingCopy(
  db: EphemeralDB,
  coreDB: CoreDB,
  parentTreeNodeId: TreeNodeId,
  treeNodeType: TreeNodeType,
  baseName: string
): Promise<TreeNodeId> {
  const siblingNames = await coreDB.treeNodes
    .where('parentTreeNodeId')
    .equals(parentTreeNodeId)
    .toArray()
    .then(nodes => nodes.map(n => n.name));
  
  const uniqueName = createNewName(siblingNames, baseName);
  // ... Working Copy作成処理
}
```

## 5. データベース操作の最適化

### 5.1 バッチ処理パターン

```typescript
// packages/worker/src/operations/batchOperations.ts
export interface BatchOperations {
  loadNodesBatch(nodeIds: TreeNodeId[]): Promise<{
    nodeMap: Map<TreeNodeId, TreeNode>;
    childrenMap: Map<TreeNodeId, TreeNode[]>;
  }>;
  
  loadNodesAndChildren(expandedNodeIds: TreeNodeId[]): Promise<{
    nodeMap: Map<TreeNodeId, TreeNode>;
    childrenMap: Map<TreeNodeId, TreeNode[]>;
  }>;
  
  batchCreateNodes(nodes: TreeNode[]): Promise<void>;
  batchDeleteNodes(nodeIds: TreeNodeId[]): Promise<number>;
  batchMoveNodes(moves: Array<{
    nodeId: TreeNodeId;
    newParentId: TreeNodeId;
  }>): Promise<void>;
}
```

### 5.2 トランザクション管理

```typescript
// packages/worker/src/operations/transactionManager.ts
export class TransactionManager {
  async executeInTransaction<T>(
    db: Dexie,
    tables: Table[],
    operation: () => Promise<T>
  ): Promise<T> {
    return db.transaction('rw', ...tables, operation);
  }
  
  // CoreDBとEphemeralDBをまたぐトランザクション
  async executeCrossDBTransaction<T>(
    operations: {
      core?: () => Promise<void>;
      ephemeral?: () => Promise<void>;
    }
  ): Promise<T> {
    // 分散トランザクションの実装
    const results = await Promise.all([
      operations.core?.(),
      operations.ephemeral?.()
    ]);
    return results as T;
  }
}
```

## 6. 高度なツリー操作

### 6.1 複製・移動操作

```typescript
// packages/worker/src/operations/treeOperations.ts
export interface AdvancedTreeOperations {
  duplicateBranch(
    sourceId: TreeNodeId,
    newParentId: TreeNodeId,
    idMapping: Map<TreeNodeId, TreeNodeId>,
    branchRootMode?: boolean
  ): Promise<void>;
  
  groupDescendants(ids: TreeNodeId[]): Promise<TreeNode[]>;
  
  copyDescendants(
    sourceId: TreeNodeId,
    targetId: TreeNodeId
  ): Promise<void>;
}
```

### 6.2 Descendant計算の最適化

```typescript
// packages/worker/src/operations/descendantOperations.ts
export class DescendantCalculator {
  private cache: Map<TreeNodeId, Set<TreeNodeId>> = new Map();
  
  async updateDescendantCount(
    db: CoreDB,
    parentTreeNodeId: TreeNodeId
  ): Promise<void> {
    const count = await db.treeNodes
      .where('parentTreeNodeId')
      .equals(parentTreeNodeId)
      .count();
    
    await db.treeNodes.update(parentTreeNodeId, {
      descendantCount: count,
      isEstimated: count > 1000 // 大量データの場合は推定値フラグ
    });
  }
  
  async getAllDescendants(
    db: CoreDB,
    nodeId: TreeNodeId
  ): Promise<TreeNodeId[]> {
    // キャッシュチェック
    if (this.cache.has(nodeId)) {
      return Array.from(this.cache.get(nodeId)!);
    }
    
    // 再帰的な取得（最適化済み）
    const descendants = new Set<TreeNodeId>();
    const queue = [nodeId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await db.treeNodes
        .where('parentTreeNodeId')
        .equals(currentId)
        .primaryKeys();
      
      children.forEach(childId => {
        descendants.add(childId);
        queue.push(childId);
      });
    }
    
    // キャッシュ更新
    this.cache.set(nodeId, descendants);
    return Array.from(descendants);
  }
  
  isDescendantOf(
    nodeId: TreeNodeId,
    ancestorId: TreeNodeId
  ): boolean {
    if (this.cache.has(ancestorId)) {
      return this.cache.get(ancestorId)!.has(nodeId);
    }
    // キャッシュがない場合は計算
    return false; // 実装省略
  }
}
```

## 7. プラグインアーキテクチャの統合

### 7.1 WorkerFacadeパターン（hierarchidbのDB分離を維持）

```typescript
// packages/worker/src/WorkerFacade.ts
export class WorkerFacade {
  private plugins: Map<string, WorkerPlugin<any>> = new Map();
  private coreDB: CoreDB;
  private ephemeralDB: EphemeralDB;
  
  constructor() {
    // hierarchidbのDB分離アーキテクチャを維持
    this.coreDB = new CoreDB();
    this.ephemeralDB = new EphemeralDB();
  }
  
  async initialize(): Promise<WorkerFacade> {
    // プラグインの初期化
    const plugins = [
      new TreeMutationPlugin(this.coreDB, this.ephemeralDB),
      new TreeQueryPlugin(this.coreDB),
      new TreeObservablePlugin(this.coreDB, this.ephemeralDB)
    ];
    
    for (const plugin of plugins) {
      await plugin.initialize();
      this.plugins.set(plugin.name, plugin);
    }
    
    return this;
  }
  
  getProxy<T>(name: string): T & ProxyMarked {
    const plugin = this.plugins.get(name);
    if (!plugin) throw new Error(`Plugin ${name} not found`);
    return proxy(plugin.instance) as T & ProxyMarked;
  }
}

// Comlink経由で公開
expose(WorkerFacade);
```

## 8. 実装優先順位とタイムライン

### Phase 1: 基礎改善（1週間）
- [x] Draft/WorkingCopyProperties分離
- [x] TreeNode Mixin構成
- [x] Descendant情報拡張
- [ ] 名前重複処理実装

### Phase 2: API統合（1週間）
- [ ] Direct API実装
- [ ] Command/Direct使い分け実装
- [ ] トランザクション管理実装

### Phase 3: 高度な機能（1週間）
- [ ] バッチ処理実装
- [ ] Descendant最適化
- [ ] 高度なツリー操作
- [ ] プラグインアーキテクチャ統合

## まとめ

eria-cartographの実証済みパターンをhierarchidbの優れたアーキテクチャ（CoreDB/EphemeralDB分離）上に統合することで：

1. **Draft機能**: エンティティ作成の柔軟な管理
2. **API階層化**: Undo/Redo要件に基づく明確な使い分け
3. **パフォーマンス**: バッチ処理とDescendant最適化
4. **拡張性**: プラグインベースの機能追加
5. **品質**: 実証済みパターンの活用によるリスク軽減

これらの改善により、hierarchidbは高品質で拡張性の高いシステムとなります。