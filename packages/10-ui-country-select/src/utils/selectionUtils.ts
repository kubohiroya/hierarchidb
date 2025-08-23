/**
 * @fileoverview Utility functions for working with country and matrix selections
 * @module @hierarchidb/ui-country-select/utils
 */

import type { MatrixSelection, MatrixColumn } from '../types/MatrixColumn';
import type { Country } from '../types/Country';

/** Export format for selections */
export interface SelectionExport {
  /** Export timestamp */
  timestamp: string;
  /** Total countries */
  totalCountries: number;
  /** Total selections */
  totalSelections: number;
  /** Column definitions */
  columns: MatrixColumn[];
  /** Selection data */
  selections: MatrixSelection[];
  /** Country metadata */
  countries: Country[];
}

/**
 * Export selections to JSON format
 */
export function exportSelections(
  selections: MatrixSelection[],
  columns: MatrixColumn[],
  countries: Country[]
): SelectionExport {
  const totalSelections = selections.reduce((sum, selection) => {
    return sum + Object.values(selection.selections).filter(Boolean).length;
  }, 0);

  return {
    timestamp: new Date().toISOString(),
    totalCountries: selections.length,
    totalSelections,
    columns,
    selections,
    countries: countries.filter(country => 
      selections.some(s => s.countryCode === country.code)
    ),
  };
}

/**
 * Import selections from JSON format
 */
export function importSelections(data: SelectionExport): {
  selections: MatrixSelection[];
  columns: MatrixColumn[];
  countries: Country[];
} {
  return {
    selections: data.selections || [],
    columns: data.columns || [],
    countries: data.countries || [],
  };
}

/**
 * Convert selections to CSV format
 */
export function selectionsToCSV(
  selections: MatrixSelection[],
  columns: MatrixColumn[],
  countries: Country[]
): string {
  const countryMap = new Map(countries.map(c => [c.code, c]));
  const columnIds = columns.map(c => c.id);
  
  // Header row
  const headers = ['Country Code', 'Country Name', ...columns.map(c => c.label)];
  const rows = [headers.join(',')];
  
  // Data rows
  selections.forEach(selection => {
    const country = countryMap.get(selection.countryCode);
    if (country) {
      const row = [
        selection.countryCode,
        `"${country.name}"`, // Quote to handle commas in names
        ...columnIds.map(colId => selection.selections[colId] ? '1' : '0'),
      ];
      rows.push(row.join(','));
    }
  });
  
  return rows.join('\n');
}

/**
 * Parse CSV format to selections
 */
export function csvToSelections(
  csvData: string,
  columns: MatrixColumn[]
): MatrixSelection[] {
  const lines = csvData.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0]?.split(',') ?? [];
  const dataStartIndex = headers.findIndex(h => columns.some(c => c.label === h));
  
  if (dataStartIndex === -1) return [];
  
  const selections: MatrixSelection[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]?.split(',') ?? [];
    const countryCode = values[0];
    
    if (countryCode) {
      const matrixSelections: Record<string, boolean> = {};
      
      columns.forEach((column, idx) => {
        const valueIndex = dataStartIndex + idx;
        const value = values[valueIndex] ?? '';
        matrixSelections[column.id] = value === '1' || value === 'true';
      });
      
      selections.push({
        countryCode: countryCode ?? '',
        selections: matrixSelections,
      });
    }
  }
  
  return selections;
}

/**
 * Get selections summary statistics
 */
export function getSelectionsSummary(
  selections: MatrixSelection[],
  columns: MatrixColumn[],
  countries: Country[]
) {
  const countryMap = new Map(countries.map(c => [c.code, c]));
  const columnStats: Record<string, { selected: number; countries: string[] }> = {};
  
  // Initialize column stats
  columns.forEach(column => {
    columnStats[column.id] = { selected: 0, countries: [] };
  });
  
  // Calculate stats
  selections.forEach(selection => {
    Object.entries(selection.selections).forEach(([columnId, selected]) => {
      if (selected && columnStats[columnId]) {
        columnStats[columnId]!.selected++;
        columnStats[columnId]!.countries.push(selection.countryCode);
      }
    });
  });
  
  const totalSelections = Object.values(columnStats).reduce((sum, stat) => sum + stat.selected, 0);
  const selectedCountries = selections.filter(s => Object.values(s.selections).some(Boolean));
  
  return {
    totalCountries: selectedCountries.length,
    totalSelections,
    columnStats: columns.map(column => {
      const stats = columnStats[column.id];
      if (!stats) return { column, selected: 0, countries: [], percentage: 0 };
      return {
        column,
        selected: stats.selected,
        countries: stats.countries.map(code => countryMap.get(code)).filter((country): country is Country => Boolean(country)),
        percentage: selectedCountries.length > 0 ? (stats.selected / selectedCountries.length) * 100 : 0,
      };
    }),
  };
}

/**
 * Merge multiple selection sets
 */
export function mergeSelections(
  ...selectionSets: MatrixSelection[][]
): MatrixSelection[] {
  const merged = new Map<string, Record<string, boolean>>();
  
  selectionSets.forEach(selections => {
    selections.forEach(selection => {
      const existing = merged.get(selection.countryCode) || {};
      merged.set(selection.countryCode, {
        ...existing,
        ...selection.selections,
      });
    });
  });
  
  return Array.from(merged.entries()).map(([countryCode, selections]) => ({
    countryCode,
    selections,
  }));
}

/**
 * Filter selections by criteria
 */
export function filterSelections(
  selections: MatrixSelection[],
  criteria: {
    countries?: string[];
    columns?: string[];
    hasAnySelection?: boolean;
    hasAllSelections?: boolean;
  }
): MatrixSelection[] {
  return selections.filter(selection => {
    // Filter by countries
    if (criteria.countries && !criteria.countries.includes(selection.countryCode)) {
      return false;
    }
    
    // Filter by columns
    if (criteria.columns) {
      const relevantSelections = criteria.columns.reduce((acc, colId) => {
        if (selection.selections[colId] !== undefined) {
          acc[colId] = selection.selections[colId]!;
        }
        return acc;
      }, {} as Record<string, boolean>);
      
      selection = { ...selection, selections: relevantSelections };
    }
    
    // Filter by selection presence
    const hasSelections = Object.values(selection.selections);
    if (criteria.hasAnySelection && !hasSelections.some(Boolean)) {
      return false;
    }
    if (criteria.hasAllSelections && !hasSelections.every(Boolean)) {
      return false;
    }
    
    return true;
  });
}