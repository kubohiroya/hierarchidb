import type { StylerStepData, StylerTableRow } from '~/common/types/StylerEntity';

export interface StylerStepProps {
  data: StylerStepData;
  onChange: (data: StylerStepData) => void;
  onValidate?: (isValid: boolean) => void;
  nodeId?: string;
  //  Tabularspreadsheet
  tabularData?: StylerTableRow[];
  columns?: string[];
  errors?: string[];
  isSubmitting?: boolean;
}
