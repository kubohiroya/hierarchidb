import { TabularDatabaseManager } from './TabularDatabaseManager.js';
import type { TabularColumnInfo, TabularTableMetadataLike } from './types.js';
import { getDBName } from '@hierarchidb/util';
import { getRowStoreDB, type RowChunk } from './RowStoreDB.js';

export class TabularWriter {
  private tableId: string | null = null;
  private chunkIndex = 0;
  private rowCursor = 0;
  private rowsBuffered: unknown[] = [];
  private readonly chunkSize: number;
  private readonly manager: TabularDatabaseManager;

  constructor(private readonly pluginId: string, opts?: {
    chunkSize?: number;
    metadataDbName?: string;
    indexColumns?: string[]
  }) {
    this.chunkSize = opts?.chunkSize ?? 2000;
    this.manager = new TabularDatabaseManager(opts?.metadataDbName ?? getDBName(`${pluginId}-metadata`));
    this.indexColumns = opts?.indexColumns ?? [];
  }

  private indexColumns: string[];

  async begin(schema: { tableId?: string; filename?: string; columns: string[]; contentHash?: string }): Promise<string> {
    const id = schema.tableId ?? crypto.randomUUID();
    // Local shape compatible with StylerMetadataManager.create()
    const columns: TabularColumnInfo[] = schema.columns.map((name, index) => ({ name, index }));
    const base: TabularTableMetadataLike = {
      id,
      filename: schema.filename || `${this.pluginId}-${id}.json`,
      columns,
      totalRows: 0,
      isChunked: true,
      chunkCount: 0,
      fileSizeBytes: 0,
      contentHash: schema.contentHash,
    };
    const created = await this.manager.create(base, this.pluginId);
    this.tableId = created.id;
    return created.id;
  }

  async writeRows(rows: ReadonlyArray<unknown>): Promise<void> {
    if (!this.tableId) throw new Error('begin() not called');
    const db = getRowStoreDB();
    for (const r of rows) {
      this.rowsBuffered.push(r);
      if (this.rowsBuffered.length >= this.chunkSize) {
        const payload = JSON.stringify(this.rowsBuffered);
        const buf = new TextEncoder().encode(payload).buffer;
        const chunk: RowChunk = {
          id: crypto.randomUUID(),
          pluginId: this.pluginId,
          tableId: this.tableId,
          chunkIndex: this.chunkIndex++,
          startRowIndex: this.rowCursor,
          endRowIndex: this.rowCursor + this.rowsBuffered.length - 1,
          binaryData: buf,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.rowChunks.add(chunk);
        if (this.indexColumns.length > 0) {
          const { TabularIndexer } = await import('./Indexer.js');
          await new TabularIndexer(this.pluginId).indexRows(this.tableId!, this.indexColumns);
        }
        this.rowCursor += this.rowsBuffered.length;
        this.rowsBuffered = [];
      }
    }
  }

  async flush(): Promise<void> {
    if (!this.tableId) return;
    if (this.rowsBuffered.length === 0) return;
    const db = getRowStoreDB();
    const payload = JSON.stringify(this.rowsBuffered);
    const buf = new TextEncoder().encode(payload).buffer;
    const chunk: RowChunk = {
      id: crypto.randomUUID(),
      pluginId: this.pluginId,
      tableId: this.tableId,
      chunkIndex: this.chunkIndex++,
      startRowIndex: this.rowCursor,
      endRowIndex: this.rowCursor + this.rowsBuffered.length - 1,
      binaryData: buf,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.rowChunks.add(chunk);
    if (this.indexColumns.length > 0) {
      const { TabularIndexer } = await import('./Indexer.js');
      await new TabularIndexer(this.pluginId).indexRows(this.tableId!, this.indexColumns);
    }
    this.rowCursor += this.rowsBuffered.length;
    this.rowsBuffered = [];
  }

  async commit(): Promise<{ tableId: string; totalRows: number; chunkCount: number }> {
    if (!this.tableId) throw new Error('begin() not called');
    await this.flush();
    const id = this.tableId;
    const totalRows = this.rowCursor;
    const chunkCount = this.chunkIndex;
    await this.manager.update(id, { totalRows, chunkCount });
    return { tableId: id, totalRows, chunkCount };
  }
}
