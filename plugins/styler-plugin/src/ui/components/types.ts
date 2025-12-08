/**
 * Type definitions for Styler components
 */
export type {
  StylerDialogData,
  StylerStepData,
  StyleType,
  MapLibreStyleProperty,
  MapLibrePropertyMetadata,
} from '../../common/types/stylerTypes.js';
export { MAPLIBRE_PROPERTY_GROUPS, MAPLIBRE_PROPERTY_METADATA } from '../../common/types/stylerTypes.js';

/** Column mapping configuration */
export interface ColumnMapping {
  key: string;
  value: string;
  included?: boolean;
  sourceColumn?: string;
  targetColumn?: string;
}

/** Extended column mapping for detailed configuration */
export interface ExtendedColumnMapping extends ColumnMapping {
  included: boolean;
  sourceColumn: string;
  targetColumn: string;
  transformFunction?: string;
  defaultValue?: string | number | boolean | null;
}
