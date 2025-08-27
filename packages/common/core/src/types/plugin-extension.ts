/**
 * @file plugin-extension.ts
 * @description プラグイン拡張システムの型定義
 * 【機能概要】: プラグインが他のプラグインを継承・拡張するための型システム
 * 【実装方針】: テストケースを通すために必要な最小限の型定義を提供
 * 【テスト対応】: plugin-extension.test.ts の全テストケースを通すための実装
 * 🟢 信頼性レベル: 設計文書とテストケースに基づいた実装
 */

import type { NodeTypeDefinition, NodeId, PeerEntity } from './index';

/**
 * 【機能概要】: ステップコンポーネントの型定義
 * 【実装方針】: Reactコンポーネントとして最小限の構造を定義
 * 【テスト対応】: DialogStepDefinitionで使用されるコンポーネント型
 * 🟡 信頼性レベル: 一般的なReactコンポーネント型から推測
 */
export interface StepComponent {
  // 【最小限実装】: テストを通すための空インターフェース
  // 【将来拡張】: Refactorフェーズで具体的なReactコンポーネント型を定義予定
  [key: string]: any;
}

/**
 * 【機能概要】: バリデーション結果の型定義
 * 【実装方針】: バリデーション成功/失敗とエラーメッセージを管理
 * 【テスト対応】: StepValidationの戻り値型として使用
 * 🟢 信頼性レベル: テストケースから直接導出
 */
export interface ValidationResult {
  // 【バリデーション結果】: trueなら成功、falseなら失敗
  isValid: boolean;
  // 【エラーメッセージ】: バリデーション失敗時のエラー詳細
  errors: string[];
}

/**
 * 【機能概要】: ステップバリデーションの型定義
 * 【実装方針】: 各ステップのデータ検証ロジックを定義
 * 【テスト対応】: DialogStepDefinitionのvalidationプロパティ
 * 🟢 信頼性レベル: テストケースから直接導出
 */
export interface StepValidation {
  // 【バリデーション関数】: ステップデータを検証して結果を返す
  validate: (data: any) => Promise<ValidationResult> | ValidationResult;
}

/**
 * 【機能概要】: ダイアログステップの定義
 * 【実装方針】: マルチステップダイアログの各ステップ構造を表現
 * 【テスト対応】: ファイルアップロード等の拡張ステップ定義で使用
 * 🟢 信頼性レベル: テストケースとStyleMap要件から導出
 */
export interface DialogStepDefinition {
  // 【ステップ番号】: ダイアログ内での表示順序
  stepNumber: number;
  // 【ステップタイトル】: UIに表示されるステップ名
  title: string;
  // 【ステップコンポーネント】: 実際にレンダリングされるReactコンポーネント
  component: StepComponent;
  // 【バリデーション】: このステップのデータ検証ロジック
  validation?: StepValidation;
  // 【依存関係】: このステップが依存する他のステップ番号
  dependsOn?: number[];
  // 【オプショナル】: このステップをスキップ可能かどうか
  isOptional?: boolean;
  // 【スキップ可能】: 条件によってこのステップを飛ばせるか
  canSkip?: boolean;
}

/**
 * 【機能概要】: 拡張フィールドの定義
 * 【実装方針】: プラグインが追加する独自フィールドの構造
 * 【テスト対応】: keyColumn, valueColumn等の拡張フィールド定義
 * 🟢 信頼性レベル: テストケースから直接導出
 */
export interface ExtendedFieldDefinition {
  // 【フィールド名】: データモデル内でのフィールド識別子
  name: string;
  // 【フィールド型】: データ型（string, number, boolean等）
  type: string;
  // 【必須フラグ】: このフィールドが必須かどうか
  required?: boolean;
  // 【表示ラベル】: UIに表示される人間可読なラベル
  label?: string;
  // 【説明文】: フィールドの用途や目的の説明
  description?: string;
  // 【バリデーション】: フィールド固有の検証ルール
  validation?: {
    pattern?: RegExp;
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
  };
}

/**
 * 【機能概要】: 基底プラグインの定義
 * 【実装方針】: 全プラグインが継承する共通要素を定義
 * 【テスト対応】: name, description等の共通フィールド定義
 * 🟢 信頼性レベル: 設計文書とテストケースから導出
 */
export interface BaseNodeDefinition<_TEntity = any> {
  // 【基底フィールド】: 全プラグインが持つ共通フィールド名
  baseFields: string[];
  // 【基底バリデーション】: 共通フィールドの検証ルール
  baseValidation: {
    namePattern?: RegExp;
    nameMaxLength?: number;
    descriptionMaxLength?: number;
    required?: string[];
    [key: string]: any;
  };
  // 【基底ダイアログ】: 共通フィールド入力用のダイアログコンポーネント
  baseDialog: any;
  // 【拡張ポイント】: プラグイン固有の拡張要素
  extendedFields?: ExtendedFieldDefinition[];
  extendedSteps?: DialogStepDefinition[];
  extendedValidation?: ValidationExtension;
}

/**
 * 【機能概要】: バリデーション拡張の定義
 * 【実装方針】: プラグインが追加するバリデーションルール
 * 【テスト対応】: fileFormat, columnSelection等の拡張検証
 * 🟡 信頼性レベル: テストケースから推測した構造
 */
