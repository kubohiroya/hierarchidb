export interface ShapeStepValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  data?: boolean;
  filters?: boolean;
  licenses?: boolean;
  processing?: boolean;
  processedData?: boolean;
  source?: boolean;
}
