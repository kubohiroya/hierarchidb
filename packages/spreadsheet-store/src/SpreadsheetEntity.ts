import type { PeerEntity, Timestamp } from '@hierarchidb/core-types';
import type { TabularFilterRule, TabularDataResult, TabularProcessingConfig } from '@hierarchidb/ui-tabular';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';

export type DataSourceType = 'file' | 'url';

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

export interface SpreadsheetEntityPayload {
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

export type SpreadsheetEntity = PeerEntity<SpreadsheetEntityPayload>;
