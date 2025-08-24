# Plugin Shapes - Redフェーズ設計書

## 概要

TDD Redフェーズにおける失敗テストの実装内容を記録します。

## テスト実行環境

- **言語**: TypeScript 5.7.2
- **テストフレームワーク**: Vitest 2.1.8
- **モックライブラリ**: Vitest内蔵のvi
- **実行環境**: Node.js 20+

## テスト実行コマンド

```bash
# プラグインディレクトリに移動
cd packages/plugins/shapes

# テスト実行
pnpm test

# ウォッチモードで実行
pnpm test --watch

# カバレッジ付きで実行
pnpm test --coverage
```

## 期待される失敗メッセージ

### 初期状態（クラス未実装）

```
⨯ Cannot find module './ShapesEntityHandler' from 'src/handlers/ShapesEntityHandler.test.ts'
```

### クラス実装後（メソッド未実装）

```
⨯ ShapesEntityHandler › 正常系テストケース › TEST-001: 新規Shapesエンティティ作成の正常動作確認
  TypeError: handler.createEntity is not a function

⨯ ShapesEntityHandler › 正常系テストケース › TEST-002: 有効なGeoJSONファイルのインポート成功
  TypeError: handler.importGeoJSON is not a function

⨯ ShapesEntityHandler › 正常系テストケース › TEST-003: Working Copyによる安全な編集機能
  TypeError: handler.createWorkingCopy is not a function
```

## テスト設計の詳細

### 1. モック設計

#### データベースモック

```typescript
mockCoreDB = {
  table: vi.fn().mockReturnValue({
    add: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  })
};

mockEphemeralDB = {
  table: vi.fn().mockReturnValue({
    add: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  })
};
```

**設計意図**: 
- Dexieデータベースの実際の接続なしにテスト可能
- 各操作の呼び出しを検証可能
- テスト間の独立性を保証

### 2. テストデータ設計

#### 基本的なGeoJSONデータ

```typescript
const validGeojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[139.6917, 35.6595], ...]]
      },
      properties: { name: 'Shibuya', population: 230000 }
    }
  ]
};
```

**選択理由**:
- RFC 7946準拠の最小構造
- 実際の地理データ（渋谷区）を使用
- プロパティ含有でメタデータ処理も検証

### 3. アサーション設計

#### 詳細な検証ポイント

```typescript
// エンティティ作成の検証
expect(result.nodeId).toBe('shapes-001');
expect(result.geojsonData).toBe('{"type":"FeatureCollection","features":[]}');
expect(result.layerConfig).toEqual({
  visible: true,
  opacity: 0.8,
  zIndex: 1,
  interactive: true
});
```

**検証戦略**:
- 個別フィールドの厳密な検証
- デフォルト値の適用確認
- オブジェクト構造の完全性チェック

### 4. エラーケース設計

#### 異常系の網羅

1. **データ検証エラー**: 不正なGeoJSON形式
2. **リソース制限**: ファイルサイズ超過
3. **システムエラー**: Workerクラッシュ
4. **競合制御**: 同時編集防止

**設計方針**:
- ユーザーフレンドリーなエラーメッセージ
- エラーコードによる分類
- 復旧可能性の明示

### 5. 境界値テスト設計

#### パフォーマンス境界

```typescript
// 10,000個の図形要素
const features = Array.from({ length: 10000 }, (_, i) => ({
  type: 'Feature',
  geometry: { /* ... */ },
  properties: { id: i }
}));
```

**テスト意図**:
- システム限界での安定性確認
- パフォーマンス要件の検証
- メモリ使用量の監視

## 日本語コメントの設計指針

### コメント構造

1. **テスト目的**: 何を検証するかを明確に
2. **テスト内容**: 具体的な処理内容
3. **期待される動作**: 正常時の挙動
4. **信頼性レベル**: 🟢🟡🔴で元資料との対応を明示

### コメント例

```typescript
// 【テスト目的】: ShapesEntityHandler.createEntity()の基本動作を確認
// 【テスト内容】: 最小限の必須フィールドでエンティティを作成し、デフォルト値が適切に設定されることを検証
// 【期待される動作】: 空のGeoJSON FeatureCollectionでエンティティが作成され、デフォルトスタイルが適用される
// 🟢 信頼性レベル: 要件定義書REQ-001に明記された内容に基づく
```

**コメント設計の意図**:
- テストの意図を日本語で明確化
- 保守性の向上
- 要件とのトレーサビリティ確保

## 実装の優先順位

### Phase 1（最優先）
- TEST-001: エンティティ作成
- TEST-002: GeoJSONインポート
- TEST-003: Working Copy管理

### Phase 2（高優先）
- TEST-101: エラーハンドリング
- TEST-105: 競合制御

### Phase 3（中優先）
- TEST-201: パフォーマンス境界
- TEST-202: 最小データ処理
- TEST-203: 座標値境界

## 次のフェーズ（Green）への移行条件

1. **全テストが失敗すること**: TypeError or ReferenceError
2. **失敗理由が明確**: 未実装メソッドの特定
3. **テスト構造の完成**: Given-When-Thenパターン
4. **コメントの完備**: 日本語による説明

## 品質メトリクス

- **テストケース数**: 13件実装（目標10件以上達成）
- **カバレッジ範囲**: 
  - 正常系: 5件
  - 異常系: 4件
  - 境界値: 3件
- **信頼性レベル分布**:
  - 🟢 青信号: 11件（要件定義書に基づく）
  - 🟡 黄信号: 2件（妥当な推測）
  - 🔴 赤信号: 0件

## 課題と制約

1. **Worker実装の複雑性**: モックによる簡略化が必要
2. **非同期処理**: async/awaitの適切な使用
3. **型安全性**: TypeScript strictモードでの実装

## まとめ

Redフェーズでは、13件のテストケースを実装し、全てが期待通り失敗することを確認しました。各テストには詳細な日本語コメントを付与し、要件とのトレーサビリティを確保しています。次のGreenフェーズでは、これらのテストを通すための最小限の実装を行います。