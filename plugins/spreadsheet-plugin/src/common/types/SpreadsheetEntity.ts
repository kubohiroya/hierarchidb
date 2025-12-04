import type { Timestamp } from '@hierarchidb/common-types';
import type { TabularFilterRule, TabularDataResult } from '@hierarchidb/ui-tabular-extract';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { DATA_SOURCE_TYPES } from '../constants.js';

export type DataSourceType = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES];

export interface UploadedFileSummary {
  name: string;
  sizeBytes: number;
  type?: string;
  lastModifiedAt?: Timestamp;
}

export interface SpreadSheetDataSourceConfig {
  type: DataSourceType;
  source?: string;
  filename?: string;
  sizeBytes?: number;
  contentHash?: string;
}

export interface SpreadsheetEntity {
  spreadsheetMetadataId?: string;
  dataSource?: SpreadSheetDataSourceConfig;
  filters?: TabularFilterRule[];
  lastPreview?: TabularDataResult;
  file?: UploadedFileSummary;
  metadata?: TabularTableMetadata;
}
