# TreeQueryService 実装要件

## 概要
TreeQueryServiceは、ツリー構造のクエリ・検索操作を管理するサービスです。ノード取得、子ノード取得、パス検索、コピー・エクスポート機能を提供します。

## 機能要件

### 1. 基本クエリ操作

#### 1.1 getNode
- 🟢 指定されたIDのノードを取得
- 🟢 CoreDBから直接取得
- 🟢 ノードが存在しない場合はundefined

#### 1.2 getChildren
- 🟢 指定された親ノードの直接の子ノードを取得
- 🟢 順序は作成順またはソート順
- 🟢 空配列の場合もある

#### 1.3 getDescendants
- 🟢 指定されたノードの全ての子孫ノードを取得
- 🟡 深さ制限オプション（maxDepth）
- 🟢 再帰的な取得

#### 1.4 getAncestors
- 🟢 指定されたノードから根ノードまでのパスを取得
- 🟢 順序は子→親方向
- 🟢 根ノードまで取得

#### 1.5 getPathToRoot
- 🟢 指定されたノードから根ノードまでのパスを取得
- 🟢 順序は親→子方向（reversed ancestors）
- 🟢 根ノードから指定ノードまで

### 2. 検索・フィルタ操作

#### 2.1 searchNodes
- 🟡 名前による部分一致検索
- 🟡 正規表現サポート
- 🟡 大文字小文字を区別しない検索

#### 2.2 filterNodesByType
- 🟢 ノードタイプによるフィルタリング
- 🟢 複数タイプの指定可能
- 🟢 子孫ノードも対象

### 3. コピー・エクスポート操作

#### 3.1 copyNodes
- 🟢 指定されたノードをクリップボードに相当するデータ構造にコピー
- 🟢 子孫ノードも含めてコピー
- 🟢 CommandResult形式で結果を返す

#### 3.2 exportNodes
- 🟢 指定されたノードを外部形式にエクスポート
- 🟢 JSON形式でのエクスポート
- 🟢 IDマッピング情報も含む

### 4. パフォーマンス最適化

#### 4.1 バッチクエリ
- 🟡 複数ノードを一度に取得
- 🟡 単一クエリでの複数ノード処理
- 🟡 N+1問題の回避

#### 4.2 ページング
- 🟡 大量の子ノードのページング取得
- 🟡 offset/limitパラメータ
- 🟡 総件数情報

## 非機能要件

### パフォーマンス
- 🟢 単一ノード取得: <10ms
- 🟢 子ノード取得（100件以下）: <50ms
- 🟢 全体的なクエリ応答時間: <200ms
- 🟡 大規模ツリー（10万ノード）での動作

### データ整合性
- 🟢 削除されたノードは結果に含まれない
- 🟢 権限のないノードは結果に含まれない
- 🟢 循環参照の検出と回避

### エラーハンドリング
- 🟢 無効なノードIDに対する適切なエラー
- 🟢 存在しない親ノードに対する空結果
- 🟢 権限エラーの適切な処理

## ペイロード定義

### GetNodePayload
```typescript
export interface GetNodePayload {
  treeNodeId: TreeNodeId;
}
```

### GetChildrenPayload
```typescript
export interface GetChildrenPayload {
  parentTreeNodeId: TreeNodeId;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```

### GetDescendantsPayload
```typescript
export interface GetDescendantsPayload {
  rootNodeId: TreeNodeId;
  maxDepth?: number;
  includeTypes?: TreeNodeType[];
  excludeTypes?: TreeNodeType[];
}
```

### SearchNodesPayload
```typescript
export interface SearchNodesPayload {
  query: string;
  searchInDescription?: boolean;
  caseSensitive?: boolean;
  useRegex?: boolean;
  rootNodeId?: TreeNodeId; // 検索範囲の限定
}
```

## 依存関係
- CoreDB（Task 1）✅
- TreeNode型システム（Task 2）✅

## テスト要件
1. 基本クエリ操作の動作確認
2. 存在しないノードに対するエラーハンドリング
3. 大量データでのパフォーマンステスト
4. 検索機能の精度テスト
5. コピー・エクスポート機能の整合性テスト
6. エッジケース（空ツリー、単一ノード、深いツリー）

## 実装優先順位
1. 基本クエリ操作（getNode, getChildren）
2. パス関連操作（getAncestors, getPathToRoot）
3. コピー・エクスポート操作
4. 検索・フィルタ機能
5. パフォーマンス最適化