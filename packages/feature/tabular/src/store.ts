import type { TabularSchema, TabularChunk } from './types';

export interface TabularIngestContext {
  filename?: string;
  sizeBytes?: number;
  source?: any; // File | Blob | ArrayBuffer | string (environment-specific)
  format?: string;
}

export interface TabularIngestSession {
  id: string;
}

export interface TabularIngestSummary {
  totalRows: number;
  chunkCount: number;
}

export interface TabularIngestResult<TMeta = any> {
  session: TabularIngestSession;
  metadata: TMeta;
}

export interface TabularStorePort<TMeta = any> {
  beginIngest(schema: TabularSchema, ctx: TabularIngestContext): Promise<TabularIngestSession>;
  writeChunk(session: TabularIngestSession, chunk: TabularChunk): Promise<void>;
  commit(session: TabularIngestSession, summary: TabularIngestSummary): Promise<TabularIngestResult<TMeta>>;
  abort(session: TabularIngestSession, reason?: string): Promise<void>;
}

