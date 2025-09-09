/**
 * @file filterUtils.ts
 * @description CSV data filtering utilities
 * Refactored from Styler plugin for Spreadsheet plugin use
 */

import type { CSVFilterRule } from '@hierarchidb/ui-csv-extract';

/**
  * : CSV
 * : AND
 * :
 * :
  */
export function applyCsvFilters(
  rows: Array<Record<string, any>>,
  filters: CSVFilterRule[],
): Array<Record<string, any>> {
  if (!filters || filters.length === 0) {
    return rows;
  }

  //  : enabled=true
  const activeFilters = filters.filter(filter => filter.enabled);

  if (activeFilters.length === 0) {
    return rows;
  }

  //  : AND
  return rows.filter(row => {
    return activeFilters.every(filter => applyFilterToRow(row, filter));
  });
}

/**
  * :
 * :
 * :
 * :
  */
function applyFilterToRow(row: Record<string, any>, filter: CSVFilterRule): boolean {
  const col = (filter.column || (filter as any).field) as string;
  const cellValue = row[col];
  const filterValue = filter.value;

  //  null: null/undefined
  if (cellValue == null) {
    switch (filter.operator) {
      case 'is_null':
        return true;
      case 'is_not_null':
        return false;
      default:
        return false; //  null
    }
  }

  //  :
  const cellString = String(cellValue).toLowerCase();
  const filterString = String(filterValue).toLowerCase();

  //  :
  const operator = (filter.operator || (filter as any).op) as string;
  switch (operator) {
    case 'equals':
      return cellString === filterString;

    case 'not_equals':
      return cellString !== filterString;

    case 'contains':
      return cellString.includes(filterString);

    case 'not_contains':
      return !cellString.includes(filterString);

    case 'starts_with':
      return cellString.startsWith(filterString);

    case 'ends_with':
      return cellString.endsWith(filterString);

    case 'greater_than':
      return compareValues(cellValue, filterValue) > 0;

    case 'less_than':
      return compareValues(cellValue, filterValue) < 0;

    case 'greater_equal':
      return compareValues(cellValue, filterValue) >= 0;

    case 'less_equal':
      return compareValues(cellValue, filterValue) <= 0;

    case 'is_null':
      return false; //  cellValuenull

    case 'is_not_null':
      return true; //  cellValuenull

    case 'regex':
      try {
        const regex = new RegExp(filterString, 'i');
        return regex.test(cellString);
      } catch (error) {
        //  :
        console.warn(`Invalid regex pattern: ${filterString}`, error);
        return false;
      }

    default:
      console.warn(`Unknown filter operator: ${operator}`);
      return true;
  }
}

/**
  * :
 * :
 * :
 * :
  */
function compareValues(cellValue: any, filterValue: any): number {
  //  :
  const cellNum = parseFloat(String(cellValue));
  const filterNum = parseFloat(String(filterValue));

  if (!isNaN(cellNum) && !isNaN(filterNum)) {
    return cellNum - filterNum;
  }

  //  :
  const cellDate = new Date(String(cellValue));
  const filterDate = new Date(String(filterValue));

  if (!isNaN(cellDate.getTime()) && !isNaN(filterDate.getTime())) {
    return cellDate.getTime() - filterDate.getTime();
  }

  //  :
  const cellString = String(cellValue).toLowerCase();
  const filterString = String(filterValue).toLowerCase();

  return cellString.localeCompare(filterString);
}

/**
  * :
 * :
 * :
 * :
  */
export function validateFilterRules(filters: CSVFilterRule[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const filter of filters) {
    if (!filter.column || !filter.column.trim()) {
      errors.push(`Filter ${filter.id || 'unknown'}: Column name is required`);
    }

    if (!(filter.operator || (filter as any).op)) {
      errors.push(`Filter ${filter.id || 'unknown'}: Operator is required`);
    }

    const valueRequiredOperators = [
      'equals', 'not_equals', 'contains', 'not_contains',
      'starts_with', 'ends_with', 'greater_than', 'less_than',
      'greater_equal', 'less_equal', 'regex',
    ];

    if (valueRequiredOperators.includes((filter.operator || (filter as any).op) as string) &&
      (!filter.value || (typeof filter.value === 'string' && filter.value.trim() === ''))) {
      errors.push(`Filter ${filter.id || 'unknown'}: Value is required for operator "${(filter.operator || (filter as any).op)}"`);
    }

    if (((filter.operator || (filter as any).op) as string) === 'regex' && filter.value) {
      try {
        new RegExp(String(filter.value));
      } catch (error) {
        errors.push(`Filter ${filter.id || 'unknown'}: Invalid regular expression "${String(filter.value)}"`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
  * :
 * :
 * :
  */
export function getFilterStatistics(
  originalRows: Array<Record<string, any>>,
  filteredRows: Array<Record<string, any>>,
  filters: CSVFilterRule[],
): {
  originalCount: number;
  filteredCount: number;
  reductionPercentage: number;
  activeFiltersCount: number;
} {
  const activeFilters = filters.filter(f => f.enabled);
  const originalCount = originalRows.length;
  const filteredCount = filteredRows.length;

  const reductionPercentage = originalCount > 0
    ? Math.round(((originalCount - filteredCount) / originalCount) * 100)
    : 0;

  return {
    originalCount,
    filteredCount,
    reductionPercentage,
    activeFiltersCount: activeFilters.length,
  };
}
