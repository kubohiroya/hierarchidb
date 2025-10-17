import type {
  TabularChunk,
  TabularIngestContext,
  TabularIngestResult,
  TabularIngestSession,
  TabularIngestSummary,
  TabularSchema,
  TabularStorePort,
} from '@hierarchidb/tabular-source';
import type { NodeId } from '@hierarchidb/common-types';
import { SimpleTableMetadataManager } from './SimpleTableMetadataManager.js';
import { SpreadsheetDatabase } from './database/SpreadsheetDatabase.js';
import type { CSVColumnInfo, SimpleTableMetadataManager as TableMetadataManagerPublic } from '@hierarchidb/tabular-store';
type CSVTableMetadataLike = Parameters<TableMetadataManagerPublic['create']>[0];
import { getDBName } from '@hierarchidb/util';
import { calculateFileHash, calculateTextHash } from '~/common/utils/hashUtils.js';

type SessionData = {
  rawFileMetadataId: NodeId;
  filename: string;
  contentHash: string;
  fileSizeBytes: number;
  startRowIndex: number;
  columns: CSVColumnInfo[];
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

  async beginIngest(schema: TabularSchema, ctx: TabularIngestContext): Promise<TabularIngestSession> {
    const filename = ctx.filename || 'unknown.csv';
    const size = ctx.sizeBytes || 0;
    let hash = 'na';
    if (typeof File !== 'undefined' && ctx.source instanceof File) {
      hash = await calculateFileHash(ctx.source);
    } else if (typeof ctx.source === 'string') {
      hash = await calculateTextHash(ctx.source);
    }

    // Create RawFileMetadata
    const columnSpecs = schema.columns ?? [];
    const columnInfo: CSVColumnInfo[] = columnSpecs.map((column, index) => ({
      name: column.name,
      index,
      type: column.type === 'number' || column.type === 'boolean' || column.type === 'date' ? column.type : 'string',
      uniqueValues: 0,
      hasNullValues: false,
      sampleValues: [],
    }));

    const rawMeta = await this.db.createRawFileMetadata({
      fileName: filename,
      contentHash: hash,
      fileSize: size,
      mimeType: ctx.source instanceof File ? ctx.source.type || 'text/csv' : 'text/csv',
      encoding: 'utf-8',
      parsingConfig: {
        delimiter: ',',
        quoteChar: '"',
        escapeChar: '\\',
        hasHeader: true,
        skipEmptyLines: true,
      },
      totalRows: 0,
      totalColumns: columnInfo.length,
      chunkCount: 0,
    });

    const sessionId = String(rawMeta.id);
    this.sessions.set(sessionId, {
      rawFileMetadataId: rawMeta.id,
      filename,
      contentHash: hash,
      fileSizeBytes: size,
      startRowIndex: 0,
      columns: columnInfo,
    });
    return { id: sessionId };
  }

  async writeChunk(session: TabularIngestSession, chunk: TabularChunk): Promise<void> {
    const s = this.sessions.get(session.id);
    if (!s) return;
    // Serialize rows to ArrayBuffer
    const json = JSON.stringify(chunk.rows);
    const enc = new TextEncoder();
    const buf = enc.encode(json);
    const binaryData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    await this.db.createRowChunk({
      rawFileMetadataId: s.rawFileMetadataId,
      chunkIndex: chunk.index,
      binaryData,
      rowCount: chunk.rows.length,
      startRowIndex: s.startRowIndex,
      endRowIndex: s.startRowIndex + chunk.rows.length - 1,
      originalSize: buf.byteLength,
      compressedSize: buf.byteLength,
    });
    s.startRowIndex += chunk.rows.length;
  }

  async commit(session: TabularIngestSession, summary: TabularIngestSummary): Promise<TabularIngestResult<CSVTableMetadataLike>> {
    const s = this.sessions.get(session.id);
    if (!s) {
      throw new Error(`Ingest session not found: ${session.id}`);
    }
    // Build CSVTableMetadata
    const metadata: CSVTableMetadataLike = {
      id: session.id,
      filename: s.filename,
      contentHash: s.contentHash,
      fileSizeBytes: s.fileSizeBytes || 0,
      totalRows: summary.totalRows,
      columns: s.columns,
      createdAt: Date.now(),
      referenceCount: 0,
      referencingPlugins: [],
      isChunked: true,
      chunkCount: summary.chunkCount,
    };
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
