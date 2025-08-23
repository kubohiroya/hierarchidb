# 2.2 データモデル設計

## データモデル概要

### 階層構造
```
HierarchiDB Data Model
├── Core Models (ツリー構造)
│   ├── Tree
│   ├── TreeNode
│   └── TreeRootState
└── Plugin Models (拡張データ)
    ├── Entity (6分類システム)
    └── WorkingCopy
```

## コアデータモデル

### Tree（ツリー）
```typescript
interface Tree {
  id: TreeId;                    // ブランデッド型
  rootNodeId: RootNodeId;         // ルートノード
  trashRootNodeId: TrashRootNodeId; // ゴミ箱ルート
  superRootNodeId: SuperRootNodeId; // スーパールート
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### TreeNode（ノード）
```typescript
interface TreeNode {
  // 識別子
  id: NodeId;                     // ブランデッド型
  parentNodeId: NodeId;           // 親ノード
  nodeType: TreeNodeType;         // ノードタイプ
  
  // 基本情報
  name: string;
  description?: string;
  
  // メタデータ
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
  
  // 階層情報
  hasChild: boolean;              // 子ノード有無
  
  // ゴミ箱関連（オプション）
  originalName?: string;          // 削除前の名前
  originalParentNodeId?: NodeId;  // 削除前の親
  removedAt?: Timestamp;          // 削除日時
  
  // 参照関係（オプション）
  references?: NodeId[];          // 他ノードへの参照
}
```

### TreeRootState（展開状態）
```typescript
interface TreeRootState {
  id: TreeId;
  treeRootNodeType: TreeRootNodeType; // 'SuperRoot' | 'Root' | 'TrashRoot'
  expanded: true | Record<NodeId, boolean>; // 展開状態
  version: number;
}
```

## ブランデッド型システム

### 型定義
```typescript
// Opaque/Branded型による型安全性
type UUID = string & { readonly __brand: 'UUID' };
type TreeId = string & { readonly __brand: 'TreeId' };
type NodeId = string & { readonly __brand: 'NodeId' };
type EntityId = string & { readonly __brand: 'EntityId' };

// 特殊ノードID
type SuperRootNodeId = NodeId & { readonly __type: 'SuperRoot' };
type RootNodeId = NodeId & { readonly __type: 'Root' };
type TrashRootNodeId = NodeId & { readonly __type: 'TrashRoot' };
```

### 型の利点
1. **コンパイル時型チェック**: ID混同の防止
2. **ドキュメント性**: 型が意図を明確化
3. **リファクタリング安全性**: 型変更の影響範囲明確化

## エンティティ6分類システム

### 分類マトリックス
```
        │ Peer (1:1) │ Group (1:N) │ Relational (N:N)
────────┼─────────────┼─────────────┼──────────────────
Persistent │ 設定データ  │ 成果物      │ 共有リソース
Ephemeral  │ UI状態     │ 中間データ   │ セッション
```

### Persistent Peer（永続1対1）
```typescript
// 例：BaseMapEntity
interface BaseMapEntity extends PersistentPeerEntity {
  nodeId: NodeId;              // 1対1関係
  mapType: 'osm' | 'gsi';
  center: [number, number];
  zoom: number;
  style: MapStyle;
}
```

### Persistent Group（永続1対N）
```typescript
// 例：VectorTileEntity
interface VectorTileEntity extends PersistentGroupEntity {
  id: EntityId;
  parentNodeId: NodeId;        // 1対N関係
  zoom: number;
  x: number;
  y: number;
  data: Uint8Array;
}
```

### Persistent Relational（永続N対N）
```typescript
// 例：TableMetadataEntity
interface TableMetadataEntity extends PersistentRelationalEntity {
  id: EntityId;
  contentHash: string;
  referenceCount: number;
  referencingNodeIds: NodeId[]; // N対N関係
  lastAccessedAt: Timestamp;
}
```

### Ephemeral Peer（一時1対1）
```typescript
// 例：DialogStateEntity
interface DialogStateEntity extends EphemeralPeerEntity {
  nodeId: NodeId;              // 1対1関係
  currentStep: number;
  formData: Record<string, any>;
  sessionId: UUID;
  expiresAt: Timestamp;
}
```

### Ephemeral Group（一時1対N）
```typescript
// 例：BatchBufferEntity
interface BatchBufferEntity extends EphemeralGroupEntity {
  id: EntityId;
  parentNodeId: NodeId;        // 1対N関係
  sessionId: UUID;
  stage: ProcessingStage;
  data: ProcessingData;
  dependencies: EntityId[];
}
```

### Ephemeral Relational（一時N対N）
```typescript
// 例：BatchSessionEntity
interface BatchSessionEntity extends EphemeralRelationalEntity {
  id: UUID;
  referencingNodeIds: NodeId[]; // N対N関係
  status: 'running' | 'paused' | 'completed';
  config: BatchConfig;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}
