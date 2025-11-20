import type { BaseEntity, NodeId, Timestamp } from '@hierarchidb/common-types';
import type { PeerDataBase, WorkingCopyDraft } from '@hierarchidb/plugin-service-api';
import type { CSVFilterRule, CSVDataResult } from '@hierarchidb/ui-tabular-extract';
import type { CSVTableMetadata } from '@hierarchidb/tabular-store';
import { DATA_SOURCE_TYPES } from '../constants.js';

export type DataSourceType = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES];

export interface UploadedFileSummary {
  name: string;
  sizeBytes: number;
  type?: string;
  lastModifiedAt?: Timestamp;
}

export interface DataSourceConfig {
  type: DataSourceType;
  source?: string;
  filename?: string;
  sizeBytes?: number;
  contentHash?: string;
}

export interface SpreadsheetEntity extends BaseEntity<NodeId> {
  nodeId: NodeId;
  spreadsheetMetadataId?: string;
  dataSource?: DataSourceConfig;
  filters?: CSVFilterRule[];
}

export interface SpreadsheetWorkingCopy extends WorkingCopyDraft<SpreadsheetEntity> {
  spreadsheetMetadataId?: string;
  dataSource?: DataSourceConfig;
  filters?: CSVFilterRule[];
  lastPreview?: CSVDataResult;
  file?: UploadedFileSummary;
}

export type SpreadsheetDialogData = Partial<SpreadsheetWorkingCopy> & {
  metadata?: CSVTableMetadata | null;
};

export interface SpreadsheetPeerData extends PeerDataBase {
  schemaVersion: 1;
  metadataId?: string;
  lastReferencedAt?: Timestamp;
}
