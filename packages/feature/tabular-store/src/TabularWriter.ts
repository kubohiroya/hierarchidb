import { SimpleTableMetadataManager, type CSVTableMetadataLike } from '@hierarchidb/table-metadata';
import { getDBName } from '@hierarchidb/util';
import { getRowStoreDB } from './RowStoreDB';

export class TabularWriter {
  private tableId: string | null = null;
  private chunkIndex = 0;
  private rowCursor = 0;
  private rowsBuffered: any[] = [];
  private readonly chunkSize: number;
  private readonly manager: SimpleTableMetadataManager;
  constructor(private readonly pluginId: string, opts?: { chunkSize?: number; metadataDbName?: string }) {
    this.chunkSize = opts?.chunkSize ?? 2000;
    this.manager = new SimpleTableMetadataManager(opts?.metadataDbName ?? getDBName(`${pluginId}-metadata-db`));
  }
  async begin(schema: { filename?: string; columns: string[]; contentHash?: string }): Promise<string> {
    const id = crypto.randomUUID();
    const base: CSVTableMetadataLike = {
      id,
      filename: schema.filename || `${this.pluginId}-${id}.json`,
      columns: schema.columns,
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
  async writeRows(rows: any[]): Promise<void> {
    if (!this.tableId) throw new Error('begin() not called');
    const db = getRowStoreDB();
    for (const r of rows) {
      this.rowsBuffered.push(r);
      if (this.rowsBuffered.length >= this.chunkSize) {
        const payload = JSON.stringify(this.rowsBuffered);
        const buf = new TextEncoder().encode(payload).buffer;
        await db.table('rowChunks').add({
          id: crypto.randomUUID(), pluginId: this.pluginId, tableId: this.tableId,
          chunkIndex: this.chunkIndex++, startRowIndex: this.rowCursor, endRowIndex: this.rowCursor + this.rowsBuffered.length - 1,
          binaryData: buf, createdAt: Date.now(), updatedAt: Date.now()
        } as any);
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
    await db.table('rowChunks').add({
      id: crypto.randomUUID(), pluginId: this.pluginId, tableId: this.tableId,
      chunkIndex: this.chunkIndex++, startRowIndex: this.rowCursor, endRowIndex: this.rowCursor + this.rowsBuffered.length - 1,
      binaryData: buf, createdAt: Date.now(), updatedAt: Date.now()
    } as any);
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

