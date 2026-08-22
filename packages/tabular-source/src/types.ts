// Note: Keep this file free of workspace type imports to extract stage

export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'null' | 'unknown';

export interface TabularColumnSpec {
  name: string;
  type?: ColumnType;
}

export interface TabularSchema {
  columns: TabularColumnSpec[];
}

export type TabularValue =
  | string
  | number
  | boolean
  | null
  | readonly TabularValue[]
  | { readonly [key: string]: TabularValue };

export type TabularRow = Record<string, TabularValue>;

export interface TabularChunk<T = TabularRow> {
  rows: T[];
  index: number; // 0-based chunk index
  hasMore: boolean;
}

export interface TabularPreview<T = TabularRow> {
  schema: TabularSchema;
  sample: T[]; // first N rows
  totalRows?: number;
}

export interface ParseOptions {
  delimiter?: string; // for Tabular/TSV
  header?: boolean; // first row as header (default true)
  encoding?: string; // text encoding hint
  chunkSize?: number; // target rows per chunk, default 1000
  dateDetection?: boolean;
  numberDetection?: boolean;
}

export type BinaryLike = ArrayBuffer | Uint8Array;
export type TextLike = string;
export type FileLike = { name?: string; type?: string } & (BinaryLike | TextLike | Blob);

export type DetectedFormat = 'csv' | 'tsv' | 'jsonl' | 'xlsx' | 'unknown';

export interface DetectionResult {
  format: DetectedFormat;
  confidence: number; // 0..1
  reason?: string;
}

export interface TabularDataProfile {
  columns: Array<{ name: string; type: ColumnType; nonNullCount: number }>;
  rowCount?: number;
}

export interface TabularParseResult<T = TabularRow> extends AsyncIterable<TabularChunk<T>> {
  preview: TabularPreview<T>;
}
