/**
 * @file FilterRule.ts
 * @description Filter rule type definitions for StyleMap data processing
 * References:
 * - docs/spec/plugin-stylemap-requirements.md (REQ-104, REQ-303)
 * - ../eria-cartograph/app0/src/domains/resources/stylemap/types/FilterRule.ts
 */

import { generateUUID } from '@hierarchidb/core';

/**
 * Filter action types for data processing
 */
export type FilterAction =
  | 'Include' // Include exact matches
  | 'Exclude' // Exclude exact matches
  | 'IncludePattern' // Include regex pattern matches
  | 'ExcludePattern'; // Exclude regex pattern matches

/**
 * Filter rule for data processing
 * Used to include/exclude rows based on column values
 */
export interface FilterRule {
  /** Unique identifier for the filter rule */
  id: string;
  /** Action to perform when the rule matches */
  action: FilterAction;
  /** Column name to apply the filter to */
  keyColumn: string;
  /** Value or pattern to match against */
  matchValue: string;
  /** Filter operator for comparison */
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'greater_than'
    | 'less_than'
    | 'greater_equal'
    | 'less_equal';
  /** Optional description of the filter rule */
  description?: string;
  /** Whether the rule is enabled */
  enabled?: boolean;
}

/**
 * Filter rule validation result
 */
export interface FilterRuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Filter rule statistics
 */
export interface FilterRuleStats {
  totalRows: number;
  matchedRows: number;
  resultRows: number;
  matchRate: number;
}

/**
 * Create a new filter rule with default values
 */
export function createFilterRule(defaults: Partial<FilterRule> = {}): FilterRule {
  return {
    id: generateUUID(),
    action: defaults.action || 'Include',
    operator: defaults.operator || 'equals',
    keyColumn: defaults.keyColumn || '',
    matchValue: defaults.matchValue || '',
    description: defaults.description,
    enabled: defaults.enabled ?? true,
  };
}

/**
 * Validate a filter rule
 */
