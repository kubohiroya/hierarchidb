/**
 * @file base-types.ts
 * @description プラグイン拡張システムの基本型定義
 */

import type { ComponentType } from 'react';

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

/**
 * 基底フィールド名の型
 */
export type BaseFieldName = 'name' | 'description' | string;

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