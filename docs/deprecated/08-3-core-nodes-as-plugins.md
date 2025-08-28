# ツリーノードとフォルダの基本プラグイン化検討

## 概要

現在、ツリーノード（TreeNode）は特別な存在として扱われ、各種エンティティがそれに紐づく形で設計されている。この設計を見直し、「ツリーノード自体」と「フォルダ」を基本プラグインとして実装することで、アーキテクチャの単純化を図る。

## 現在のアーキテクチャ

### 問題点

```
現在の構造：
┌─────────────────────────────────────┐
│         Core System                  │
│  ┌─────────────────────────────┐    │
│  │   TreeNode (特別扱い)        │    │
│  │   - treeNodeId              │    │
│  │   - parentId                │    │
│  │   - treeNodeType            │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
           ↑ 紐付け
┌─────────────────────────────────────┐
│         Plugin Entities              │
│  ┌──────────┐ ┌──────────┐         │
│  │ BaseMap  │ │ StyleMap │ ...     │
│  │ Entity   │ │ Entity   │         │
│  └──────────┘ └──────────┘         │
└─────────────────────────────────────┘

問題：
1. TreeNodeが特別扱いで、プラグインと異なる処理系
2. フォルダとエンティティ付きノードで処理が分岐
3. コアシステムが肥大化
4. プラグイン開発者が混乱（なぜTreeNodeは特別？）
```

## 提案：基本プラグイン化

### 新しいアーキテクチャ

```
統一されたプラグインシステム：
┌─────────────────────────────────────┐
│      Minimal Core System             │
│  ┌─────────────────────────────┐    │
│  │  Node Reference (最小限)     │    │
│  │  - nodeId (UUID)            │    │
│  │  - parentId                 │    │
│  │  - pluginType               │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
           ↑ 全て同じ仕組み
┌─────────────────────────────────────┐
│      All Plugins (基本も含む)         │
│  ┌──────────┐ ┌──────────┐         │
│  │  Folder  │ │ Document │         │
│  │  Plugin  │ │  Plugin  │         │
│  └──────────┘ └──────────┘         │
│  ┌──────────┐ ┌──────────┐         │
│  │ BaseMap  │ │ StyleMap │         │
│  │  Plugin  │ │  Plugin  │         │
│  └──────────┘ └──────────┘         │
└─────────────────────────────────────┘
```

## 基本プラグインの定義

### 1. Folder プラグイン

```typescript
// packages/plugins/core-folder-plugin/src/worker/definition.ts
export const FolderPluginDefinition: WorkerPluginDefinition<FolderEntity> = {
  nodeType: 'folder-plugin',
  name: 'Folder',
  version: '1.0.0',
  
  // フォルダは最小限のデータのみ保持
  database: {
    dbName: 'CoreDB',
    tableName: 'folders',
    schema: 'nodeId, name, description, icon, color, createdAt, updatedAt',
    version: 1
  },
  
  entityHandler: {
    async create(parentId, data) {
      return {
        nodeId: generateId(),
        parentId,
        name: data.name || 'New Folder',
        description: data.description || '',
        icon: data.icon || 'folder-plugin',
        color: data.color || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      };
    }
  },
  
  lifecycle: {
    beforeCreate: async (parentId, data) => {
      // フォルダ名の重複チェック
      const siblings = await getSiblings(parentId);
      if (siblings.some(s => s.name === data.name)) {
        throw new Error('Folder name already exists');
      }
    },
    
    beforeDelete: async (nodeId) => {
      // 子要素があるフォルダの削除制御
      const children = await getChildren(nodeId);
      if (children.length > 0) {
        const confirm = await requestConfirmation(
          'This folder-plugin contains items. Delete all?'
        );
        if (!confirm) throw new Error('Deletion cancelled');
      }
    }
  },
  
  validation: {
    namePattern: /^[^<>:"/\\|?*]+$/,
    maxChildren: 10000,
    allowedChildTypes: ['*'], // 全てのノードタイプを許可
  }
};
```

### 2. Document プラグイン（エンティティ付きノードの基本形）

