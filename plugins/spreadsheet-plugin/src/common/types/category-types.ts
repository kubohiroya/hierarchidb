/**
 * @file category-lifecycle-plugin-definition.ts
 * @description Category type definitions for spreadsheet plugin
 */

/**
     */
export type SpreadsheetCategory =
  | 'data-analysis'
  | 'financial'
  | 'inventory'
  | 'reporting'
  | 'dashboard'
  | 'template';

/**
    */
export interface SpreadsheetCategoryConfig {
  value: SpreadsheetCategory;
  label: string;
  color: string;
  description?: string;
}

/**
    */
export const SPREADSHEET_CATEGORIES: SpreadsheetCategoryConfig[] = [
  {
    value: 'data-analysis',
    label: 'Data Analysis',
    color: '#4CAF50',
    description: 'Data analysis and statistical spreadsheets',
  },
  {
    value: 'financial',
    label: 'Financial',
    color: '#2196F3',
    description: 'Budget, accounting, and financial planning',
  },
  {
    value: 'inventory',
    label: 'Inventory',
    color: '#FF9800',
    description: 'Stock management and inventory tracking',
  },
  {
    value: 'reporting',
    label: 'Reporting',
    color: '#9C27B0',
    description: 'Reports and performance dashboards',
  },
  {
    value: 'dashboard',
    label: 'Dashboard',
    color: '#F44336',
    description: 'Real-time dashboards and monitoring',
  },
  {
    value: 'template',
    label: 'Template',
    color: '#795548',
    description: 'Reusable spreadsheet templates',
  },
];
