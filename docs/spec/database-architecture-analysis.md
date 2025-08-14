# データベースアーキテクチャ分析：hierarchidb vs eria-cartograph

## 概要

既存実装（eria-cartograph）と現在の設計（hierarchidb）を比較分析し、hierarchidbアーキテクチャの優位性と取り入れるべき実装パターンを整理します。

## アーキテクチャ比較

### eria-cartograph: プラグイン別DB分離
```typescript
// プラグインごとに個別のデータベース
new TreeNodesDB(`${dbNamePrefix}-Resources`)  // ERIA-Resources
new TreeNodesDB(`${dbNamePrefix}-Projects`)   // ERIA-Projects  
new TableStateEntitiesDB(`${dbNamePrefix}-table`) // ERIA-table
```

**利点:**
- プラグインの独立性
- データベース間の分離

**課題:**
- データの生存期間管理が複雑
- Working Copyと本体データが同一DB内に混在
- トランザクション境界が不明確

### hierarchidb: データ性質による分離
```typescript
// データの生存期間による論理分離
CoreDB {
  // 長期間保存されるデータ
  trees, treeNodes, entities
}

EphemeralDB { 
  // 一時的なデータ
  workingCopies, treeViewStates, sessions
}
```

**利点:**
- ✅ **生存期間による最適化**: 一時データの自動クリーンアップ
- ✅ **パフォーマンス**: データアクセスパターンの最適化
- ✅ **メンテナンス性**: 明確なデータライフサイクル
- ✅ **トランザクション**: 適切な境界設定

## hierarchidb設計の優位性詳細

### 1. データライフサイクル管理

#### eria-cartographの課題
```typescript
// Working CopyとTreeNodeが同じテーブルに混在
treeNodes: Table<TreeNodeEntity, TreeNodeId> {
  // 本体ノード: createdAt, updatedAt
  // Working Copy: workingCopyOf, copiedAt, isDraft
  // → 混在により複雑なクエリが必要
}
```

#### hierarchidbの解決策
```typescript
// CoreDB: 永続データ
interface CoreDB {
  trees: Table<Tree, TreeId>;
  treeNodes: Table<TreeNode, TreeNodeId>;
}

// EphemeralDB: 一時データ
interface EphemeralDB {
  workingCopies: Table<WorkingCopy, UUID>;
  treeViewStates: Table<TreeViewState, string>;
}
```

### 2. パフォーマンス最適化

#### キャッシュ戦略
```typescript
// CoreDB: 長期キャッシュ適用
// - ツリー構造は変更頻度が低い
// - ブラウザキャッシュとの連携

// EphemeralDB: 短期キャッシュ
// - Working Copyは編集中のみ有効
// - ViewStateは画面遷移で無効化
```

#### インデックス最適化
```typescript
// CoreDB: 読み取り最適化
treeNodes: '&treeNodeId, parentTreeNodeId, [parentTreeNodeId+name], treeNodeType'

// EphemeralDB: 作成・更新最適化  
workingCopies: '&workingCopyId, workingCopyOf, parentTreeNodeId, updatedAt'
```

### 3. トランザクション境界の明確化

#### 問題のあるパターン（eria-cartograph）
```typescript
// 同一DBでの混在により境界が不明確
await db.transaction('rw', db.treeNodes, async () => {
  // 本体ノード更新 (永続操作)
  // Working Copy作成 (一時操作)
  // → 異なる性質の操作が混在
});
```

#### 改善されたパターン（hierarchidb）
```typescript
// 明確な境界分離
await coreDB.transaction('rw', coreDB.treeNodes, async () => {
  // 永続データの操作のみ
});

await ephemeralDB.transaction('rw', ephemeralDB.workingCopies, async () => {
  // 一時データの操作のみ
});
```

## 取り入れるべき実装パターン

### 1. Working Copy操作の実装品質

eria-cartographの実装品質は高く、以下をhierarchidbに適用すべき：

```typescript
// eria-cartographからの優秀なパターン
export async function createNewDraftWorkingCopy(
  parentTreeNodeId: TreeNodeId,
  treeNodeType: TreeNodeType,
  baseName: string,
): Promise<TreeNodeId> {
  // ✅ 名前重複チェックのロジック
  const siblingNames = await getChildNames(parentTreeNodeId);
  const uniqueName = createNewName(siblingNames, baseName);
  
  // ✅ アトミックな操作
  return await transaction(async () => {
    // 実装詳細...
  });
}
```

### 2. Descendant管理の効率化

```typescript
// eria-cartographの効率的なDescendant管理
export interface DescendantProperties {
  hasChildren?: boolean;      // eria-cartographから
  descendantCount?: number;   // eria-cartographから  
  isEstimated?: boolean;      // eria-cartographから
}

// hierarchidbの改良版
export interface TreeNodeWithChildren extends TreeNode {
  hasChild: boolean;          // hierarchidb独自（シンプル化）
  children?: TreeNodeId[];    // hierarchidb独自（フラット構造）
  
  // eria-cartographから追加
  descendantCount?: number;   // パフォーマンス向上のため
  isEstimated?: boolean;      // 大量データ処理のため
}
```

## 統合アーキテクチャ提案

### データベース設計
```typescript
// hierarchidbの優れたDB分離 + eria-cartographの実装品質
interface DatabaseArchitecture {
  core: CoreDB;      // 永続データ（hierarchidb設計）
  ephemeral: EphemeralDB; // 一時データ（hierarchidb設計）
  
  // eria-cartographの実装パターンを適用
  operations: {
    workingCopy: WorkingCopyOperations;  // 実証済み実装
    tree: TreeOperations;               // 実証済み実装
    descendant: DescendantOperations;   // 最適化済み実装
  }
}
```

### API設計の統合
```typescript
// hierarchidbのCommand Pattern + eria-cartographの直接操作
interface HybridAPI {
  // 構造化されたコマンドAPI（hierarchidb）
  executeCommand<T>(envelope: CommandEnvelope<string, T>): Promise<CommandResult>;
  
  // 直接操作API（eria-cartographの便利性）
  direct: {
    createWorkingCopy(node: TreeNode): Promise<TreeNodeId>;
    commitWorkingCopy(id: TreeNodeId, isDraft: boolean): Promise<void>;
    // ...
  }
}
```

## 結論

hierarchidbのCoreDB/EphemeralDB分離アーキテクチャは、以下の点でeria-cartographより優れています：

1. **データの性質に応じた最適化**
2. **明確なライフサイクル管理** 
3. **パフォーマンス最適化の容易性**
4. **メンテナンス性の向上**

一方で、eria-cartographの実装品質（特にWorking Copy操作とDescendant管理）は積極的に取り入れ、hierarchidbアーキテクチャ上で活用すべきです。

## 次のアクション

1. **アーキテクチャ維持**: hierarchidbのCoreDB/EphemeralDB設計を堅持
2. **実装品質向上**: eria-cartographの実証済みパターンを適用
3. **API統合**: 構造化コマンドと直接操作の両方をサポート
4. **段階的移行**: 既存仕様との互換性を保ちながら改善