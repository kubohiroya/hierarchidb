export type CSVColumnType = 'string' | 'number' | 'boolean' | 'date';

export interface CSVColumnInfo {
  name: string;
  index?: number;
  type?: CSVColumnType;
  uniqueValues?: number;
  hasNullValues?: boolean;
  sampleValues?: (string | number)[];
}

export interface CSVTableMetadata {
  id: string;
  filename: string;
  fileUrl?: string;
  contentHash: string;
  fileSizeBytes: number;
  totalRows: number;
  columns: CSVColumnInfo[];
  createdAt: number;
  updatedAt?: number;
  referenceCount: number;
  referencingPlugins: string[];
  isChunked?: boolean;
  chunkCount?: number;
}

export type CSVTableMetadataLike = Partial<CSVTableMetadata> & {
  id: string;
  referencingPlugins?: string[];
  referenceCount?: number;
  filename?: string;
  columns?: CSVColumnInfo[];
  totalRows?: number;
  fileSizeBytes?: number;
  createdAt?: number;
  contentHash?: string;
};