```typescript
// packages/plugins/core-document/src/worker/definition.ts
export const DocumentPluginDefinition: WorkerPluginDefinition<DocumentEntity> = {
  nodeType: 'document',
  name: 'Document',
  version: '1.0.0',
  
  database: {
    dbName: 'CoreDB',
    tableName: 'documents',
    schema: 'nodeId, name, content, mimeType, size, createdAt, updatedAt',
    version: 1
  },
  
  entityHandler: {
    async create(parentId, data) {
      return {
        nodeId: generateId(),
        parentId,
        name: data.name || 'New Document',
        content: data.content || '',
        mimeType: data.mimeType || 'text/plain',
        size: data.content?.length || 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      };
    },
    
    async createWorkingCopy(nodeId) {
      const entity = await this.get(nodeId);
      return {
        ...entity,
        workingCopyId: generateId(),
        workingCopyOf: nodeId,
        copiedAt: Date.now(),
        isDirty: false
      };
    }
  },
  
  lifecycle: {
    afterUpdate: async (nodeId, entity) => {
      // サイズを自動更新
      entity.size = entity.content?.length || 0;
    }
  },
  
  validation: {
    namePattern: /^[^<>:"/\\|?*]+$/,
    allowedChildTypes: [], // ドキュメントは子を持たない
  }
};
```

## アーキテクチャの変更点

### Before（現在）

```typescript
// 現在：TreeNodeが特別扱い
class CoreDB {
  // TreeNode専用のテーブル
  treeNodes = db.table<TreeNode>('treeNodes');
  
  // TreeNode専用のメソッド
  async createTreeNode(data: TreeNodeData) {
    // 特別な処理
    if (data.type === 'folder-plugin') {
      // フォルダ用の処理
    } else {
      // エンティティ付きノード用の処理
    }
  }
}

// プラグインは別扱い
class PluginRegistry {
  registerPlugin(plugin: PluginDefinition) {
    // TreeNodeとは異なる登録処理
  }
}
```

### After（提案）

```typescript
// 提案：全てがプラグイン
class CoreDB {
  // 最小限のノード参照テーブルのみ
  nodeReferences = db.table<NodeReference>('nodeReferences');
}

interface NodeReference {
  nodeId: string;
  parentId: string | null;
  pluginType: string; // 'folder-plugin', 'document', 'basemap' など
  sortOrder: number;
}

// 統一されたプラグインレジストリ
class UnifiedPluginRegistry {
  private plugins = new Map<string, PluginDefinition>();
  
  constructor() {
    // 基本プラグインを自動登録
    this.register(FolderPluginDefinition);
    this.register(DocumentPluginDefinition);
  }
  
  register(plugin: PluginDefinition) {
    // 全て同じ仕組みで登録
    this.plugins.set(plugin.nodeType, plugin);
  }
  
  async createNode(parentId: string, pluginType: string, data: any) {
    const plugin = this.plugins.get(pluginType);
    if (!plugin) throw new Error(`Unknown plugin type: ${pluginType}`);
    
    // 統一された作成処理
    const nodeId = generateId();
    
    // 1. ノード参照を作成
    await db.nodeReferences.add({
      nodeId,
      parentId,
      pluginType,
      sortOrder: await this.getNextSortOrder(parentId)
    });
    
    // 2. プラグインのエンティティを作成
    await plugin.entityHandler.create(parentId, data);
    
    return nodeId;
  }
}
```

## メリット・デメリット分析

### ✅ メリット

#### 1. **アーキテクチャの単純化**
- 特別扱いがなくなり、全てが同じ仕組み
- コアシステムが最小限になる
- 理解しやすく、保守しやすい

#### 2. **一貫性の向上**
- フォルダも他のノードも同じAPI
- プラグイン開発者にとって分かりやすい
- テストが書きやすい

#### 3. **拡張性の向上**
- フォルダの挙動もカスタマイズ可能
- 特殊なフォルダタイプを作成可能（スマートフォルダなど）
- 基本機能の改善も通常のプラグイン更新で対応

#### 4. **コードの削減**
- 特別処理の分岐が不要
- 重複コードの削除
- メンテナンスコストの削減

### ⚠️ デメリット

#### 1. **パフォーマンスの懸念**
- 基本操作もプラグイン経由になる
- 軽微なオーバーヘッドの可能性

**対策：**
```typescript
// 基本プラグインは内部最適化
class OptimizedFolderHandler {
  // キャッシュを活用
  private cache = new LRUCache<string, FolderEntity>();
  
  async get(nodeId: string) {
    if (this.cache.has(nodeId)) {
      return this.cache.get(nodeId);
    }
    // ...
  }
}
```

