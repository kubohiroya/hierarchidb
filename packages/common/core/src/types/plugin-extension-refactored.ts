/**
 * @file plugin-extension-refactored.ts
 * @description プラグイン拡張システムの型定義（リファクタリング版）
 * 【改善内容】: any型の削減、型制約の強化、インターフェース分離
 * 🟢 信頼性レベル: 設計文書とテストケースに基づいた改善実装
 */

import type { NodeTypeDefinition, NodeId, PeerEntity, WorkingCopyProperties } from './index';
import type { ComponentType } from 'react';

// ============================================================================
// 基本型定義
// ============================================================================

/**
 * Reactコンポーネントのプロパティ基底型
 */
export interface StepComponentProps {
  /** 現在のステップデータ */
  data: Record<string, unknown>;
  /** 次のステップへ進む */
  onNext: (data: Record<string, unknown>) => void;
  /** 前のステップへ戻る */
  onPrevious: () => void;
  /** エラーメッセージリスト */
  errors?: string[];
  /** ローディング状態 */
  isLoading?: boolean;
}

/**
 * ステップコンポーネントの型定義
 * React.ComponentTypeを使用して型安全性を向上
 */
export type StepComponent = ComponentType<StepComponentProps>;

/**
 * バリデーション結果の型定義
 */
export interface ValidationResult {
  /** バリデーション成功/失敗 */
  isValid: boolean;
  /** エラーメッセージリスト */
  errors: string[];
  /** 警告メッセージリスト（オプション） */
  warnings?: string[];
}

/**
 * バリデーション関数の型定義
 */
export type ValidationFunction<T = unknown> = (
  data: T
) => Promise<ValidationResult> | ValidationResult;

/**
 * ステップバリデーションの型定義
 */
export interface StepValidation<T = unknown> {
  /** バリデーション関数 */
  validate: ValidationFunction<T>;
  /** バリデーションをスキップする条件（オプション） */
  skipIf?: (data: T) => boolean;
}

// ============================================================================
// ステップ定義
// ============================================================================

/**
 * ダイアログステップの定義
 */
export interface DialogStepDefinition<T = unknown> {
  /** ステップ番号（1始まり） */
  stepNumber: number;
  /** ステップタイトル */
  title: string;
  /** ステップの説明（オプション） */
  description?: string;
  /** レンダリングするコンポーネント */
  component: StepComponent;
  /** データ検証ロジック */
  validation?: StepValidation<T>;
  /** 依存する他のステップ番号 */
  dependsOn?: number[];
  /** スキップ可能かどうか */
  isOptional?: boolean;
  /** 条件によるスキップ可否 */
  canSkip?: (data: T) => boolean;
  /** ステップアイコン（オプション） */
  icon?: string | ComponentType;
}

// ============================================================================
// フィールド定義
// ============================================================================

/**
 * フィールドの型種別
 */
export type FieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'enum' 
  | 'array' 
  | 'object';

/**
 * フィールドバリデーションルール
 */
export interface FieldValidation {
  /** 正規表現パターン（string型用） */
  pattern?: RegExp;
  /** 最大文字数（string型用） */
  maxLength?: number;
  /** 最小文字数（string型用） */
  minLength?: number;
  /** 最小値（number/date型用） */
  min?: number | Date;
  /** 最大値（number/date型用） */
  max?: number | Date;
  /** 列挙値（enum型用） */
  enum?: readonly unknown[];
  /** カスタムバリデーション関数 */
  custom?: ValidationFunction;
}

/**
 * 拡張フィールドの定義
 */
export interface ExtendedFieldDefinition {
  /** フィールド識別子 */
  name: string;
  /** データ型 */
  type: FieldType;
  /** 必須フィールドか */
  required?: boolean;
  /** UI表示ラベル */
  label?: string;
  /** フィールドの説明 */
  description?: string;
  /** デフォルト値 */
  defaultValue?: unknown;
  /** バリデーションルール */
  validation?: FieldValidation;
  /** UIヒント（入力タイプなど） */
  uiHint?: string;
  /** 読み取り専用か */
  readonly?: boolean;
}

// ============================================================================
// バリデーション拡張
// ============================================================================

/**
 * バリデーションルール
 */
export interface ValidationRule {
  /** ルール名 */
  name: string;
  /** 検証関数 */
  validate: ValidationFunction;
  /** エラーメッセージ */
  message: string;
  /** 優先度（低い値が先に実行） */
  priority?: number;
}

/**
 * バリデーションチェーンモード
 */
export type ValidationChainMode = 'all' | 'stopOnFirst';

/**
 * バリデーションマージ戦略
 */
export type ValidationMergeStrategy = 'override' | 'append' | 'prepend';

