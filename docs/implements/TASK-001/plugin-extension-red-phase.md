# Plugin Extension System - Redフェーズ設計

## テスト設計概要

### 対象機能
プラグイン拡張システムの型定義（ExtendableNodeTypeDefinition）

### テストアプローチ
- TypeScriptの型システムを活用した型安全性の検証
- 実際のユースケース（folder→stylemap拡張）に基づいたテスト
- 継承関係と循環依存の検証

## 実装したテストケース

### 1. 基本構造テスト（3ケース）

#### 基本的なプラグイン拡張定義
- **信頼性**: 🟢 設計文書準拠
- **検証内容**: ExtendableNodeTypeDefinition型の基本プロパティ
- **重要性**: プラグイン拡張の中核機能

#### BaseNodeDefinition型
- **信頼性**: 🟢 設計文書準拠
- **検証内容**: 共通フィールド（name, description）の定義
- **重要性**: 全プラグインの基底となる共通要素

#### DialogStepDefinition型
- **信頼性**: 🟡 妥当な推測
- **検証内容**: マルチステップダイアログの構造
- **重要性**: UI拡張の基盤

### 2. 拡張要素テスト（3ケース）

#### ExtendedFieldDefinition型
- **信頼性**: 🟡 StyleMap要件から推測
- **検証内容**: プラグイン固有フィールドの追加
- **重要性**: データモデルの拡張性

#### ExtensionMetadata型
- **信頼性**: 🟡 アーキテクチャから推測
- **検証内容**: 継承関係とバージョン管理
- **重要性**: プラグイン間の依存関係管理

#### BaseEntityExtension型
- **信頼性**: 🟢 設計文書準拠
- **検証内容**: エンティティハンドラーの拡張契約
- **重要性**: データ操作の拡張性

### 3. 高度な機能テスト（4ケース）

#### ValidationExtension型
- **信頼性**: 🟡 一般的パターンから推測
- **検証内容**: バリデーションルールの拡張とチェーン
- **重要性**: データ整合性の保証

#### PluginExtensionConfig型
- **信頼性**: 🟢 設計文書の完全仕様
- **検証内容**: 全拡張要素の統合設定
- **重要性**: プラグイン設定の完全性

#### 循環依存検出
- **信頼性**: 🔴 エラーハンドリングの推測
- **検証内容**: プラグイン間の循環参照検出
- **重要性**: システムの安定性

#### 継承チェーン構築
- **信頼性**: 🟡 設計から推測
- **検証内容**: 多層継承関係の解決
- **重要性**: プラグイン依存関係の明確化

## テストの品質評価

### 評価結果: ✅ 高品質

#### 評価項目
- ✅ **テスト実行**: TypeScriptコンパイラで検証可能
- ✅ **期待値**: 各テストケースに明確な期待値を定義
- ✅ **アサーション**: 適切なexpect文を使用
- ✅ **実装方針**: 型定義の要件が明確

#### 信頼性分布
- 🟢 青信号: 4ケース（40%）- 設計文書に基づく
- 🟡 黄信号: 5ケース（50%）- 妥当な推測
- 🔴 赤信号: 1ケース（10%）- 独自推測

## 実装への要求事項

### 必須実装項目

1. **型定義ファイル作成**
   - `packages/common/core/src/types/plugin-extension.ts`

2. **基本型定義**
   - ExtendableNodeTypeDefinition<TBase, TExtended, TWorkingCopy>
   - BaseNodeDefinition<TEntity>
   - DialogStepDefinition
   - ExtendedFieldDefinition

3. **拡張型定義**
   - ExtensionMetadata
   - BaseEntityExtension<TBase, TExtended>
   - ValidationExtension
   - PluginExtensionConfig

4. **補助型定義**
   - StepComponent
   - StepValidation
   - ValidationResult

### 型安全性要件

- ジェネリック制約による型推論
- 継承関係の型チェック
- 循環依存の防止メカニズム

### 実装優先順位

1. 基本型定義（ExtendableNodeTypeDefinition等）
2. ステップ関連型（DialogStepDefinition等）
3. 拡張メカニズム型（BaseEntityExtension等）
4. メタデータ・設定型（ExtensionMetadata等）

## 次のステップ

### 推奨コマンド
```
/tdd-green
```

Greenフェーズで最小限の型定義実装を行い、全てのテストを通過させます。