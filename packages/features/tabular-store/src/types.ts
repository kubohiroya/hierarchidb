export type TabularColumnType = 'string' | 'number' | 'boolean' | 'date';

export interface TabularColumnInfo {
  name: string;
  index?: number;
  type?: TabularColumnType;
  uniqueValues?: number;
  hasNullValues?: boolean;
  sampleValues?: (string | number)[];
}

export interface TabularTableMetadata {
  id: string;
  filename: string;
  fileUrl?: string;
  contentHash: string;
  fileSizeBytes: number;
  totalRows: number;
  columns: TabularColumnInfo[];
  createdAt: number;
  updatedAt?: number;
  referenceCount: number;
  referencingPlugins: string[];
  isChunked?: boolean;
  chunkCount?: number;
}

export type TabularTableMetadataLike = Partial<TabularTableMetadata> & {
  id: string;
  referencingPlugins?: string[];
  referenceCount?: number;
  filename?: string;
  columns?: TabularColumnInfo[];
  totalRows?: number;
  fileSizeBytes?: number;
  createdAt?: number;
  contentHash?: string;
};
