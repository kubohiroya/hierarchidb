import type { FileLike, TabularChunk, TabularSchema } from './types.js';

export interface TabularIngestContext {
  filename?: string;
  sizeBytes?: number;
  source?: FileLike;
  format?: string;
}

export interface TabularIngestSession {
  id: string;
}

export interface TabularIngestSummary {
  totalRows: number;
  chunkCount: number;
}

export interface TabularIngestResult<TMeta = unknown> {
  session: TabularIngestSession;
  metadata: TMeta;
}

export interface TabularStorePort<TMeta = unknown> {
  beginIngest(schema: TabularSchema, ctx: TabularIngestContext): Promise<TabularIngestSession>;

  writeChunk(session: TabularIngestSession, chunk: TabularChunk): Promise<void>;

  commit(
    session: TabularIngestSession,
    summary: TabularIngestSummary
  ): Promise<TabularIngestResult<TMeta>>;

  abort(session: TabularIngestSession, reason?: string): Promise<void>;
}