#### 2. **移行の複雑性**
- 既存データの移行が必要
- 後方互換性の維持

**対策：**
```typescript
// 移行スクリプト
async function migrateToPluginArchitecture() {
  // 1. 既存のTreeNodeを読み取り
  const treeNodes = await db.treeNodes.toArray();
  
  // 2. NodeReferenceとプラグインエンティティに変換
  for (const node of treeNodes) {
    // NodeReference作成
    await db.nodeReferences.add({
      nodeId: node.treeNodeId,
      parentId: node.parentId,
      pluginType: node.treeNodeType === 'folder-plugin' ? 'folder-plugin' : node.treeNodeType
    });
    
    // 対応するプラグインエンティティ作成
    const plugin = registry.get(node.treeNodeType);
    await plugin.migrate(node);
  }
}
```

#### 3. **基本機能の依存性**
- システムが基本プラグインに依存

**対策：**
```typescript
// 基本プラグインをコアパッケージに含める
// packages/core-plugins/
export const CORE_PLUGINS = [
  FolderPluginDefinition,
  DocumentPluginDefinition
];

// システム起動時に必須チェック
if (!registry.has('folder-plugin')) {
  throw new Error('Core plugin "folder-plugin" is required');
}
```

## 実装計画

### Phase 1: 基本プラグインの作成（1週間）
1. Folderプラグインの実装
2. Documentプラグインの実装
3. 基本プラグインのテスト

### Phase 2: コアシステムのリファクタリング（2週間）
1. NodeReferenceテーブルの追加
2. UnifiedPluginRegistryの実装
3. TreeNode依存コードの削除

### Phase 3: 移行（1週間）
1. データ移行スクリプトの作成
2. 後方互換性レイヤーの実装
3. 移行テスト

### Phase 4: 最適化（1週間）
1. パフォーマンス測定
2. キャッシュ実装
3. インデックス最適化

## 判定：実装すべきか？

### 🎯 結論：実装を推奨

**理由：**

1. **長期的なメリットが大きい**
   - アーキテクチャの単純化による保守性向上
   - プラグイン開発の容易化
   - 将来の拡張性確保

2. **技術的に実現可能**
   - パフォーマンス問題は最適化で対処可能
   - 移行パスが明確

3. **開発効率の向上**
   - 統一されたAPIによる学習コスト削減
   - テストの簡素化

### 実装時の注意点

```typescript
// 1. 基本プラグインは変更に慎重に
@sealed
class FolderPlugin {
  // Breaking changeを避ける
}

// 2. パフォーマンス監視
@monitored
class NodeOperations {
  @timed
  async createNode() { /* ... */ }
}

// 3. 段階的な移行
const MIGRATION_FLAGS = {
  useNewArchitecture: false, // 段階的に有効化
  keepLegacyAPI: true // 後方互換性
};
```

## サンプル実装

### 統一されたノード作成

```typescript
// Before: 複雑な分岐
async function createNode(type: string, data: any) {
  if (type === 'folder-plugin') {
    // フォルダ専用処理
    return createFolder(data);
  } else if (ENTITY_TYPES.includes(type)) {
    // エンティティ付きノード処理
    return createEntityNode(type, data);
  } else {
    throw new Error('Unknown type');
  }
}

// After: シンプルで統一
async function createNode(type: string, data: any) {
  const plugin = registry.get(type);
  return plugin.create(data);
}
```

### カスタムフォルダの例

```typescript
// スマートフォルダプラグイン（基本Folderを拡張）
export const SmartFolderPlugin: PluginDefinition = {
  ...FolderPluginDefinition,
  nodeType: 'smart-folder-plugin',
  name: 'Smart Folder',
  
  // 動的な子要素を持つ
  async getChildren(nodeId: string) {
    const folder = await this.get(nodeId);
    // クエリに基づいて動的に子要素を取得
    return await executeQuery(folder.query);
  }
};
```

## まとめ

ツリーノードとフォルダを基本プラグインとして実装することで：

1. **アーキテクチャが大幅に単純化**される
2. **全てが統一された仕組み**で動作する
3. **拡張性と保守性**が向上する
4. パフォーマンスへの影響は**最適化で対処可能**

移行コストはあるが、長期的なメリットを考慮すると実装する価値がある。