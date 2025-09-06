import { getRowStoreDB } from './RowStoreDB';

export type ColumnFilter = {
  column: string;
  op: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'neq';
  value: any;
};

function matchOp(v: any, op: ColumnFilter['op'], target: any): boolean {
  switch (op) {
    case 'eq': return v === target;
    case 'neq': return v !== target;
    case 'contains': return typeof v === 'string' && String(v).toLowerCase().includes(String(target).toLowerCase());
    case 'gt': return Number(v) > Number(target);
    case 'gte': return Number(v) >= Number(target);
    case 'lt': return Number(v) < Number(target);
    case 'lte': return Number(v) <= Number(target);
    default: return false;
  }
}

export class TabularQueryService {
  constructor(private readonly pluginId: string) {}
  async query(tableId: string, filters: ColumnFilter[], limit = 1000): Promise<any[]> {
    const db = getRowStoreDB();
    const chunks = await db.table('rowChunks').where(['pluginId+tableId'] as any).equals([this.pluginId, tableId] as any).sortBy('chunkIndex');
    const out: any[] = [];
    for (const c of chunks) {
      const rows: any[] = JSON.parse(new TextDecoder().decode(new Uint8Array(c.binaryData)));
      for (const row of rows) {
        const ok = filters.every((f) => matchOp(row[f.column], f.op, f.value));
        if (ok) { out.push(row); if (out.length >= limit) return out; }
      }
    }
    return out;
  }
}

