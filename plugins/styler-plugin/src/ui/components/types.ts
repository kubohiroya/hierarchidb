/**
 * Type definitions for Styler components
 */
import type { SpreadsheetDialogData } from '@hierarchidb/spreadsheet-plugin';
import type { StylerEntity } from '../../common/types/StylerEntity.js';

export type StyleType = 'point' | 'line' | 'polygon' | 'raster';

export interface StyleSettingsData {
  styleType?: StyleType;
  colorScheme?: string;
  dataSource?: string;
  styleTags?: string[];
}

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

export type StylerDialogData = Omit<SpreadsheetDialogData, 'metadata'> &
  Partial<StylerEntity> & {
    spreadsheetMetadata?: SpreadsheetDialogData['metadata'];
    basicInfo?: {
      name?: string;
      description?: string;
      tags?: string[];
    };
    name?: string;
    description?: string;
    tags?: string[];
    styleSettings?: StyleSettingsData;
  };
