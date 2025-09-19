import { getRowStoreDB } from './RowStoreDB.js';
import { TabularIndexer } from './Indexer.js';

export type ColumnFilter = {
  column: string;
  op: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'neq';
  value: any;
};

function matchOp(v: any, op: ColumnFilter['op'], target: any): boolean {
  switch (op) {
    case 'eq':
      return v === target;
    case 'neq':
      return v !== target;
    case 'contains':
      return typeof v === 'string' && String(v).toLowerCase().includes(String(target).toLowerCase());
    case 'gt':
      return Number(v) > Number(target);
    case 'gte':
      return Number(v) >= Number(target);
    case 'lt':
      return Number(v) < Number(target);
    case 'lte':
      return Number(v) <= Number(target);
    default:
      return false;
  }
}

export class TabularQueryService {
  constructor(private readonly pluginId: string) {
  }

  async query(tableId: string, filters: ColumnFilter[], limit = 1000): Promise<any[]> {
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
        const set = new Set<number>(ids as number[]);
        if (acc) {
          const prev: number[] = Array.from(acc.values());
          const inter: number[] = prev.filter((x: number) => set.has(x));
          acc = new Set<number>(inter as number[]);
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
    const chunks = await db.table('rowChunks').where(['pluginId+tableId'] as any).equals([this.pluginId, tableId] as any).sortBy('chunkIndex');
    const out: any[] = [];
    for (const c of chunks) {
      const rows: any[] = JSON.parse(new TextDecoder().decode(new Uint8Array(c.binaryData)));
      for (const row of rows) {
        const ok = filters.every((f) => matchOp(row[f.column], f.op, f.value));
        if (ok) {
          out.push(row);
          if (out.length >= limit) return out;
        }
      }
    }
    return out;
  }
}
