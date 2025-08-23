# HierarchiDB 改善アクションプラン

## はじめに

この改善アクションプランでは、実装分析レポートで特定された問題点に対する具体的な解決策と実行計画について説明します。本ドキュメントは以下のような方を対象としています：

**読むべき人**: プロジェクトマネージャー、開発チームリーダー、アーキテクト、技術的負債解決を担当する開発者、品質改善を推進する方、BaseMap・StyleMap・Shape・Spreadsheet・Projectプラグインの品質向上を担当する方

**前提知識**: 実装分析レポートの内容、プロジェクト管理、技術的負債管理、優先度付け、リファクタリング計画、品質指標

**読むタイミング**: 品質改善活動の計画策定時、技術的負債解決の優先順位決定時、開発リソース配分の決定時に参照してください。特にSpreadsheetプラグインなどの新機能開発前に、基盤品質の改善状況を確認し、開発効率向上のための前提条件を整える際に有用です。

本プランは、問題の優先度付けと段階的な解決アプローチにより、効率的な品質改善を実現することを目的としています。

## 概要

実装分析レポートで特定された問題点に対する具体的な改善提案とアクションプランです。

## 1. Tree関係用語の統一 【優先度：高】

### 1.1 対象ファイル

**更新対象の仕様書:**
- `docs/02-architecture-data-model.md`
- `docs/04-plugin-entity-system.md`
- `docs/02-architecture-overview.md`

**実装現状に合わせる変更:**
```typescript
// 仕様書 → 実装現状
TreeNodeId → NodeId
TreeId → TreeId (変更なし)
treeNodeId → id
parentTreeNodeId → parentNodeId
treeNodeType → nodeType
treeId → id (Tree.id)
treeRootNodeId → rootNodeId (Tree.rootNodeId)
```

### 1.2 具体的作業

1. **docs/02-architecture-data-model.md の更新**
   - 全ての `TreeNodeId` を `NodeId` に置換
   - インターフェース定義を実装現状に合わせる
   - サンプルコードを実際の型定義に合わせて修正

2. **他の仕様書の一括更新**
   - grep でTreeNode関連の用語を検索
   - 実装と一致しない用語を修正

## 2. EntityHandlerの3分類対応 【優先度：高】

### 2.1 現在の問題点

```typescript
// 現在：汎用的すぎるBaseEntityHandler
export abstract class BaseEntityHandler<TEntity, TSubEntity, TWorkingCopy> {
  // 全種類のエンティティに対して同じインターフェース
}
```

### 2.2 改善後の設計

```typescript
// 分類別の専用Handler基底クラス
export abstract class PeerEntityHandler<T extends PeerEntity> 
  extends BaseEntityHandler<T> {
  // 1対1関係に特化したメソッド
  protected async syncWithNode(nodeId: NodeId): Promise<void> { /*...*/ }
}

export abstract class GroupEntityHandler<T extends GroupEntity> 
  extends BaseEntityHandler<T> {
  // 1対N関係に特化したメソッド
  async createBatch(nodeId: NodeId, items: Partial<T>[]): Promise<T[]> { /*...*/ }
  async getByParentNode(nodeId: NodeId): Promise<T[]> { /*...*/ }
}

export abstract class RelationalEntityHandler<T extends RelationalEntity>
  extends BaseEntityHandler<T> {
  // N対N関係に特化したメソッド
  async addReference(entityId: string, nodeId: NodeId): Promise<void> { /*...*/ }
  async removeReference(entityId: string, nodeId: NodeId): Promise<void> { /*...*/ }
}
```

### 2.3 実装手順

1. **新しいHandler基底クラスの作成**
   - `packages/worker/src/handlers/PeerEntityHandler.ts`
   - `packages/worker/src/handlers/GroupEntityHandler.ts`  
   - `packages/worker/src/handlers/RelationalEntityHandler.ts`

2. **既存プラグインの移行**
   - BaseMapEntityHandler → PeerEntityHandler
   - StyleMapEntityHandler → PeerEntityHandler + RelationalEntityHandler

3. **プラグイン定義の更新**
   - 分類を明示するメタデータ追加

## 3. 型安全性の向上 【優先度：高】

### 3.1 具体的改善項目

**1. ファクトリー関数の追加**
```typescript
// packages/core/src/utils/idFactory.ts (新規作成)
export function createNodeId(id?: string): NodeId {
  if (id && isValidNodeIdString(id)) {
    return id as NodeId;
  }
  throw new Error('Invalid NodeId format');
}

export function createTreeId(id?: string): TreeId {
  if (id && isValidTreeIdString(id)) {
    return id as TreeId;
  }
  throw new Error('Invalid TreeId format');
}
```

**2. 配列操作の型安全性**
```typescript
// packages/core/src/utils/typeGuards.ts (拡張)
export function filterValidNodeIds(ids: unknown[]): NodeId[] {
  return ids.filter((id): id is NodeId => 
    typeof id === 'string' && isValidNodeIdFormat(id)
  );
}
```

**3. JSON操作の型安全性**
```typescript
// packages/core/src/utils/serialization.ts (新規作成)
export function deserializeTreeNode(data: unknown): TreeNode {
  const parsed = parseAndValidate(data, treeNodeSchema);
  return {
    ...parsed,
    id: parsed.id as NodeId,
    parentNodeId: parsed.parentNodeId as NodeId,
  };
}
```

