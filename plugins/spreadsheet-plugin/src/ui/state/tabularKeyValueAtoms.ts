import { atom, type Getter } from 'jotai';
import type { TabularFilterOperator, TabularFilterRule } from '@hierarchidb/ui-tabular-extract';
import { calculateStatistics, type TabularRow } from '../../common/utils/tabularStatistics.js';

export const tabularRowsAtom = atom<TabularRow[]>([]);

export const filterRulesAtom = atom<TabularFilterRule[]>([]);

const toStr = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const matchesRule = (row: TabularRow, rule: TabularFilterRule): boolean => {
  const { column, operator, value } = rule;
  const rowValue = (row as Record<string, unknown>)[column];
  switch (operator as TabularFilterOperator) {
    case 'equals':
      return toStr(rowValue) === toStr(value);
    case 'not_equals':
      return toStr(rowValue) !== toStr(value);
    case 'contains':
      return typeof value === 'string'
        ? toStr(rowValue).toLowerCase().includes(value.toLowerCase())
        : false;
    case 'not_contains':
      return typeof value === 'string'
        ? !toStr(rowValue).toLowerCase().includes(value.toLowerCase())
        : true;
    case 'starts_with':
      return typeof value === 'string'
        ? toStr(rowValue).toLowerCase().startsWith(value.toLowerCase())
        : false;
    case 'ends_with':
      return typeof value === 'string'
        ? toStr(rowValue).toLowerCase().endsWith(value.toLowerCase())
        : false;
    case 'greater_than': {
      const rv = toNum(rowValue);
      const fv = toNum(value);
      return rv !== null && fv !== null ? rv > fv : false;
    }
    case 'greater_equal': {
      const rv = toNum(rowValue);
      const fv = toNum(value);
      return rv !== null && fv !== null ? rv >= fv : false;
    }
    case 'less_than': {
      const rv = toNum(rowValue);
      const fv = toNum(value);
      return rv !== null && fv !== null ? rv < fv : false;
    }
    case 'less_equal': {
      const rv = toNum(rowValue);
      const fv = toNum(value);
      return rv !== null && fv !== null ? rv <= fv : false;
    }
    case 'is_null':
      return rowValue === null || rowValue === undefined || rowValue === '';
    case 'is_not_null':
      return !(rowValue === null || rowValue === undefined || rowValue === '');
    case 'regex':
      if (typeof value !== 'string') return true;
      try {
        const re = new RegExp(value);
        return re.test(toStr(rowValue));
      } catch {
        return true;
      }
    default:
      return true;
  }
};

export const filteredRowsAtom = atom((get: Getter) => {
  const rows = get(tabularRowsAtom);
  const rules = get(filterRulesAtom).filter((r: TabularFilterRule) => r.enabled !== false && r.column);
  if (!rules.length) return rows;
  return rows.filter((row: TabularRow) => rules.every((rule) => matchesRule(row, rule)));
});

export const keyColumnAtom = atom<string>('');
export const valueColumnAtom = atom<string>('');

export const numericValuesAtom = atom((get: Getter) => {
  const valueColumn = get(valueColumnAtom);
  if (!valueColumn) return [] as number[];
  const rows = get(filteredRowsAtom);
  return rows
    .map((row: TabularRow) => row[valueColumn])
    .map((val: unknown) => (typeof val === 'number' ? val : typeof val === 'string' ? Number(val) : NaN))
    .filter((v: number) => Number.isFinite(v));
});

export const binCountAtom = atom<number>(16);

export const histogramStatsAtom = atom((get: Getter) => {
  const values = get(numericValuesAtom);
  if (!values.length) return null;
  const stats = calculateStatistics(values);
  return {
    min: stats.min,
    max: stats.max,
    mean: stats.mean,
    median: stats.median,
    stdDev: stats.stdDev,
    count: stats.totalCount,
  };
});

export const histogramBinsAtom = atom((get: Getter) => {
  const values = get(numericValuesAtom);
  const bins = Math.max(1, Math.min(256, get(binCountAtom)));
  if (!values.length) return { binCount: bins, counts: Array(bins).fill(0), mode: 0, min: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const counts = Array(bins).fill(0);
    counts[0] = values.length;
    return { binCount: bins, counts, mode: values.length, min, max };
  }
  const counts = Array(bins).fill(0);
  const range = max - min;
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor(((v - min) / range) * bins));
    counts[idx] += 1;
  }
  const mode = counts.reduce((m, v) => (v > m ? v : m), 0);
  return { binCount: bins, counts, mode, min, max };
});