export function validateFilterRule(
  rule: FilterRule,
  availableColumns: string[] = []
): FilterRuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!rule.keyColumn) {
    errors.push('Key column is required');
  }

  if (!rule.matchValue) {
    errors.push('Match value is required');
  }

  // Check if column exists in available columns
  if (availableColumns.length > 0 && rule.keyColumn && !availableColumns.includes(rule.keyColumn)) {
    errors.push(`Column "${rule.keyColumn}" not found in available columns`);
  }

  // Validate regex patterns
  if (rule.action === 'IncludePattern' || rule.action === 'ExcludePattern') {
    try {
      new RegExp(rule.matchValue);
    } catch (error) {
      errors.push(`Invalid regular expression: ${rule.matchValue}`);
    }
  }

  // Warnings for potentially problematic patterns
  if (rule.matchValue.length > 1000) {
    warnings.push('Very long match value may impact performance');
  }

  if (rule.action.includes('Pattern') && rule.matchValue.includes('.*.*.*')) {
    warnings.push('Complex regex pattern may impact performance');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create template filter rules for common data patterns
 */
export function createTemplateFilterRules(
  columns: string[],
  dataType: 'population' | 'economic' | 'geographic' | 'temporal' = 'geographic'
): FilterRule[] {
  switch (dataType) {
    case 'population':
      return createPopulationFilterRules(columns);
    case 'economic':
      return createEconomicFilterRules(columns);
    case 'temporal':
      return createTemporalFilterRules(columns);
    case 'geographic':
    default:
      return createGeographicFilterRules(columns);
  }
}

/**
 * Create filter rules for population data
 */
function createPopulationFilterRules(columns: string[]): FilterRule[] {
  const rules: FilterRule[] = [];

  // Add Year filter if Year column exists
  const yearColumn = columns.find((col) => /^(year|date|time)$/i.test(col.trim()));

  if (yearColumn) {
    rules.push(
      createFilterRule({
        action: 'Include',
        keyColumn: yearColumn,
        matchValue: new Date().getFullYear().toString(),
        description: 'Include current year data',
      })
    );
  }

  // Add country code filter to exclude aggregated regions
  const countryCodeColumn = columns.find((col) => /^(country|code|iso|region)$/i.test(col.trim()));

  if (countryCodeColumn) {
    rules.push(
      createFilterRule({
        action: 'ExcludePattern',
        keyColumn: countryCodeColumn,
        matchValue:
          '^(WLD|IBT|LMY|MID|IBD|EAR|LMC|UMC|EAP|TEA|SAS|TSA|IDA|HIC|OED|IDX|SSF|TSS|SSA|LDC|PST|PRE|FCS|HPC|AFE|LIC|LCN|TLA|IDB|LAC|AFW|MEA|ARB|TEC|EUU|MNA|TNM|NAC|EMU|ECA|CEB|MIC|EAS|LTE|TMN|ECS)$',
        description: 'Exclude regional aggregates and organizations',
      })
    );
  }

  return rules;
}

/**
 * Create filter rules for economic data
 */
function createEconomicFilterRules(columns: string[]): FilterRule[] {
  const rules: FilterRule[] = [];

  // Filter out missing data indicators
  const valueColumns = columns.filter((col) =>
    /^(value|amount|gdp|income|revenue)$/i.test(col.trim())
  );

  valueColumns.forEach((column) => {
    rules.push(
      createFilterRule({
        action: 'ExcludePattern',
        keyColumn: column,
        matchValue: '^(\\.\\.|\\.\\.|N\\/A|NULL|null|undefined|-)$',
        description: `Exclude missing values in ${column}`,
      })
    );
  });

  return rules;
}

/**
 * Create filter rules for temporal data
 */
function createTemporalFilterRules(columns: string[]): FilterRule[] {
  const rules: FilterRule[] = [];

  // Filter for recent years (last 5 years)
  const yearColumn = columns.find((col) => /^(year|date)$/i.test(col.trim()));

  if (yearColumn) {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;

    rules.push(
      createFilterRule({
        action: 'IncludePattern',
        keyColumn: yearColumn,
        matchValue: `^(${Array.from({ length: 6 }, (_, i) => startYear + i).join('|')})$`,
        description: 'Include data from last 5 years',
      })
    );
  }

  return rules;
}

/**
 * Create filter rules for geographic data
 */
function createGeographicFilterRules(columns: string[]): FilterRule[] {
  const rules: FilterRule[] = [];

  // Find country/region column
  const geoColumn = columns.find((col) =>
    /^(country|region|state|province|city)$/i.test(col.trim())
  );

  if (geoColumn) {
    // Exclude empty/unknown locations
    rules.push(
      createFilterRule({
        action: 'ExcludePattern',
        keyColumn: geoColumn,
        matchValue: '^(unknown|unspecified|\\.\\.|\\.\\.|N\\/A|NULL|null|undefined|-)$',
        description: 'Exclude unknown or unspecified locations',
      })
    );
  }

  return rules;
}

/**
 * Apply filter rules to data rows
 */
export function applyFilterRules(
  rows: Array<Array<string | number>>,
  rules: FilterRule[],
  columns: string[]
): {
  filteredRows: Array<Array<string | number>>;
  stats: FilterRuleStats;
} {
  if (rules.length === 0) {
    return {
      filteredRows: rows,
      stats: {
        totalRows: rows.length,
        matchedRows: rows.length,
        resultRows: rows.length,
        matchRate: 1.0,
      },
    };
  }

  // Filter only enabled rules
  const enabledRules = rules.filter((rule) => rule.enabled !== false);

  if (enabledRules.length === 0) {
    return {
      filteredRows: rows,
      stats: {
        totalRows: rows.length,
        matchedRows: rows.length,
        resultRows: rows.length,
        matchRate: 1.0,
      },
    };
  }

  // Track inclusion/exclusion sets
  const includedRows = new Set<number>();
  const excludedRows = new Set<number>();
  let totalMatches = 0;

  // Process each rule in order
  enabledRules.forEach((rule) => {
    if (!rule.keyColumn || !rule.matchValue) {
      return; // Skip incomplete rules
    }

    const columnIndex = columns.indexOf(rule.keyColumn);
    if (columnIndex === -1) {
      return; // Skip if column not found
    }

    rows.forEach((row, rowIndex) => {
      const cellValue = String(row[columnIndex] || '');
      let matches = false;

      if (rule.action === 'Include' || rule.action === 'Exclude') {
        // Exact match
        matches = cellValue === rule.matchValue;
      } else {
        // Pattern match (regex)
        try {
          const regex = new RegExp(rule.matchValue);
          matches = regex.test(cellValue);
        } catch (e) {
          // Invalid regex, treat as no match
          matches = false;
        }
      }

      if (matches) {
        totalMatches++;

        if (rule.action === 'Include' || rule.action === 'IncludePattern') {
          includedRows.add(rowIndex);
          excludedRows.delete(rowIndex); // Remove from exclusion if previously excluded
        } else {
          excludedRows.add(rowIndex);
          includedRows.delete(rowIndex); // Remove from inclusion if previously included
        }
      }
    });
  });

  // Determine final result based on inclusion rules
  const hasIncludeRules = enabledRules.some(
    (r) => r.action === 'Include' || r.action === 'IncludePattern'
  );

  let filteredRows: Array<Array<string | number>>;

  if (hasIncludeRules) {
    // Only include explicitly included rows that are not excluded
    filteredRows = rows.filter((_, index) => includedRows.has(index) && !excludedRows.has(index));
  } else {
    // Include all rows except explicitly excluded ones
    filteredRows = rows.filter((_, index) => !excludedRows.has(index));
  }

  return {
    filteredRows,
    stats: {
      totalRows: rows.length,
      matchedRows: totalMatches,
      resultRows: filteredRows.length,
      matchRate: rows.length > 0 ? filteredRows.length / rows.length : 0,
    },
  };
}

/**
 * Get unique values from a column for filter value suggestions
 */
export function getColumnUniqueValues(
  rows: Array<Array<string | number>>,
  columns: string[],
  columnName: string,
  limit: number = 100
): Array<string | number> {
  const columnIndex = columns.indexOf(columnName);
  if (columnIndex === -1) {
    return [];
  }

  const uniqueValues = new Set<string | number>();

  for (const row of rows) {
    if (uniqueValues.size >= limit) break;

    const value = row[columnIndex];
    if (value !== undefined && value !== null && value !== '') {
      uniqueValues.add(value);
    }
  }

  return Array.from(uniqueValues).sort();
}
