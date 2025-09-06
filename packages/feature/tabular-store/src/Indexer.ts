import { getRowStoreDB, type RowIndexEntry } from './RowStoreDB';

function norm(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return String(v);
}

function makeKey(pluginId: string, tableId: string, column: string, value: string): string {
  // keep length reasonable
  const val = value.length > 128 ? value.slice(0, 128) : value;
  return `${pluginId}:${tableId}:${column}:${val}`;
}

export class TabularIndexer {
  constructor(private readonly pluginId: string) {}

  async indexRows(tableId: string, columns: string[], chunkSize = 2000): Promise<void> {
    const db = getRowStoreDB();
    const chunks = await db.table('rowChunks').where(['pluginId+tableId'] as any).equals([this.pluginId, tableId] as any).sortBy('chunkIndex');
    for (const ch of chunks) {
      const rows: any[] = JSON.parse(new TextDecoder().decode(new Uint8Array(ch.binaryData)));
      let rowId = ch.startRowIndex;
      for (const r of rows) {
        for (const c of columns) {
          const value = norm(r[c]);
          const id = makeKey(this.pluginId, tableId, c, value);
          const existing = (await db.table('rowIndexes').get(id as any)) as unknown as RowIndexEntry | undefined;
          if (existing) {
            if (!existing.rowIds.includes(rowId)) {
              existing.rowIds.push(rowId);
              // Bound rowIds size to prevent unbounded growth in a single entry
              if (existing.rowIds.length > 5000) existing.rowIds = existing.rowIds.slice(-5000);
              existing.updatedAt = Date.now();
              await db.table('rowIndexes').put(existing as any);
            }
          } else {
            const entry: RowIndexEntry = { id, pluginId: this.pluginId, tableId, column: c, value, rowIds: [rowId], updatedAt: Date.now() };
            await db.table('rowIndexes').add(entry as any);
          }
        }
        rowId++;
      }
    }
  }

  async getRowIds(tableId: string, column: string, value: any): Promise<number[]> {
    const db = getRowStoreDB();
    const id = makeKey(this.pluginId, tableId, column, norm(value));
    const entry = (await db.table('rowIndexes').get(id as any)) as unknown as RowIndexEntry | undefined;
    return entry?.rowIds || [];
  }

  // Resolve rows by rowIds via chunk mapping
  async getRowsByIds(tableId: string, rowIds: number[], limit = 1000): Promise<any[]> {
    const db = getRowStoreDB();
    const chunks = await db.table('rowChunks').where(['pluginId+tableId'] as any).equals([this.pluginId, tableId] as any).sortBy('startRowIndex');
    const out: any[] = [];
    const decoder = new TextDecoder();
    for (const rowId of rowIds) {
      if (out.length >= limit) break;
      const ch = chunks.find((c) => rowId >= c.startRowIndex && rowId <= c.endRowIndex);
      if (!ch) continue;
      const rows: any[] = JSON.parse(decoder.decode(new Uint8Array(ch.binaryData)));
      const idx = rowId - ch.startRowIndex;
      if (idx >= 0 && idx < rows.length) out.push(rows[idx]);
    }
    return out;
  }
}

