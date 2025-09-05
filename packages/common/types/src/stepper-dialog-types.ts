/**
 * @file stepper-base-dialog-lifecycle-types.ts
 * @description プラグイン拡張システムの基本型定義
 */

//import type { ComponentType } from 'provider';

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
//export type StepComponent = ComponentType<StepComponentProps>;

/**
 * 基底フィールド名の型
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
