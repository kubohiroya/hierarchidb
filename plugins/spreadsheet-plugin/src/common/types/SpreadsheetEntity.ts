import type { BaseEntity, NodeId, Timestamp } from '@hierarchidb/common-types';
import type { PeerDataBase, DraftBase } from '@hierarchidb/plugin-service-api';
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

export interface SpreadsheetEntity extends BaseEntity<NodeId> {
  nodeId: NodeId;
  spreadsheetMetadataId?: string;
  dataSource?: SpreadSheetDataSourceConfig;
  filters?: TabularFilterRule[];
}

export interface SpreadsheetDraft extends DraftBase<SpreadsheetEntity> {
  spreadsheetMetadataId?: string;
  dataSource?: SpreadSheetDataSourceConfig;
  filters?: TabularFilterRule[];
  lastPreview?: TabularDataResult;
  file?: UploadedFileSummary;
}

export type SpreadsheetDialogData = Partial<SpreadsheetDraft> & {
  metadata?: TabularTableMetadata | null;
};

export interface SpreadsheetPeerData extends PeerDataBase {
  schemaVersion: 1;
  metadataId?: string;
  lastReferencedAt?: Timestamp;
}
