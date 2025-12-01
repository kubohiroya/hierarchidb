import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { TabularFilterRule, TabularDataResult } from '@hierarchidb/ui-tabular-extract';
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
  nodeId: NodeId;
  spreadsheetMetadataId?: string;
  dataSource?: SpreadSheetDataSourceConfig;
  filters?: TabularFilterRule[];
  lastPreview?: TabularDataResult;
  file?: UploadedFileSummary;
}

/*
export interface SpreadsheetPeerData extends PeerDataBase {
  schemaVersion: 1;
  metadataId?: string;
  lastReferencedAt?: Timestamp;
}
 */
