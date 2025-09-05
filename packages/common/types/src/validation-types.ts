import { PeerEntity } from './entity-types';

// バリデーションエラーの型
export type ValidationErrors<T> = {
  [K in keyof T]?: string;
};

// バリデーション結果の型
export type ValidationResult = { valid: true } | { valid: false; message: string };

export interface ValidationRule<TEntity extends PeerEntity = PeerEntity> {
  name: string;
  validate: (entity: TEntity) => ValidationResult | Promise<ValidationResult>;
  getMessage?: (entity: TEntity) => string;
}

/**
 * バリデーション関数の型定義
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