/**
 * バリデーション拡張の定義
 */
export interface ValidationExtension {
  /** 拡張バリデーションルール */
  extendedRules: Record<string, ValidationRule>;
  /** チェーンモード */
  chainMode?: ValidationChainMode;
  /** マージ戦略 */
  mergeStrategy?: ValidationMergeStrategy;
}

// ============================================================================
// 基底定義
// ============================================================================

/**
 * 基底フィールド名の型
 */
export type BaseFieldName = 'name' | 'description' | string;

/**
 * 基底バリデーションルール
 */
export interface BaseValidationRules {
  /** 名前パターン */
  namePattern?: RegExp;
  /** 名前最大長 */
  nameMaxLength?: number;
  /** 説明最大長 */
  descriptionMaxLength?: number;
  /** 必須フィールド */
  required?: BaseFieldName[];
  /** 追加ルール */
  additionalRules?: ValidationRule[];
}

/**
 * 基底ダイアログコンポーネントのプロパティ
 */
export interface BaseDialogProps {
  /** 初期データ */
  initialData?: Record<string, unknown>;
  /** 送信ハンドラ */
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  /** キャンセルハンドラ */
  onCancel: () => void;
  /** 開閉状態 */
  open: boolean;
}

/**
 * 基底プラグインの定義
 */
export interface BaseNodeDefinition<_TEntity = any> {
  /** 基底フィールド名リスト */
  baseFields: BaseFieldName[];
  /** 基底バリデーションルール */
  baseValidation: BaseValidationRules;
  /** 基底ダイアログコンポーネント */
  baseDialog: ComponentType<BaseDialogProps>;
  /** 拡張フィールド */
  extendedFields?: ExtendedFieldDefinition[];
  /** 拡張ステップ */
  extendedSteps?: DialogStepDefinition[];
  /** 拡張バリデーション */
  extendedValidation?: ValidationExtension;
}

// ============================================================================
// メタデータ
// ============================================================================

/**
 * セマンティックバージョニング文字列
 */
export type SemanticVersion = `${number}.${number}.${number}`;

/**
 * バージョン互換性指定
 */
export type VersionCompatibility = 
  | SemanticVersion 
  | `^${SemanticVersion}` 
  | `~${SemanticVersion}`;

/**
 * ステップマージ情報
 */
export interface MergedStepInfo {
  /** 提供元プラグイン */
  from: string;
  /** ステップ番号 */
  stepNumber: number;
  /** オーバーライドされたか */
  overridden?: boolean;
}

/**
 * フィールドマージ情報
 */
export interface MergedFieldInfo {
  /** 提供元プラグイン */
  from: string;
  /** フィールド名リスト */
  fields: string[];
  /** オーバーライドされたフィールド */
  overridden?: string[];
}

/**
 * プラグイン拡張メタデータ
 */
export interface ExtensionMetadata {
  /** 継承元プラグイン */
  extends: string;
  /** プラグインバージョン */
  version: SemanticVersion;
  /** 依存プラグインの互換性 */
  compatibleWith: Record<string, VersionCompatibility>;
  /** 継承チェーン */
  inheritanceChain: string[];
  /** マージされたステップ情報 */
  mergedSteps: MergedStepInfo[];
  /** マージされたフィールド情報 */
  mergedFields: MergedFieldInfo[];
  /** 作成日時 */
  createdAt?: number;
  /** 更新日時 */
  updatedAt?: number;
}

// ============================================================================
// エンティティ拡張
// ============================================================================

/**
 * エンティティ拡張の契約
 */
export interface BaseEntityExtension<TBase, TExtended extends TBase> {
  /** 拡張データ取得 */
  getExtendedData: (nodeId: NodeId) => Promise<Partial<TExtended>>;
  /** 拡張データ保存 */
  saveExtendedData: (nodeId: NodeId, data: Partial<TExtended>) => Promise<void>;
  /** 拡張前処理フック */
  beforeExtend?: (nodeId: NodeId) => Promise<void>;
  /** 拡張後処理フック */
  afterExtend?: (nodeId: NodeId, data: TExtended) => Promise<void>;
  /** データマイグレーション */
  migrateData?: (oldData: TBase) => Promise<TExtended>;
}

// ============================================================================
// ハンドラーとライフサイクル
// ============================================================================

/**
 * エンティティハンドラー基底インターフェース
 */
export interface EntityHandler<T> {
  /** エンティティ作成 */
  create: (nodeId: NodeId, data: Partial<T>) => Promise<T>;
  /** エンティティ取得 */
  get: (nodeId: NodeId) => Promise<T | undefined>;
  /** エンティティ更新 */
  update: (nodeId: NodeId, data: Partial<T>) => Promise<void>;
  /** エンティティ削除 */
  delete: (nodeId: NodeId) => Promise<void>;
}

