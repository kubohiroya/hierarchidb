import type { TabularProcessor } from '~/processor';
import type { TabularRow, TabularSchema } from '~/types';

export interface ColumnRenameRule {
  from: string;
  to: string;
}

export function createColumnRenameProcessor(
  id: string,
  rules: ColumnRenameRule[]
): TabularProcessor {
  const map = new Map(rules.map((r) => [r.from, r.to]));
  return {
    id,
    mapSchema(schema: TabularSchema) {
      return {
        columns: schema.columns.map((c) => ({ name: map.get(c.name) || c.name, type: c.type })),
      };
    },
    transformRow(row: TabularRow): TabularRow {
      const out: TabularRow = {};
      for (const [k, v] of Object.entries(row)) {
        out[map.get(k) || k] = v;
      }
      return out;
    },
  };
}
