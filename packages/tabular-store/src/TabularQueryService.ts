import { getRowStoreDB, readChunkRows } from './RowStoreDB.js';
import { TabularIndexer } from './TabularIndexer.js';

export type ColumnFilter = {
  column: string;
  op: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'neq';
  value: unknown;
};

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function matchOp(value: unknown, op: ColumnFilter['op'], target: unknown): boolean {
  switch (op) {
    case 'eq':
      return value === target;
    case 'neq':
      return value !== target;
    case 'contains':
      return typeof value === 'string' && String(value).toLowerCase().includes(String(target).toLowerCase());
    case 'gt':
      return toNumber(value) > toNumber(target);
    case 'gte':
      return toNumber(value) >= toNumber(target);
    case 'lt':
      return toNumber(value) < toNumber(target);
    case 'lte':
      return toNumber(value) <= toNumber(target);
    default:
      return false;
  }
}

export class TabularQueryService {
  constructor(private readonly pluginId: string) {
  }

  async query(tableId: string, filters: ColumnFilter[], limit = 1000): Promise<unknown[]> {
    const db = getRowStoreDB();
    // Try index-assisted path for eq-only filters
    const eqFilters = filters.filter((f) => f.op === 'eq');
    const canUseIndex = filters.length > 0 && eqFilters.length === filters.length;
    if (canUseIndex) {
      const indexer = new TabularIndexer(this.pluginId);
      let acc: Set<number> | null = null;
      for (const f of eqFilters) {
        let ids = await indexer.getRowIds(tableId, f.column, f.value);
        if (!ids || ids.length === 0) {
          // Build index lazily for the requested column
          await indexer.indexRows(tableId, [f.column]);
          ids = await indexer.getRowIds(tableId, f.column, f.value);
        }
        const set = new Set<number>(ids);
        if (acc) {
          const prev: number[] = Array.from(acc.values());
          const inter: number[] = prev.filter((x: number) => set.has(x));
          acc = new Set<number>(inter);
        } else {
          acc = set;
        }
        if (acc.size === 0) return [];
      }
      const rowIds = [...(acc || new Set<number>())].slice(0, limit);
      if (rowIds.length > 0) {
        return await new TabularIndexer(this.pluginId).getRowsByIds(tableId, rowIds, limit);
      }
    }

    // Fallback full scan
    const chunks = await db.rowChunks
      .where('[pluginId+tableId]')
      .equals([this.pluginId, tableId])
      .sortBy('chunkIndex');
    const out: unknown[] = [];
    for (const chunk of chunks) {
      const rows = readChunkRows(chunk);
      for (const row of rows) {
        if (typeof row !== 'object' || row === null) continue;
        const record = row as Record<string, unknown>;
        const ok = filters.every((f) => matchOp(record[f.column], f.op, f.value));
        if (ok) {
          out.push(record);
          if (out.length >= limit) return out;
        }
      }
    }
    return out;
  }
}
