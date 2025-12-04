export interface ValidationResult {
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

export interface SelectionStats {
  totalSelected: number;
  countriesWithSelection: number;
  levelCounts: number[];
  estimatedSize: number;
  estimatedFeatures: number;
  estimatedProcessingTime: number;
}
