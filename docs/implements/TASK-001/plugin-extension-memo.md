# TDD開発メモ: Plugin Extension System

## 概要

- 機能名: プラグイン拡張システム型定義
- 開発開始: 2024-12-20
- 現在のフェーズ: Green

## 関連ファイル

- 元タスクファイル: `docs/tasks/plugin-extension-tasks.md`
- 要件定義: `docs/implements/TASK-001/plugin-extension-requirements.md`
- テストケース定義: `docs/implements/TASK-001/plugin-extension-testcases.md`
- 実装ファイル: `packages/common/core/src/types/types.ts`
- テストファイル: `packages/common/core/src/types/plugin-extension.test.ts`

## Redフェーズ（失敗するテスト作成）

### 作成日時

2024-12-20

### テストケース

1. **基本的なプラグイン拡張定義を作成できること**
   - ExtendableNodeTypeDefinition型の基本構造検証
   - extends, nodeType, extendedStepsプロパティの確認

2. **BaseNodeDefinition型が基底プラグインの共通フィールドを定義できること**
   - name, descriptionフィールドの定義
   - 基本バリデーションルールの設定

3. **DialogStepDefinition型が多段階ダイアログのステップを定義できること**
   - ステップの順序と依存関係
   - バリデーション機能の統合

4. **ExtendedFieldDefinition型が拡張フィールドを定義できること**
   - プラグイン固有フィールドの追加
   - フィールドレベルバリデーション

5. **ExtensionMetadata型がプラグイン継承メタデータを保持できること**
   - 継承チェーン情報
   - バージョン互換性管理

6. **BaseEntityExtension型がエンティティ拡張契約を定義できること**
   - getExtendedData/saveExtendedDataメソッド
   - ライフサイクルフック

7. **ValidationExtension型がバリデーションルールを拡張できること**
   - 拡張バリデーションルール
   - チェーンモードとマージ戦略

8. **PluginExtensionConfig型が完全な拡張設定を定義できること**
   - 全拡張要素の統合設定
   - ステップ、フィールド、ハンドラーの完全定義

9. **循環依存を検出できること**
   - プラグイン間の循環参照検出
   - エラーハンドリング

10. **プラグインの継承チェーンを構築できること**
    - ルートから現在プラグインまでのパス構築
    - 複数層の継承関係処理

### テストコード

上記のテストファイルに10個のテストケースを実装済み。各テストには：
- 日本語による詳細なコメント
- Given-When-Thenパターンの構造
- 信頼性レベル表示（🟢青信号、🟡黄信号、🔴赤信号）

### 期待される失敗

現時点では`types.ts`ファイルが存在しないため、以下のエラーが発生する：

```
Error: Cannot find module './plugin-extension'
```

各型定義（ExtendableNodeTypeDefinition、BaseNodeDefinition、DialogStepDefinition等）が未定義のため、TypeScriptコンパイルエラーも発生。

### 次のフェーズへの要求事項

Greenフェーズで実装すべき内容：

1. `packages/common/core/src/types/types.ts`ファイルの作成
2. 以下の型定義の実装：
   - ExtendableNodeTypeDefinition
   - BaseNodeDefinition
   - DialogStepDefinition
   - ExtendedFieldDefinition
   - ExtensionMetadata
   - BaseEntityExtension
   - ValidationExtension
   - PluginExtensionConfig
   - StepComponent
   - StepValidation

3. 型の相互関係と継承構造の定義
4. ジェネリック制約による型安全性の確保

## Greenフェーズ（最小実装）

### 実装日時

2024-12-20

### 実装方針

テストを通すための最小限の型定義実装。複雑な型制約や詳細な実装は後のRefactorフェーズで改善予定。

### 実装コード

`packages/common/core/src/types/types.ts`に以下を実装：

1. **基本型定義**
   - StepComponent: Reactコンポーネントの最小定義
   - ValidationResult: バリデーション結果型
   - StepValidation: ステップ検証インターフェース

2. **中核型定義**
   - DialogStepDefinition: マルチステップダイアログの各ステップ構造
   - ExtendedFieldDefinition: プラグイン固有フィールド定義
   - BaseNodeDefinition: 基底プラグインの共通要素

3. **拡張型定義**
   - ValidationExtension: バリデーションルール拡張
   - ExtensionMetadata: プラグイン継承メタデータ
   - BaseEntityExtension: エンティティハンドラー拡張契約

4. **統合型定義**
   - PluginExtensionConfig: 完全な拡張設定
   - ExtendableNodeTypeDefinition: 拡張可能ノードタイプの中核型

### テスト結果

```
✓ src/types/plugin-extension.test.ts (10 tests) 4ms

Test Files  1 passed (1)
     Tests  10 passed (10)
```

全10個のテストケースが通過。実装は成功。

### 課題・改善点

Refactorフェーズで改善すべき点：

1. **型の厳密化**
   - StepComponentを具体的なReactコンポーネント型に
   - any型の使用を削減
   - ジェネリック制約の追加

2. **インターフェースの分離**
   - 800行を超えたらファイル分割を検討
   - 責任範囲の明確化

3. **バリデーション強化**
   - 型レベルでの循環依存防止
   - 必須プロパティの型制約

4. **ドキュメント改善**
   - より詳細なJSDocコメント
   - 使用例の追加