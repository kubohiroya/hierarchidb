import type {
  TabularStorePort,
  TabularIngestSession,
  TabularIngestSummary,
  TabularIngestResult,
  TabularSchema,
  TabularChunk,
} from '@hierarchidb/tabular';
import { SimpleTableMetadataManager } from './SimpleTableMetadataManager';
import { SpreadsheetDatabase } from '../database/SpreadsheetDatabase';
import type { CSVColumnInfo } from '@hierarchidb/ui-csv-extract';
import type { CSVTableMetadataLike } from '@hierarchidb/table-metadata/src/table/SimpleTableMetadataManager';
import { calculateFileHash, calculateTextHash } from '../utils/hashUtils';
import { getDBName } from '@hierarchidb/util';

type SessionData = {
  rawFileMetadataId: string;
  filename: string;
  contentHash: string;
  fileSizeBytes: number;
  startRowIndex: number;
};

export class SpreadsheetStorePort implements TabularStorePort<CSVTableMetadataLike> {
  private tableManager: SimpleTableMetadataManager;
  private db: SpreadsheetDatabase;
  private sessions = new Map<string, SessionData>();

  constructor(private pluginId: string = 'spreadsheet') {
    const metadataDbName = getDBName('spreadsheet-metadata-db');
    this.tableManager = new SimpleTableMetadataManager(metadataDbName);
    this.db = new SpreadsheetDatabase(getDBName('spreadsheet-db'));
  }

  async beginIngest(schema: TabularSchema, ctx: { filename?: string; sizeBytes?: number; source?: any }): Promise<TabularIngestSession> {
    const filename = ctx.filename || 'unknown.csv';
    const size = ctx.sizeBytes || 0;
    let hash = 'na';
    try {
      if (typeof File !== 'undefined' && ctx.source instanceof File) {
        hash = await calculateFileHash(ctx.source);
      } else if (typeof ctx.source === 'string') {
        hash = await calculateTextHash(ctx.source);
      }
    } catch {}

    // Create RawFileMetadata
    const rawMeta = await (this.db as any).createRawFileMetadata?.({
      filename,
      contentHash: hash,
      fileSizeBytes: size,
      columns: (schema.columns as Array<{ name: string }>).map((c: { name: string }, i: number) => ({ name: c.name, index: i, type: 'string', uniqueValues: 0, hasNullValues: false, sampleValues: [] } as CSVColumnInfo)),
      totalRows: 0,
    });

    const id = rawMeta?.id || crypto.randomUUID();
    this.sessions.set(id, { rawFileMetadataId: id, filename, contentHash: hash, fileSizeBytes: size, startRowIndex: 0 });
    return { id };
  }

  async writeChunk(session: TabularIngestSession, chunk: TabularChunk): Promise<void> {
    const s = this.sessions.get(session.id);
    if (!s) return;
    // Serialize rows to ArrayBuffer
    const json = JSON.stringify(chunk.rows);
    const enc = new TextEncoder();
    const buf = enc.encode(json);
    await (this.db as any).createRowChunk?.({
      rawFileMetadataId: s.rawFileMetadataId,
      chunkIndex: chunk.index,
      binaryData: buf.buffer,
      rowCount: chunk.rows.length,
      startRowIndex: s.startRowIndex,
      endRowIndex: s.startRowIndex + chunk.rows.length - 1,
      originalSize: buf.byteLength,
      compressedSize: buf.byteLength,
    });
    s.startRowIndex += chunk.rows.length;
  }

  async commit(session: TabularIngestSession, summary: TabularIngestSummary): Promise<TabularIngestResult<CSVTableMetadataLike>> {
    const s = this.sessions.get(session.id)!;
    // Build CSVTableMetadata
    const metadata: CSVTableMetadataLike = {
      id: session.id,
      filename: s.filename,
      contentHash: s.contentHash,
      fileSizeBytes: s.fileSizeBytes || 0,
      totalRows: summary.totalRows,
      columns: [],
      createdAt: Date.now(),
      referenceCount: 0,
      referencingPlugins: [],
      isChunked: true,
      chunkCount: summary.chunkCount,
    } as any;
    // Persist metadata in table manager
    const created = await this.tableManager.create(metadata, this.pluginId);
    this.sessions.delete(session.id);
    return { session, metadata: created };
  }

  async abort(session: TabularIngestSession, _reason?: string): Promise<void> {
    // Best-effort cleanup: remove session map; row chunks/metadata GC can be handled separately
    this.sessions.delete(session.id);
  }
}
