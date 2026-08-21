import { getRowStoreDB, type RowIndexEntry, readChunkRows } from './RowStoreDB.js';

function norm(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(value);
}

function makeKey(pluginId: string, tableId: string, column: string, value: string): string {
  // keep length reasonable
  const val = value.length > 128 ? value.slice(0, 128) : value;
  return `${pluginId}:${tableId}:${column}:${val}`;
}

export class TabularIndexer {
  constructor(
    private readonly pluginId: string,
    private readonly rowStoreDbName: string,
  ) {
  }

  async indexRows(tableId: string, columns: string[], _chunkSize = 2000): Promise<void> {
    const db = getRowStoreDB(this.rowStoreDbName);
    const chunks = await db.rowChunks
      .where('[pluginId+tableId]')
      .equals([this.pluginId, tableId])
      .sortBy('chunkIndex');
    for (const ch of chunks) {
      const rows = readChunkRows(ch);
      let rowId = ch.startRowIndex;
      for (const r of rows) {
        if (typeof r !== 'object' || r === null) {
          rowId++;
          continue;
        }
        const record = r as Record<string, unknown>;
        for (const c of columns) {
          const value = norm(record[c]);
          const id = makeKey(this.pluginId, tableId, c, value);
          const existing = await db.rowIndexes.get(id);
          if (existing) {
            if (!existing.rowIds.includes(rowId)) {
              existing.rowIds.push(rowId);
              // Bound rowIds size to prevent unbounded growth in a single entry
              if (existing.rowIds.length > 5000) existing.rowIds = existing.rowIds.slice(-5000);
              existing.updatedAt = Date.now();
              await db.rowIndexes.put(existing);
            }
          } else {
            const entry: RowIndexEntry = {
              id,
              pluginId: this.pluginId,
              tableId,
              column: c,
              value,
              rowIds: [rowId],
              updatedAt: Date.now(),
            };
            await db.rowIndexes.add(entry);
          }
        }
        rowId++;
      }
    }
  }

  async getRowIds(tableId: string, column: string, value: unknown): Promise<number[]> {
    const db = getRowStoreDB(this.rowStoreDbName);
    const id = makeKey(this.pluginId, tableId, column, norm(value));
    const entry = await db.rowIndexes.get(id);
    return entry?.rowIds || [];
  }

  // Resolve rows by rowIds via chunk mapping
  async getRowsByIds(tableId: string, rowIds: number[], limit = 1000): Promise<unknown[]> {
    const db = getRowStoreDB(this.rowStoreDbName);
    const chunks = await db.rowChunks
      .where('[pluginId+tableId]')
      .equals([this.pluginId, tableId])
      .sortBy('startRowIndex');
    const out: unknown[] = [];
    for (const rowId of rowIds) {
      if (out.length >= limit) break;
      const ch = chunks.find((c) => rowId >= c.startRowIndex && rowId <= c.endRowIndex);
      if (!ch) continue;
      const rows = readChunkRows(ch);
      const idx = rowId - ch.startRowIndex;
      if (idx >= 0 && idx < rows.length) out.push(rows[idx]);
    }
    return out;
  }
}
