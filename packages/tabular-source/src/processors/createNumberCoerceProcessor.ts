import type { TabularProcessor } from '~/processor';
import type { TabularRow } from '~/types';

export interface NumberCoerceRule {
  column: string;
  locale?: string;
  default?: number;
}

export function createNumberCoerceProcessor(
  id: string,
  rules: NumberCoerceRule[]
): TabularProcessor {
  const set = new Set(rules.map((r) => r.column));
  const ruleFor = (c: string) => rules.find((r) => r.column === c);
  return {
    id,
    transformRow(row: TabularRow): TabularRow {
      const out = { ...row };
      for (const col of Object.keys(row)) {
        if (!set.has(col)) continue;
        const rule = ruleFor(col);
        if (!rule) continue;
        const v = row[col];
        if (typeof v === 'number') continue;
        if (v === null || v === undefined || v === '') {
          out[col] = rule.default ?? null;
          continue;
        }
        const s = String(v).replace(/,/g, '');
        const n = Number(s);
        out[col] = Number.isFinite(n) ? n : (rule.default ?? null);
      }
      return out;
    },
  };
}
