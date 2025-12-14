import {
  Alert,
  AlertTitle,
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@hierarchidb/ui-i18n';
import {
  type StylerMapping,
  StylerMappingDefault,
  StylerConfigDefault,
  type StylerStepData,
  type StylerTableRow,
  MAPLIBRE_PROPERTY_METADATA,
} from '../../common/types/StylerEntity.js';
import { wrapDialogStepComponent } from '@hierarchidb/plugin-ui-sdk';
import type { TabularFilterRule } from '@hierarchidb/ui-tabular-extract';
import type { StylerStepProps } from './StylerStepProps.tsx';
import { valueToColor } from '../../common/utils/colorUtils.js';

const getStylerT = () =>
  typeof i18n.getFixedT === 'function'
    ? i18n.getFixedT(i18n.language ?? 'en', 'styler-plugin')
    : (i18n.t.bind(i18n) as typeof i18n.t);

export const StylerPreviewStep: React.FC<StylerStepProps> = ({
  data,
  onValidate,
  tabularData = [],
}) => {
  const { t } = useTranslation('styler-plugin');
  const mapping: StylerMapping = {
    ...StylerMappingDefault,
    ...(data?.mapping ?? {}),
  };
  const keyColumn =
    data?.keyColumn ??
    mapping.keyColumn ??
    (data?.stylerConfig as { keyColumn?: string } | undefined)?.keyColumn;
  const valueColumn =
    data?.valueColumn ??
    mapping.valueColumn ??
    (data?.stylerConfig as { valueColumn?: string } | undefined)?.valueColumn;
  const targetProperty = mapping.targetProperty;
  const styleType =
    mapping.styleType ??
    (data?.stylerConfig as { styleType?: StylerMapping['styleType'] } | undefined)?.styleType;
  const [sortState, setSortState] = useState<{
    column: string | null;
    direction: 'asc' | 'desc' | null;
  }>({
    column: null,
    direction: null,
  });

  const prepareFilters = useCallback((rules: TabularFilterRule[]): Array<{
    column: string;
    operator: TabularFilterRule['operator'];
    value?: string | number;
    regex?: RegExp;
  }> => {
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
    []
  );

  const previewData = useMemo(() => {
    const preparedFilters = prepareFilters((data?.filters as TabularFilterRule[] | undefined) ?? []);
    const rows: StylerTableRow[] =
      (Array.isArray(tabularData) && tabularData.length > 0
        ? (tabularData as StylerTableRow[])
        : []) ?? [];
    const filtered = preparedFilters.length ? rows.filter((row) => matchesFilters(row, preparedFilters)) : rows;
    return filtered.slice(0, 1000);
  }, [data?.filters, matchesFilters, prepareFilters, tabularData]);

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

  React.useEffect(() => {
    if (onValidate) {
      const ok = Boolean(keyColumn && valueColumn && targetProperty && styleType);
      onValidate(ok);
    }
  }, [onValidate, keyColumn, valueColumn, targetProperty, styleType]);

  if (!keyColumn || !valueColumn || !targetProperty || !styleType) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <AlertTitle>{t('stylePreview.required.title', 'Configuration Required')}</AlertTitle>
          {t(
            'stylePreview.required.body',
            'Please complete style configuration before viewing the preview.'
          )}
          <ul>
            {!keyColumn && (
              <li>{t('stylePreview.required.keyColumn', 'Select a key column for mapping')}</li>
            )}
            {!valueColumn && (
              <li>{t('stylePreview.required.valueColumn', 'Select a value column for mapping')}</li>
            )}
            {!targetProperty && (
              <li>{t('stylePreview.required.targetProperty', 'Select a target property')}</li>
            )}
            {!styleType && (
              <li>{t('stylePreview.required.styleType', 'Select a style type')}</li>
            )}
          </ul>
        </Alert>
      </Box>
    );
  }

  if (previewData.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          <AlertTitle>{t('stylePreview.noData.title', 'No Data Available')}</AlertTitle>
          {t(
            'stylePreview.noData.body',
            'No tabular data is available for preview. Please ensure data has been loaded in previous steps.'
          )}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TableContainer component={Paper} sx={{ maxHeight: 520 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => {
                const isKey = col === keyColumn;
                const isValue = col === valueColumn;
                const isActive = sortState.column === col;
                return (
                  <TableCell
                    key={col}
                    sortDirection={isActive && sortState.direction ? sortState.direction : false}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TableSortLabel
                        active={isActive}
                        direction={sortState.direction ?? 'asc'}
                        hideSortIcon={!isActive}
                        onClick={() => handleToggleSort(col)}
                      >
                        <Typography variant="subtitle2" component="span">
                          {col}
                        </Typography>
                      </TableSortLabel>
                      {isKey && (
                        <Chip
                          label={t('stylePreview.keyColumn', 'Key')}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {isValue && (
                        <Chip
                          label={t('stylePreview.valueColumn', 'Value')}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPreviewData.map((row, idx) => (
              <TableRow key={`${row[keyColumn ?? 'id'] ?? idx}-${idx}`}>
                {columns.map((col) => {
                  const cellValue = row[col];
                  const isValue = col === valueColumn;
                  const isNumeric = numericColumns[col];
                  let chip: React.ReactNode = null;
                  if (isValue && typeof cellValue !== 'undefined' && cellValue !== null) {
                    const meta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;
                    if (!meta || meta.type === 'color') {
                      const colorResult = valueToColor(
                        typeof cellValue === 'number' ? cellValue : Number(cellValue),
                        mapping,
                        data?.stylerConfig ?? StylerConfigDefault,
                        Array.isArray(tabularData)
                          ? (tabularData.map((r) => r[valueColumn ?? '']) as number[])
                          : undefined
                      );
                      if (colorResult?.color) {
                        chip = (
                          <Chip
                            size="small"
                            label={colorResult.color}
                            sx={{
                              backgroundColor: colorResult.color,
                              color: '#000',
                              border: '1px solid rgba(0,0,0,0.12)',
                            }}
                          />
                        );
                      }
                    } else if (meta.type === 'number') {
                      const num = typeof cellValue === 'number' ? cellValue : Number(cellValue);
                      if (!Number.isNaN(num)) {
                        chip = (
                          <Chip
                            size="small"
                            label={num.toFixed(2)}
                            variant="outlined"
                            color="default"
                          />
                        );
                      }
                    }
                  }
                  const displayText =
                    cellValue === null || cellValue === undefined
                      ? '-'
                      : isNumeric && Number.isFinite(Number(cellValue))
                        ? numberFormatter.format(Number(cellValue))
                        : String(cellValue);
                  return (
                    <TableCell key={`${col}-${idx}`} align={isNumeric ? 'right' : 'left'}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                        {chip ? <Box sx={{ flexShrink: 0 }}>{chip}</Box> : null}
                        <Box sx={{ flex: 1, textAlign: isNumeric ? 'right' : 'left' }}>
                          <Typography variant="body2" noWrap>
                            {displayText}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {tabularData.length > 1000 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          {t('stylePreview.truncate', 'Showing preview of first 1,000 rows. Full dataset contains')}{' '}
          {tabularData.length.toLocaleString()} {t('stylePreview.rows', 'rows.')}
        </Alert>
      )}
    </Box>
  );
};

const StylerPreviewComponent = wrapDialogStepComponent(StylerPreviewStep);

export const StylerPreviewDefinition = {
  stepNumber: 5,
  get title() {
    const t = getStylerT();
    return t('stylePreview.title', 'Preview with Style Mapping');
  },
  component: StylerPreviewComponent,
  validation: {
    validate: async (_data: StylerStepData) => {
      return { isValid: true, errors: [] };
    },
  },
};
