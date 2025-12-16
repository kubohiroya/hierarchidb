import { useTranslation } from 'react-i18next';
import { i18n } from '@hierarchidb/ui-i18n';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TabularFilterRule } from '@hierarchidb/ui-tabular-extract';
import { tabularRowsAtom } from '@hierarchidb/spreadsheet-plugin';
import {
  StylerConfigDefault,
  StylerMappingDefault,
  type StylerConfig,
  type StylerMapping,
  type StylerTableRow,
} from '../../../common/types/StylerEntity.js';
import { normalizeStylerConfig } from '../../../common/utils/colorUtils.js';
import type { StylerStepProps } from '../StylerStepProps.js';

const useValueColorScale = ({
  baseConfig,
  rows,
  valueColumn,
}: {
  baseConfig: StylerConfig;
  rows: StylerTableRow[];
  valueColumn: string;
}): { derivedConfig: StylerConfig; numericAllValues: number[] } => {
  return useMemo(() => {
    if (!valueColumn) {
      const normalized = normalizeStylerConfig(baseConfig);
      return { derivedConfig: normalized, numericAllValues: [] };
    }
    const numericValues = rows
      .map((r) => r[valueColumn])
      .map((v) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN))
      .map((v) => (Number.isFinite(v) ? v : 0))
      .filter((v) => Number.isFinite(v));

    const hasValues = numericValues.length > 0;
    const min = hasValues ? Math.min(...numericValues) : baseConfig.min;
    const max = hasValues ? Math.max(...numericValues) : baseConfig.max;
    const derivedConfig = normalizeStylerConfig({
      ...baseConfig,
      min,
      max,
    });
    return { derivedConfig, numericAllValues: numericValues };
  }, [baseConfig, rows, valueColumn]);
};

type UseStylerPreviewProps = Pick<StylerStepProps, 'data' | 'tabularData' | 'onValidate'>;

