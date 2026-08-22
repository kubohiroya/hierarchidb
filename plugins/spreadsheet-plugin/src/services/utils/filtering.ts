import type { TabularFilterRule } from '@hierarchidb/ui-tabular';

export type TabularRow = {
  [column: string]: string | number | boolean | null;
};

export type PreparedFilter = {
  column: string;
  operator: TabularFilterRule['operator'];
  value?: string | number;
  regex?: RegExp;
};

const NULL_LIKE_VALUES = new Set(['', 'null', 'undefined']);

const SAFE_NUMBER_REGEX = /^-?\d+(\.\d+)?$/;

export function prepareFilters(rules: TabularFilterRule[]): PreparedFilter[] {
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
}

const isNullish = (value: unknown): boolean =>
  value === null || value === undefined || value === '';

const toComparableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && SAFE_NUMBER_REGEX.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toComparableString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const matchRegex = (value: unknown, filter: PreparedFilter): boolean => {
  if (!filter.regex) return false;
  return filter.regex.test(toComparableString(value));
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
  comparator: (row: number, target: number) => boolean
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

export function matchesFilters(row: TabularRow, filters: PreparedFilter[]): boolean {
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
        if (isNullish(rowValue)) return true;
        if (typeof rowValue === 'string') {
          return NULL_LIKE_VALUES.has(rowValue.toLowerCase());
        }
        return false;
      }
      case 'is_not_null': {
        if (isNullish(rowValue)) return false;
        if (typeof rowValue === 'string') {
          return !NULL_LIKE_VALUES.has(rowValue.toLowerCase());
        }
        return true;
      }
      case 'regex':
        return matchRegex(rowValue, filter);
      default:
        return true;
    }
  });
}

export function normalizeValueForResult(value: unknown): string | number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  return value === null || value === undefined ? null : String(value);
}
