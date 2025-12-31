import type { TabularFilterRule } from '@hierarchidb/ui-tabular';
import type { StylerTableRow } from '../../common/types/StylerEntity.js';

export type PreparedFilter = {
  column: string;
  operator: TabularFilterRule['operator'];
  value?: string | number;
  regex?: RegExp;
};

const NULL_LIKE_VALUES = new Set(['', 'null', 'undefined']);
const SAFE_NUMBER_REGEX = /^-?\d+(\.\d+)?$/;

const toComparableString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const toComparableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && SAFE_NUMBER_REGEX.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const prepareFilters = (rules: TabularFilterRule[]): PreparedFilter[] => {
  return rules
    .filter((rule) => rule.enabled !== false && rule.column)
    .map((rule) => {
      const prepared: PreparedFilter = {
        column: rule.column,
        operator: rule.operator,
      };
      if (rule.operator === 'regex' && typeof rule.value === 'string') {
        try {
          prepared.regex = new RegExp(rule.value);
        } catch {
          prepared.regex = undefined;
        }
      } else if (typeof rule.value === 'number' || typeof rule.value === 'string') {
        prepared.value = rule.value;
      }
      return prepared;
    });
};

const matchContains = (source: unknown, target: string): boolean => {
  const base = toComparableString(source).toLowerCase();
  return base.includes(target.toLowerCase());
};

const startsWith = (source: unknown, target: string): boolean => {
  return toComparableString(source).toLowerCase().startsWith(target.toLowerCase());
};

const endsWith = (source: unknown, target: string): boolean => {
  return toComparableString(source).toLowerCase().endsWith(target.toLowerCase());
};

const compareNumber = (
  rowValue: unknown,
  filter: PreparedFilter,
  comparator: (row: number, target: number) => boolean,
): boolean => {
  if (typeof filter.value === 'number') {
    const rowNumber = toComparableNumber(rowValue);
    return rowNumber !== null ? comparator(rowNumber, filter.value) : false;
  }
  const parsedFilter = toComparableNumber(filter.value);
  const parsedRow = toComparableNumber(rowValue);
  if (parsedFilter === null || parsedRow === null) return false;
  return comparator(parsedRow, parsedFilter);
};

export const matchesFilters = (row: StylerTableRow, filters: PreparedFilter[]): boolean => {
  if (filters.length === 0) return true;
  return filters.every((filter) => {
    const rowValue = row[filter.column];
    switch (filter.operator) {
      case 'equals':
        return toComparableString(rowValue) === toComparableString(filter.value);
      case 'not_equals':
        return toComparableString(rowValue) !== toComparableString(filter.value);
      case 'contains':
        return typeof filter.value === 'string' ? matchContains(rowValue, filter.value) : false;
      case 'not_contains':
        return typeof filter.value === 'string' ? !matchContains(rowValue, filter.value) : true;
      case 'starts_with':
        return typeof filter.value === 'string' ? startsWith(rowValue, filter.value) : false;
      case 'ends_with':
        return typeof filter.value === 'string' ? endsWith(rowValue, filter.value) : false;
      case 'greater_than':
        return compareNumber(rowValue, filter, (rowNum, target) => rowNum > target);
      case 'greater_equal':
        return compareNumber(rowValue, filter, (rowNum, target) => rowNum >= target);
      case 'less_than':
        return compareNumber(rowValue, filter, (rowNum, target) => rowNum < target);
      case 'less_equal':
        return compareNumber(rowValue, filter, (rowNum, target) => rowNum <= target);
      case 'is_null': {
        if (rowValue === null || rowValue === undefined || rowValue === '') return true;
        if (typeof rowValue === 'string') {
          return NULL_LIKE_VALUES.has(rowValue.toLowerCase());
        }
        return false;
      }
      case 'is_not_null': {
        if (rowValue === null || rowValue === undefined || rowValue === '') return false;
        if (typeof rowValue === 'string') {
          return !NULL_LIKE_VALUES.has(rowValue.toLowerCase());
        }
        return true;
      }
      case 'regex':
        return filter.regex ? filter.regex.test(toComparableString(rowValue)) : true;
      default:
        return true;
    }
  });
};

export const applyFilters = (
  rows: StylerTableRow[],
  rules: TabularFilterRule[],
  limit = 1000,
): StylerTableRow[] => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  const prepared = prepareFilters(rules ?? []);
  if (!prepared.length) {
    return rows.slice(0, limit);
  }
  const result: StylerTableRow[] = [];
  for (const row of rows) {
    if (matchesFilters(row, prepared)) {
      result.push(row);
    }
    if (result.length >= limit) {
      break;
    }
  }
  return result;
};