export const useStylerPreview = ({
  data,
  tabularData = [],
  onValidate,
}: UseStylerPreviewProps) => {
  const { t } = useTranslation('styler-plugin');
  const atomRows = useAtomValue(tabularRowsAtom);
  const previewRowsSource =
    tabularData.length > 0
      ? tabularData
      : (data?.previewRows as StylerTableRow[] | undefined) ?? atomRows;
  const mapping: StylerMapping = {
    ...StylerMappingDefault,
    ...(data?.mapping ?? {}),
  };
  const stylerConfig = normalizeStylerConfig(data?.stylerConfig ?? StylerConfigDefault);
  const keyColumn = data?.keyColumn;
  const valueColumn = data?.valueColumn;
  const targetProperty = mapping.targetProperty;
  const styleType = mapping.styleType;
  const [sortState, setSortState] = useState<{
    column: string | null;
    direction: 'asc' | 'desc' | null;
  }>({
    column: null,
    direction: null,
  });

  const prepareFilters = useCallback((rules: TabularFilterRule[]) => {
    return rules
      .filter((rule) => rule.enabled !== false && rule.column)
      .map((rule) => {
        const prepared: {
          column: string;
          operator: TabularFilterRule['operator'];
          value?: string | number;
          regex?: RegExp;
        } = {
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
  }, []);

  const matchesFilters = useCallback(
    (row: StylerTableRow, filters: ReturnType<typeof prepareFilters>): boolean => {
      if (!filters.length) return true;
      const toStr = (v: unknown) => (v === null || v === undefined ? '' : String(v));
      const toNum = (v: unknown): number | null => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) {
          const parsed = Number(v);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };
      return filters.every((filter) => {
        const rowValue = row[filter.column];
        switch (filter.operator) {
          case 'equals':
            return toStr(rowValue) === toStr(filter.value);
          case 'not_equals':
            return toStr(rowValue) !== toStr(filter.value);
          case 'contains':
            return typeof filter.value === 'string'
              ? toStr(rowValue).toLowerCase().includes(filter.value.toLowerCase())
              : false;
          case 'not_contains':
            return typeof filter.value === 'string'
              ? !toStr(rowValue).toLowerCase().includes(filter.value.toLowerCase())
              : true;
          case 'starts_with':
            return typeof filter.value === 'string'
              ? toStr(rowValue).toLowerCase().startsWith(filter.value.toLowerCase())
              : false;
          case 'ends_with':
            return typeof filter.value === 'string'
              ? toStr(rowValue).toLowerCase().endsWith(filter.value.toLowerCase())
              : false;
          case 'greater_than': {
            const rv = toNum(rowValue);
            const fv = toNum(filter.value);
            return rv !== null && fv !== null ? rv > fv : false;
          }
          case 'greater_equal': {
            const rv = toNum(rowValue);
            const fv = toNum(filter.value);
            return rv !== null && fv !== null ? rv >= fv : false;
          }
          case 'less_than': {
            const rv = toNum(rowValue);
            const fv = toNum(filter.value);
            return rv !== null && fv !== null ? rv < fv : false;
          }
          case 'less_equal': {
            const rv = toNum(rowValue);
            const fv = toNum(filter.value);
            return rv !== null && fv !== null ? rv <= fv : false;
          }
          case 'is_null':
            return rowValue === null || rowValue === undefined || rowValue === '';
          case 'is_not_null':
            return !(rowValue === null || rowValue === undefined || rowValue === '');
          case 'regex':
            return filter.regex ? filter.regex.test(toStr(rowValue)) : true;
          default:
            return true;
        }
      });
    },
    [prepareFilters]
  );

  const previewData = useMemo(() => {
    const sourceRows = previewRowsSource;
    const preparedFilters = prepareFilters((data?.filters as TabularFilterRule[] | undefined) ?? []);
    const rows: StylerTableRow[] =
      (Array.isArray(sourceRows) && sourceRows.length > 0 ? (sourceRows as StylerTableRow[]) : []) ?? [];
    const filtered = preparedFilters.length ? rows.filter((row) => matchesFilters(row, preparedFilters)) : rows;
    return filtered.slice(0, 1000);
  }, [data?.filters, matchesFilters, prepareFilters, previewRowsSource]);

  const columns = useMemo(() => Object.keys(previewData[0] ?? {}), [previewData]);

  const sortedPreviewData = useMemo(() => {
    const { column, direction } = sortState;
    if (!column || !direction) return previewData;
    const sorted = [...previewData];
    sorted.sort((a, b) => {
      const av = a[column];
      const bv = b[column];
      const aNum = typeof av === 'number' ? av : Number(av);
      const bNum = typeof bv === 'number' ? bv : Number(bv);
      const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum);
      const cmp = bothNumeric
        ? aNum - bNum
        : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [previewData, sortState]);

  const numericColumns = useMemo(() => {
    const result: Record<string, boolean> = {};
    columns.forEach((col) => {
      const sample = previewData.find(
        (row) => row[col] !== null && row[col] !== undefined && row[col] !== ''
      );
      if (!sample) {
        result[col] = false;
        return;
      }
      const val = sample[col];
      const num = typeof val === 'number' ? val : Number(val);
      result[col] = Number.isFinite(num);
    });
    return result;
  }, [columns, previewData]);

  const { derivedConfig, numericAllValues } = useValueColorScale({
    baseConfig: stylerConfig,
    rows: previewData,
    valueColumn: valueColumn ?? '',
  });

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language || undefined),
    []
  );

  const handleToggleSort = useCallback((column: string) => {
    setSortState((prev) => {
      if (prev.column !== column) return { column, direction: 'asc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      if (prev.direction === 'desc') return { column: null, direction: null };
      return { column, direction: 'asc' };
    });
  }, []);

  useEffect(() => {
    if (onValidate) {
      const ok = Boolean(keyColumn && valueColumn && targetProperty && styleType);
      onValidate(ok);
    }
  }, [onValidate, keyColumn, valueColumn, targetProperty, styleType]);

  return {
    t,
    keyColumn,
    valueColumn,
    targetProperty,
    styleType,
    previewRowsSource,
    previewData,
    sortedPreviewData,
    columns,
    numericColumns,
    derivedConfig,
    numericAllValues,
    numberFormatter,
    handleToggleSort,
    sortState,
    mapping,
  };
};