### 3.2 実装手順

1. **新しいユーティリティファイル作成**
2. **既存コードの段階的移行**
3. **ESLint ルールの追加** (型キャストの制限)

## 4. エンティティワーキングコピー機能の拡充 【優先度：中】

### 4.1 現在の制限

```typescript
// 現在：TreeNodeのワーキングコピーのみ
interface WorkingCopy extends TreeNode {
  workingCopyId: string;
  workingCopyOf: NodeId;
  // ...
}
```

### 4.2 改善後の設計

```typescript
// エンティティ用ワーキングコピー
interface EntityWorkingCopy<T extends BaseEntity> {
  workingCopyId: string;
  workingCopyOf: string; // EntityId
  entityType: 'peer' | 'group' | 'relational';
  entity: T;
  copiedAt: number;
  isDirty: boolean;
}
```

### 4.3 実装方針

1. **段階的実装**：まずPeerEntityから対応
2. **既存機能との統合**：TreeNodeワーキングコピーとの連携
3. **自動クリーンアップ**：ダイアログ閉鎖時の自動削除

## 5. プラグインスキーマ定義の標準化 【優先度：中】

### 5.1 現在の問題

```typescript
// プラグインごとに独自のスキーマ定義方法
// StyleMapDatabase.ts
this.version(1).stores({
  styleMapEntities: '&nodeId, name, isActive',
  // ...
});

// BaseMapDatabase.ts  
this.version(1).stores({
  baseMapEntities: '&nodeId, center, zoom',
  // ...
});
```

### 5.2 標準化提案

```typescript
// 統一されたスキーマ定義フォーマット
export interface PluginDatabaseSchema {
  entities: {
    [storeName: string]: {
      classification: 'peer' | 'group' | 'relational';
      schema: string;
      indexes?: string[];
      relationships?: {
        [field: string]: {
          targetStore: string;
          type: 'reference' | 'foreign_key';
        };
      };
    };
  };
}
```

### 5.3 実装手順

1. **標準スキーマ定義型の作成**
2. **既存プラグインの段階的移行**
3. **ビルド時バリデーション**の追加

## 6. TreeRootNodeType vs TreeRootNodeId の検討 【優先度：低】

### 6.1 現在の実装

```typescript
// 現在：TypeとIdの両方を使用
TREE_ROOT_NODE_TYPES = { ROOT: 'Root', TRASH: 'Trash', SUPER_ROOT: 'SuperRoot' }

// NodeIdGenerator での使用
rootNode: (treeId: string) => `${treeId}Root` as NodeId
```

### 6.2 検討事項

**Type必要派の論点:**
- 探索停止の判定に使用
- ノード種別の明示的区別

**Id十分派の論点:**
- NodeId だけで判定可能
- より単純な設計

### 6.3 結論

現在の実装で問題ないため、**変更不要**と判断。
将来的な検討事項として記録。

## 7. 自動ライフサイクル管理の部分的改善 【優先度：中】

### 7.1 現実的な自動化レベル

**過度な自動化は避ける:**
- プラグイン開発者のコントロールを優先
- デバッグのしやすさを重視

**実装する自動化:**
- 分類に応じた標準的な削除順序
- 参照整合性の自動チェック
- 開発時の警告とヒント

### 7.2 具体的改善

```typescript
// 分類別の標準的な削除パターン提供
export class EntityLifecycleHelper {
  static async safeDeleteNode(nodeId: NodeId): Promise<void> {
    // 1. RelationalEntityの参照を削除
    await this.cleanupRelationalReferences(nodeId);
    
    // 2. GroupEntityを削除
    await this.deleteGroupEntities(nodeId);
    
    // 3. PeerEntityを削除
    await this.deletePeerEntity(nodeId);
    
    // 4. TreeNodeを削除
    await this.deleteTreeNode(nodeId);
  }
}
```

## 8. 実装優先度とタイムライン

### 8.1 Phase 1 (即座に着手)
- [ ] Tree用語の仕様書統一
- [ ] 分類別EntityHandlerの基底クラス作成
- [ ] 型安全性ユーティリティの追加

### 8.2 Phase 2 (1-2週間後)
- [ ] 既存プラグインの分類別Handler移行
- [ ] エンティティワーキングコピー基本機能
- [ ] プラグインスキーマ定義の標準化

### 8.3 Phase 3 (1ヶ月後)
- [ ] 自動ライフサイクル管理ヘルパー
- [ ] ESLintルールの追加
- [ ] ドキュメントの全面更新

## 9. 成功指標

1. **開発体験の向上**
   - プラグイン開発時のボイラープレートコード削減
   - 型エラーの事前発見率向上

2. **保守性の向上**
   - 分類別の責務明確化
   - テストカバレッジの向上

3. **ドキュメント品質**
   - 仕様書と実装の一致率 100%
   - サンプルコードの動作確認 100%

## 10. リスク管理

### 10.1 破壊的変更のリスク
- 段階的移行によるリスク軽減
- 既存APIの後方互換性維持

### 10.2 パフォーマンスリスク
- 型チェック処理のオーバーヘッド監視
- 必要に応じたオプトアウト機構

### 10.3 学習コストリスク  
- 詳細なマイグレーションガイド作成
- サンプルプラグインでの実例提供

---

**このアクションプランは、実装の詳細調査に基づいて作成されており、段階的で現実的な改善を目指しています。**