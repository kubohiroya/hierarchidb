export type ValidationErrors<T> = {
  [K in keyof T]?: string;
};

export type ValidationResult = { valid: true } | { valid: false; message: string };

export type ValidationFunction<T = unknown> = (
  data: T
) => Promise<ValidationResult> | ValidationResult;

export type StepValidation = () => boolean | Promise<boolean>;

export type ValidationRule<T = unknown> = ValidationFunction<T>;
