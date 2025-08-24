# NodeTypeRegistry 統合計画

## 現状分析

現在、3つの異なるNodeTypeRegistryが存在：

### 1. `packages/core/src/registry/NodeTypeRegistry.ts`
- **責務**: NodeTypeDefinition（AOP設計用）
- **特徴**: 
  - EntityHandler管理
  - データベーススキーマ登録
  - API拡張登録
  - シングルトンパターン

### 2. `packages/worker/src/registry/NodeTypeRegistry.ts`
- **責務**: NodeTypeConfig（シンプルな設定）
- **特徴**:
  - 軽量な設定管理
  - 子ノード制約
  - アイコン・表示名管理
  - 非シングルトン（インスタンス生成可能）

### 3. `packages/worker/src/registry/UnifiedNodeTypeRegistry.ts`
- **責務**: UnifiedPluginDefinition（統合プラグイン）
- **特徴**:
  - NodeTypeRegistryを継承
  - React Router統合
  - プラグインメタデータ
  - 依存関係管理

## 問題点

1. **機能の重複**: 3つのレジストリが類似機能を持つ
2. **責務の混在**: coreパッケージにworker固有の実装がある
3. **継承関係の不明瞭**: UnifiedがworkerのNodeTypeRegistryを継承
4. **型の不整合**: NodeTypeDefinitionとUnifiedPluginDefinitionの関係が不明確

## 推奨される統合方針

### Option A: 階層的アプローチ（推奨）

```
packages/core/
  └── registry/
      └── BaseNodeTypeRegistry.ts  // 基本インターフェースと型定義
      
packages/worker/
  └── registry/
      ├── SimpleNodeTypeRegistry.ts  // 軽量版（旧NodeTypeRegistry）
      └── UnifiedPluginRegistry.ts   // 統合版（旧UnifiedNodeTypeRegistry）
```

### 実装計画

#### Phase 1: インターフェース定義
```typescript
// packages/core/src/registry/INodeTypeRegistry.ts
export interface INodeTypeRegistry {
  register(nodeType: TreeNodeType, config: any): void;
  unregister(nodeType: TreeNodeType): void;
  get(nodeType: TreeNodeType): any;
  has(nodeType: TreeNodeType): boolean;
  getAll(): TreeNodeType[];
}

export interface IPluginRegistry extends INodeTypeRegistry {
  registerPlugin(definition: UnifiedPluginDefinition): void;
  getPlugin(nodeType: TreeNodeType): UnifiedPluginDefinition | undefined;
  validateDependencies(nodeType: TreeNodeType): boolean;
}
```

#### Phase 2: 基底実装
```typescript
// packages/core/src/registry/BaseNodeTypeRegistry.ts
export abstract class BaseNodeTypeRegistry implements INodeTypeRegistry {
  protected registry: Map<TreeNodeType, any> = new Map();
  
  abstract register(nodeType: TreeNodeType, config: any): void;
  
  unregister(nodeType: TreeNodeType): void {
    this.registry.delete(nodeType);
  }
  
  get(nodeType: TreeNodeType): any {
    return this.registry.get(nodeType);
  }
  
  has(nodeType: TreeNodeType): boolean {
    return this.registry.has(nodeType);
  }
  
  getAll(): TreeNodeType[] {
    return Array.from(this.registry.keys());
  }
}
```

#### Phase 3: 具体実装

##### SimpleNodeTypeRegistry（軽量版）
```typescript
// packages/worker/src/registry/SimpleNodeTypeRegistry.ts
export class SimpleNodeTypeRegistry extends BaseNodeTypeRegistry {
  register(nodeType: TreeNodeType, config: NodeTypeConfig): void {
    this.registry.set(nodeType, config);
  }
  
  // NodeTypeConfig固有のメソッド
  canAddChild(parent: TreeNodeType, child: TreeNodeType): boolean {
    // 実装
  }
}
```

##### UnifiedPluginRegistry（統合版）
```typescript
// packages/worker/src/registry/UnifiedPluginRegistry.ts
export class UnifiedPluginRegistry extends BaseNodeTypeRegistry implements IPluginRegistry {
  private static instance: UnifiedPluginRegistry;
  
  static getInstance(): UnifiedPluginRegistry {
    if (!this.instance) {
      this.instance = new UnifiedPluginRegistry();
    }
    return this.instance;
  }
  
  registerPlugin(definition: UnifiedPluginDefinition): void {
    // プラグイン登録ロジック
  }
}
```

## 移行戦略

### Step 1: 新構造の作成
1. インターフェースと基底クラスを作成
2. 新しい実装を作成
3. テストを追加

### Step 2: 段階的移行
1. 既存コードを新しいインターフェースに適合
2. import文を更新
3. 非推奨警告を追加

### Step 3: 旧実装の削除
1. 旧ファイルを削除
2. ドキュメント更新

## 影響範囲

### 影響を受けるファイル
- すべてのプラグイン実装
- テストファイル
- Worker初期化コード
- UI層のレジストリ参照

### 後方互換性
- 一時的に旧APIを維持
- 段階的な移行をサポート

## タイムライン

- **Week 1**: インターフェースと基底実装
- **Week 2**: 具体実装と移行
- **Week 3**: テストと文書化
- **Week 4**: 旧実装の削除

## リスクと対策

| リスク | 対策 |
|--------|------|
| 既存コードの破壊 | 段階的移行、後方互換性維持 |
| テストの失敗 | 包括的なテストカバレッジ |
| パフォーマンス劣化 | ベンチマークテスト |