```

## ワーキングコピーシステム

### WorkingCopy定義
```typescript
interface WorkingCopy extends TreeNode {
  // ワーキングコピー識別
  workingCopyId: UUID;
  workingCopyOf: NodeId;        // オリジナルノード
  
  // 状態管理
  copiedAt: Timestamp;
  isDirty: boolean;
  isDraft: boolean;
  
  // エンティティコピー
  entities?: Record<string, any>; // Copy-on-Write
}
```

### ライフサイクル
```
新規作成/編集開始
    ↓
WorkingCopy作成（EphemeralDB）
    ↓
編集操作（リアルタイム保存）
    ↓
┌─────────┬────────────┐
│ Commit  │  Discard   │
│  ↓      │    ↓       │
│ CoreDB  │  削除      │
└─────────┴────────────┘
```

## データベーススキーマ

### CoreDB（永続化）
```typescript
// Dexieスキーマ定義
const coreDBSchema = {
  trees: '&id, rootNodeId, trashRootNodeId, superRootNodeId',
  nodes: [
    '&id',                      // Primary key
    'parentNodeId',             // 親ノードインデックス
    '&[parentNodeId+name]',     // 複合ユニーク制約
    '[parentNodeId+updatedAt]', // ソート用複合インデックス
    'removedAt',                // ゴミ箱フィルタ用
    'originalParentNodeId',     // 復元用
    '*references'               // 配列インデックス
  ].join(', '),
  rootStates: '&[id+treeRootNodeType], id'
};
```

### EphemeralDB（一時データ）
```typescript
// 一時データスキーマ
const ephemeralDBSchema = {
  workingCopies: [
    '&workingCopyId',
    'workingCopyOf',            // オリジナルノード参照
    'parentNodeId',
    'updatedAt'
  ].join(', '),
  sessions: [
    '&sessionId',
    'nodeId',
    'expiresAt',                // 有効期限インデックス
    '[nodeId+sessionType]'
  ].join(', ')
};
```

## データ整合性

### 制約と検証
```typescript
class DataIntegrityService {
  // 親子関係の検証
  validateHierarchy(node: TreeNode): boolean {
    // 循環参照チェック
    if (this.hasCircularReference(node)) {
      return false;
    }
    // 親ノード存在確認
    return this.parentExists(node.parentNodeId);
  }
  
  // ユニーク制約
  validateUniqueness(node: TreeNode): boolean {
    // 同一親下での名前重複チェック
    return !this.hasDuplicateName(
      node.parentNodeId, 
      node.name, 
      node.id
    );
  }
}
```

### カスケード削除
```typescript
class CascadeDeleteService {
  async deleteNode(nodeId: NodeId): Promise<void> {
    await this.db.transaction('rw', async () => {
      // 子ノードの再帰削除
      const children = await this.getChildren(nodeId);
      for (const child of children) {
        await this.deleteNode(child.id);
      }
      
      // エンティティの削除
      await this.deleteEntities(nodeId);
      
      // ノード本体の削除
      await this.db.nodes.delete(nodeId);
    });
  }
}
```

## パフォーマンス考慮

### インデックス戦略
1. **主キー**: 高速な単一レコード取得
2. **外部キー**: 親子関係の効率的検索
3. **複合インデックス**: ソート済み結果取得
4. **配列インデックス**: 参照関係の検索

### データ分割
```typescript
// 大量データの分割処理
class DataPartitioner {
  async *getNodesInBatches(
    parentId: NodeId, 
    batchSize = 1000
  ): AsyncGenerator<TreeNode[]> {
    let offset = 0;
    while (true) {
      const batch = await this.db.nodes
        .where('parentNodeId').equals(parentId)
        .offset(offset)
        .limit(batchSize)
        .toArray();
      
      if (batch.length === 0) break;
      
      yield batch;
      offset += batchSize;
    }
  }
}
```

## マイグレーション戦略

### スキーマバージョン管理
```typescript
class MigrationManager {
  migrations: Migration[] = [
    {
      version: 1,
      upgrade: async (db) => {
        // 初期スキーマ
      }
    },
    {
      version: 2,
      upgrade: async (db) => {
        // references列追加
        await db.nodes.toCollection().modify(node => {
          node.references = [];
        });
      }
    }
  ];
}
```