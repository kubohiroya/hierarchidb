import type { TabularColumnInfo, TabularColumnType } from '@hierarchidb/tabular-store';
import type { TabularFilterOperator, TabularFilterRule } from '../types/index';
export type FilterOperatorOption = {
  value: TabularFilterOperator;
  label: string;
  types: TabularColumnType[];
};

// Deprecated wrapper kept for backwards compatibility; uses the virtualized implementation.
export { TabularDataFilterRulesVirtual as TabularDataFilterRulesTable } from './TabularDataFilterRulesVirtual.js';
export type { FilterOperatorOption as FilterOperatorOptionDeprecated } from './TabularDataFilterRulesVirtual.js';

export interface LegacyProps {
  filters: TabularFilterRule[];
  onChange: (rules: TabularFilterRule[]) => void;
  onDirty?: () => void;
  columns: TabularColumnInfo[];
  operatorOptions: FilterOperatorOption[];
  defaultExpanded?: boolean;
  menuContainer?: Element | null;
}