/**
 * ライフサイクルフック
 */
export interface LifecycleHooks<T> {
  /** 作成前処理 */
  beforeCreate?: (nodeId: NodeId, data: Partial<T>) => Promise<void>;
  /** 作成後処理 */
  afterCreate?: (nodeId: NodeId, entity: T) => Promise<void>;
  /** 更新前処理 */
  beforeUpdate?: (nodeId: NodeId, oldData: T, newData: Partial<T>) => Promise<void>;
  /** 更新後処理 */
  afterUpdate?: (nodeId: NodeId, entity: T) => Promise<void>;
  /** 削除前処理 */
  beforeDelete?: (nodeId: NodeId, entity: T) => Promise<void>;
  /** 削除後処理 */
  afterDelete?: (nodeId: NodeId) => Promise<void>;
}

// ============================================================================
// プラグイン設定
// ============================================================================

/**
 * ステップ設定
 */
export interface StepConfiguration {
  /** 継承されたステップ */
  inherited: MergedStepInfo[];
  /** 拡張されたステップ */
  extended: Array<{
    stepNumber: number;
    title: string;
    component: StepComponent;
    validation?: StepValidation;
  }>;
}

/**
 * フィールド設定
 */
export interface FieldConfiguration {
  /** 継承されたフィールド名 */
  inherited: string[];
  /** 拡張されたフィールド名 */
  extended: string[];
}

/**
 * ハンドラー設定
 */
export interface HandlerConfiguration<TBase, TExtended> {
  /** 基底ハンドラー */
  base: EntityHandler<TBase>;
  /** 拡張ハンドラー */
  extended: EntityHandler<TExtended>;
}

/**
 * バリデーション設定
 */
export interface ValidationConfiguration {
  /** 基底バリデーション */
  base: BaseValidationRules;
  /** 拡張バリデーション */
  extended: ValidationExtension;
}

/**
 * プラグイン拡張設定
 */
export interface PluginExtensionConfig<TBase, TExtended extends TBase> {
  /** 基底プラグイン名 */
  basePlugin: string;
  /** 拡張プラグイン名 */
  extendedPlugin: string;
  /** ステップ設定 */
  steps: StepConfiguration;
  /** フィールド設定 */
  fields: FieldConfiguration;
  /** ハンドラー設定 */
  handlers: HandlerConfiguration<TBase, TExtended>;
  /** バリデーション設定 */
  validation: ValidationConfiguration;
  /** ライフサイクルフック */
  lifecycle: LifecycleHooks<TExtended>;
}

// ============================================================================
// 拡張可能ノードタイプ定義
// ============================================================================

/**
 * 拡張可能なノードタイプ定義
 */
export interface ExtendableNodeTypeDefinition<
  TBase extends PeerEntity,
  TExtended extends TBase,
  TWorkingCopy extends TExtended & WorkingCopyProperties
> extends Omit<NodeTypeDefinition<TExtended, never, TWorkingCopy>, 'entityHandler'> {
  /** 継承元プラグイン */
  extends: string;
  /** 拡張ステップ */
  extendedSteps?: DialogStepDefinition[];
  /** 拡張フィールド */
  extendedFields?: ExtendedFieldDefinition[];
  /** 拡張バリデーション */
  extendedValidation?: ValidationExtension;
  /** 基底定義（オプション） */
  baseDefinition?: NodeTypeDefinition<TBase, never, TBase & WorkingCopyProperties>;
  /** エンティティハンドラー拡張 */
  entityHandler?: EntityHandler<TExtended> & BaseEntityExtension<TBase, TExtended>;
  /** メタデータ */
  metadata?: ExtensionMetadata;
}

// ============================================================================
// ユーティリティ型
// ============================================================================

/**
 * 深い部分型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

/**
 * 必須キーの抽出
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * オプショナルキーの抽出
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * 拡張エンティティ型
 */
export type ExtendedEntity<TBase, TExtension> = TBase & TExtension;

// ============================================================================
// 型ガード
// ============================================================================

/**
 * DialogStepDefinition型ガード
 */
export function isDialogStepDefinition(value: unknown): value is DialogStepDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    'stepNumber' in value &&
    'title' in value &&
    'component' in value
  );
}

/**
 * ExtendedFieldDefinition型ガード
 */
export function isExtendedFieldDefinition(value: unknown): value is ExtendedFieldDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'type' in value
  );
}

/**
 * ValidationResult型ガード
 */
export function isValidationResult(value: unknown): value is ValidationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isValid' in value &&
    'errors' in value &&
    Array.isArray((value as any).errors)
  );
}