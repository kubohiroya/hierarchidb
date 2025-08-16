/**
 * @file filterEngine.ts
 * @description Filter engine utilities for StyleMap plugin
 */

import type { FilterRule } from '../types/FilterRule';

/**
 * Apply filter rules to data rows
 */
export function applyFilterRules(
  rows: (string | number | null)[][],
  headers: string[],
  filterRules: FilterRule[]
): (string | number | null)[][] {
  if (!filterRules || filterRules.length === 0) {
    return rows;
  }

  return rows.filter((row) => {
    return filterRules.every((rule) => {
      const columnIndex = headers.indexOf(rule.keyColumn);
      if (columnIndex === -1) return true; // Skip if column not found

      const cellValue = row[columnIndex];
      const matchValue = rule.matchValue;

      switch (rule.operator) {
        case 'equals':
          return cellValue === matchValue;
        case 'not_equals':
          return cellValue !== matchValue;
        case 'contains':
          return String(cellValue || '').includes(String(matchValue));
        case 'starts_with':
          return String(cellValue || '').startsWith(String(matchValue));
        case 'ends_with':
          return String(cellValue || '').endsWith(String(matchValue));
        case 'greater_than':
          return Number(cellValue) > Number(matchValue);
        case 'less_than':
          return Number(cellValue) < Number(matchValue);
        case 'greater_equal':
          return Number(cellValue) >= Number(matchValue);
        case 'less_equal':
          return Number(cellValue) <= Number(matchValue);
        default:
          return true;
      }
    });
  });
}
