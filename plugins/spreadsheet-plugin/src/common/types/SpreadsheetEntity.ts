import type { Timestamp } from '@hierarchidb/common-types';
import type { TabularFilterRule, TabularDataResult, TabularProcessingConfig } from '@hierarchidb/ui-tabular';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { DATA_SOURCE_TYPES } from '../constants.js';

export type DataSourceType = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES];

export interface UploadedFileSummary {
  name: string;
  sizeBytes: number;
  type?: string;
  lastModifiedAt?: Timestamp;
}

export interface SpreadSheetDataSourceType {
  type: DataSourceType;
  source?: string;
  filename?: string;
  sizeBytes?: number;
  contentHash?: string;
}

export interface SpreadsheetEntity {
  spreadsheetMetadataId?: string;
  dataSource?: SpreadSheetDataSourceType;
  filters?: TabularFilterRule[];
  lastPreview?: TabularDataResult;
  file?: UploadedFileSummary;
  tabularTableMetadata?: TabularTableMetadata;
  tabularProcessingConfig?: TabularProcessingConfig;
  keyColumn?: string;
  valueColumn?: string;
  /** Optional preview rows cache to reuse across steps (small subset) */
  previewRows?: Record<string, unknown>[];
}
