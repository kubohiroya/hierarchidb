import { tabularRowsAtom } from '@hierarchidb/spreadsheet-plugin';
import { i18n } from '@hierarchidb/ui-i18n';
import type { TabularFilterRule } from '@hierarchidb/ui-tabular';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAPLIBRE_PROPERTY_METADATA,
  type StylerConfig,
  StylerConfigDefault,
  type StylerMapping,
  StylerMappingDefault,
  type StylerTableRow,
} from '~/common/types/StylerEntity';
import { normalizeStylerConfig } from '~/common/utils/colorUtils';
import { useTabularFilterWorker } from '~/ui/hooks/useTabularFilterWorker';
import type { StylerStepProps } from '~/ui/components/StylerStepProps';

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

export const useStylerPreview = ({ data, tabularData = [], onValidate }: UseStylerPreviewProps) => {
  const { t } = useTranslation('styler-plugin');
  const atomRows = useAtomValue(tabularRowsAtom);
  const previewRowsSource =
    tabularData.length > 0
      ? tabularData
      : ((data?.previewRows as StylerTableRow[] | undefined) ?? atomRows);
  const mapping: StylerMapping = {
    ...StylerMappingDefault,
    ...(data?.mapping ?? {}),
  };
  const stylerConfig = normalizeStylerConfig(data?.stylerConfig ?? StylerConfigDefault);
  const keyColumn = data?.keyColumn;
  const valueColumn = data?.valueColumn;
  const targetProperty = mapping.targetProperty;
  const featureIdProperty = mapping.featureIdProperty;
  const targetMeta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;
  const valueType = mapping.valueType ?? targetMeta?.type ?? 'color';
  const mappingMode = mapping.mappingMode;
  const styleType = mapping.styleType;
  const [sortState, setSortState] = useState<{
    column: string | null;
    direction: 'asc' | 'desc' | null;
  }>({
    column: null,
    direction: null,
  });

  const filters = useMemo<TabularFilterRule[]>(
    () => (Array.isArray(data?.filters) ? (data.filters as TabularFilterRule[]) : []),
    [data?.filters]
  );

  const { filteredRows: previewData, isFiltering: isPreviewDeferred } = useTabularFilterWorker({
    rows: Array.isArray(previewRowsSource) ? (previewRowsSource as StylerTableRow[]) : [],
    filters,
    limit: 1000,
    debounceMs: 240,
  });

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
        : String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
            numeric: true,
            sensitivity: 'base',
          });
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

  const numberFormatter = useMemo(() => new Intl.NumberFormat(i18n.language || undefined), []);

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
      const ok =
        Boolean(keyColumn && valueColumn && targetProperty && styleType && featureIdProperty) &&
        (valueType === 'number' ? Boolean(mappingMode) : Boolean(valueType));
      onValidate(ok);
    }
  }, [
    featureIdProperty,
    keyColumn,
    mappingMode,
    onValidate,
    targetProperty,
    styleType,
    valueColumn,
    valueType,
  ]);

  return {
    t,
    keyColumn,
    valueColumn,
    targetProperty,
    featureIdProperty,
    valueType,
    mappingMode,
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
    isPreviewDeferred,
  };
};
