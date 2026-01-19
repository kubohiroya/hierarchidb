/** Column mapping configuration */
export interface ColumnMapping {
  key: string;
  value: string;
  included?: boolean;
  sourceColumn?: string;
  targetColumn?: string;
}
