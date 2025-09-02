# TreeObservableServiceV2 - リファクタリングアーキテクチャ

## 概要

TreeObservableServiceV2は、リアルタイムツリー監視機能を提供する高性能なObservableベースのサービスです。
このリファクタリング版では、モジュラー設計により保守性と拡張性を大幅に向上させています。

## アーキテクチャ

### 設計原則
- **単一責任の原則**: 各モジュールは明確に定義された責任を持つ
- **DRY原則**: 重複コードの排除と共通ロジックの統一化
- **依存性注入**: テスト可能性とモジュール間の疎結合を実現
- **パフォーマンス最適化**: メモリリーク防止と効率的なイベント処理

### モジュール構成

```
observable/
├── SubscriptionManager.ts     # サブスクリプション管理
├── EventFilterManager.ts      # イベントフィルタリング
├── DatabaseHelper.ts         # データベースアクセス
├── ObservableFactory.ts      # Observable作成・管理
├── openstreetmap-type.ts                  # モジュールエクスポート
└── README.md                 # このファイル
```

## 主要コンポーネント

### 1. SubscriptionManager
**責任**: サブスクリプションのライフサイクル管理
- サブスクリプションID生成
- 活動状況の追跡
- リソースクリーンアップ
- メモリリーク防止

### 2. EventFilterManager
**責任**: イベントフィルタリングロジック
- ノード監視用フィルター
- 子ノード監視用フィルター
- 部分木監視用フィルター（深度制限付き）
- ワーキングコピー監視用フィルター

### 3. DatabaseHelper
**責任**: データベースアクセスと初期イベント生成
- ノード情報取得
- 子ノード一覧取得
- 初期イベント作成
- イベント変換処理

### 4. ObservableFactory
**責任**: Observable作成と管理
- フィルタリングされたObservable作成
- 初期値付きObservable作成
- カスタムクリーンアップ処理
- リソース管理

## パフォーマンス改善

### 最適化内容
1. **深度計算アルゴリズム**: O(n²) → O(n) の計算複雑度改善
2. **メモリ管理**: 適切なサブスクリプションクリーンアップ
3. **イベントフィルタリング**: 効率的な事前フィルタリング
4. **リソース制限**: 最大深度制限による無限ループ防止

### セキュリティ強化
1. **入力値検証**: TreeNodeId形式の検証
2. **リソース制限**: サブスクリプション数の監視
3. **循環参照対策**: visited Set による無限ループ防止
4. **エラーハンドリング**: 適切な例外処理とフォールバック

## 使用方法

```typescript
// 基本的な使用例
const service = new TreeObservableServiceV2Impl(coreDB);

// 単一ノード監視
const nodeObservable = await service.observeNode({
  payload: { 
    treeNodeId: 'node1', 
    includeInitialValue: true 
  }
});

// 子ノード監視
const childrenObservable = await service.observeChildren({
  payload: { 
    parentTreeNodeId: 'parent1',
    includeInitialSnapshot: true,
    filter: { nodeTypes: ['file'] }
  }
});

// 部分木監視（深度制限付き）
const subtreeObservable = await service.observeSubtree({
  payload: {
    rootNodeId: 'root1',
    maxDepth: 3,
    includeInitialSnapshot: true
  }
});
```

## テスト構成

リファクタリングに伴い、テストファイルも機能別に分離されています：

- `TreeObservableServiceV2.node.test.ts`: 単一ノード監視テスト
- `TreeObservableServiceV2.children.test.ts`: 子ノード監視テスト
- `TreeObservableServiceV2.subtree.test.ts`: 部分木監視テスト
- `TreeObservableServiceV2.performance.test.ts`: パフォーマンステスト
- `TreeObservableServiceV2.error.test.ts`: エラーハンドリングテスト
- `TreeObservableServiceV2.setup.ts`: 共通テストユーティリティ

## 移行ガイド

既存の実装からリファクタリング版への移行：

1. **API互換性**: 公開APIは完全に互換性を保持
2. **パフォーマンス向上**: 深度計算の最適化により、部分木監視が大幅に高速化
3. **メモリ効率**: 適切なクリーンアップによりメモリリークが解消
4. **テスト性**: モジュラー設計により単体テストが容易

## 今後の拡張予定

1. **キャッシュ機能**: 祖先パス情報のメモ化
2. **イベント配信最適化**: targeted event routing の実装
3. **監視機能**: より詳細なリソース使用量追跡
4. **設定可能性**: サブスクリプション制限などの動的設定