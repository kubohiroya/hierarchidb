import type { PeerEntity } from './entity-types.js';

export type ValidationErrors<T> = {
  [K in keyof T]?: string;
};

export type ValidationResult = { valid: true } | { valid: false; message: string };

export interface ValidationRule<TEntity extends PeerEntity = PeerEntity> {
  name: string;
  validate: (entity: TEntity) => ValidationResult | Promise<ValidationResult>;
  getMessage?: (entity: TEntity) => string;
}

/**
    */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export type ValidationFunction<T = unknown> = (
  data: T,
) => Promise<ValidationResult> | ValidationResult;

/**
    */
export interface StepValidation<T = unknown> {
  /**
      */
  validate: ValidationFunction<T>;
  /**
      */
  skipIf?: (data: T) => boolean;
}