export interface ValidationExtension {
  // 【拡張ルール】: プラグイン固有のバリデーションルール定義
  extendedRules: {
    [ruleName: string]: {
      validate: (value: any) => boolean | Promise<boolean>;
      message: string;
    };
  };
  // 【チェーンモード】: 全ルール適用 or 最初のエラーで停止
  chainMode?: 'all' | 'stopOnFirst';
  // 【マージ戦略】: 基底ルールとの統合方法
  mergeStrategy?: 'override' | 'append' | 'prepend';
}

/**
 * 【機能概要】: プラグイン拡張メタデータ
 * 【実装方針】: プラグイン間の継承関係とバージョン情報を管理
 * 【テスト対応】: 継承チェーン、マージ情報の管理
 * 🟡 信頼性レベル: テストケースとアーキテクチャから推測
 */
export interface ExtensionMetadata {
  // 【継承元】: 基底となるプラグイン名
  extends: string;
  // 【バージョン】: このプラグインのバージョン
  version: string;
  // 【互換性】: 依存プラグインのバージョン制約
  compatibleWith: {
    [pluginName: string]: string;
  };
  // 【継承チェーン】: ルートから現在までのプラグイン名リスト
  inheritanceChain: string[];
  // 【マージステップ】: 統合されたステップ情報
  mergedSteps: Array<{
    from: string;
    stepNumber: number;
  }>;
  // 【マージフィールド】: 統合されたフィールド情報
  mergedFields: Array<{
    from: string;
    fields: string[];
  }>;
}

/**
 * 【機能概要】: エンティティ拡張の契約
 * 【実装方針】: エンティティハンドラーの拡張メソッドを定義
 * 【テスト対応】: getExtendedData, saveExtendedData等の実装
 * 🟢 信頼性レベル: 設計文書とテストケースから導出
 */
export interface BaseEntityExtension<_TBase = any, TExtended = any> {
  // 【拡張データ取得】: プラグイン固有データの読み込み
  getExtendedData: (nodeId: NodeId) => Promise<Partial<TExtended>>;
  // 【拡張データ保存】: プラグイン固有データの永続化
  saveExtendedData: (nodeId: NodeId, data: Partial<TExtended>) => Promise<void>;
  // 【拡張前フック】: データ拡張前の処理
  beforeExtend?: (nodeId: NodeId) => Promise<void>;
  // 【拡張後フック】: データ拡張後の処理
  afterExtend?: (nodeId: NodeId) => Promise<void>;
}

/**
 * 【機能概要】: プラグイン拡張設定
 * 【実装方針】: プラグイン拡張の完全な設定構造
 * 【テスト対応】: 全拡張要素を統合した設定オブジェクト
 * 🟢 信頼性レベル: テストケースから直接導出
 */
export interface PluginExtensionConfig {
  // 【基底プラグイン】: 継承元のプラグイン名
  basePlugin: string;
  // 【拡張プラグイン】: 拡張を行うプラグイン名
  extendedPlugin: string;
  // 【ステップ構成】: 継承・拡張されたステップ情報
  steps: {
    inherited: Array<{
      stepNumber: number;
      from: string;
      override?: boolean;
    }>;
    extended: Array<{
      stepNumber: number;
      title: string;
      component: any;
    }>;
  };
  // 【フィールド構成】: 継承・拡張されたフィールド情報
  fields: {
    inherited: string[];
    extended: string[];
  };
  // 【ハンドラー構成】: 基底・拡張ハンドラー
  handlers: {
    base: any;
    extended: any;
  };
  // 【バリデーション構成】: 基底・拡張バリデーション
  validation: {
    base: any;
    extended: any;
  };
  // 【ライフサイクル】: プラグインのライフサイクルフック
  lifecycle: {
    beforeCreate?: () => Promise<void>;
    afterCreate?: () => Promise<void>;
    beforeUpdate?: () => Promise<void>;
    afterUpdate?: () => Promise<void>;
  };
}

/**
 * 【機能概要】: 拡張可能なノードタイプ定義
 * 【実装方針】: プラグインが他プラグインを継承可能にする中核型
 * 【テスト対応】: folder→stylemap拡張等のユースケース
 * 🟢 信頼性レベル: 設計文書の中核仕様
 */
export interface ExtendableNodeTypeDefinition<_TBase extends PeerEntity = any, _TExtended = any, _TWorkingCopy = any> {
  // 【継承元】: 基底となるプラグインのnodeType
  extends: string;
  // 【ノードタイプ】: このプラグインのnodeType
  nodeType: string;
  // 【プラグイン名】: 人間可読なプラグイン名
  name: string;
  // 【表示名】: UIに表示される名前
  displayName: string;
  // 【拡張ステップ】: 追加するダイアログステップ
  extendedSteps?: DialogStepDefinition[];
  // 【拡張フィールド】: 追加するデータフィールド
  extendedFields?: ExtendedFieldDefinition[];
  // 【拡張バリデーション】: 追加する検証ルール
  extendedValidation?: ValidationExtension;
  // 【基底定義】: 継承する基底プラグインの定義（オプション）
  baseDefinition?: NodeTypeDefinition<_TBase, never, any>;
  // 【ステップ拡張】: より詳細なステップ拡張定義（将来用）
  stepExtensions?: any[];
}