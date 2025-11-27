import type { StylerStepData, StylerTableRow } from '../../../common/types/stylerTypes.js';

export interface StylerStepProps {
  data: StylerStepData;
  onChange: (data: StylerStepData) => void;
  onValidate?: (isValid: boolean) => void;
  //  Tabularspreadsheet
  tabularData?: StylerTableRow[];
  columns?: string[];
  errors?: string[];
  isSubmitting?: boolean;
}
