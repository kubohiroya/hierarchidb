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

export type ValidationFunction<T = unknown> = (
  data: T
) => Promise<ValidationResult> | ValidationResult;

export type StepValidation = () => boolean | Promise<boolean>;
