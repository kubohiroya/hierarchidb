/**
 * @file StylerStep6.tsx
 * @description Step 6 wrapper component for Styler table preview
 * :
 * :
 * :
 */

import { wrapDialogStepComponent } from '@hierarchidb/plugin-ui-sdk';
import { Alert, AlertTitle, Box } from '@mui/material';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@hierarchidb/ui-i18n';
import { StylerConfig, StylerMapping, StylerMappingDefault, StylerStepData, StylerTableRow } from '../../common/types/StylerEntity.js';
import { StylerConfigDefault } from '../../common/types/StylerEntity.js';
import { StylerPreviewPanel } from './StylerPreviewPanel.tsx';

import { StylerStepProps } from './StylerStepProps.tsx';
import type { TabularFilterRule } from '@hierarchidb/ui-tabular-extract';

const getStylerT = () =>
  typeof i18n.getFixedT === 'function'
    ? i18n.getFixedT(i18n.language ?? 'en', 'styler-plugin')
    : (i18n.t.bind(i18n) as typeof i18n.t);

export const StylerPreviewStep: React.FC<StylerStepProps> = ({
  data,
  onChange,
  onValidate,
  tabularData = [],
  // columns = [],
}) => {
  const { t } = useTranslation('styler-plugin');
  const config: StylerConfig = data?.stylerConfig || StylerConfigDefault;
  const mapping: StylerMapping = {
    ...StylerMappingDefault,
    ...(data?.mapping ?? {}),
  };
  const keyColumn =
    data?.selectedKeyColumn ??
    mapping.keyColumn ??
    (data?.stylerConfig as { keyColumn?: string } | undefined)?.keyColumn;
  const valueColumn =
    data?.selectedValueColumn ??
    mapping.valueColumn ??
    (data?.stylerConfig as { valueColumn?: string } | undefined)?.valueColumn;
  const targetProperty = mapping.targetProperty;
  const styleType =
    mapping.styleType ??
    (data?.stylerConfig as { styleType?: StylerMapping['styleType'] } | undefined)?.styleType;

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
        : ((data?.lastPreview?.rows as unknown as StylerTableRow[]) ?? [])) ?? [];
    const filtered = preparedFilters.length ? rows.filter((row) => matchesFilters(row, preparedFilters)) : rows;
    return filtered.slice(0, 1000);
  }, [data?.filters, data?.lastPreview?.rows, matchesFilters, prepareFilters, tabularData]);

  //  :
  const handleColumnSelect = useCallback(
    (columnName: string, type: 'key' | 'value') => {
      const updatedData: StylerStepData = {
        ...data,
        [type === 'key' ? 'selectedKeyColumn' : 'selectedValueColumn']: columnName,
      };

      if (data?.stylerConfig) {
        updatedData.stylerConfig = {
          ...data.stylerConfig,
          [type === 'key' ? 'keyColumn' : 'valueColumn']: columnName,
        };
      }

      onChange(updatedData);
    },
    [data, onChange]
  );

  React.useEffect(() => {
    if (onValidate) {
      const ok = Boolean(keyColumn && valueColumn && targetProperty && styleType);
      onValidate(ok);
    }
  }, [onValidate, keyColumn, valueColumn, targetProperty, styleType]);

  //  :
  if (!keyColumn || !valueColumn || !targetProperty || !styleType) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <AlertTitle>{t('step6.required.title', 'Configuration Required')}</AlertTitle>
          {t(
            'step6.required.body',
            'Please complete Step 5 configuration before viewing the preview.'
          )}
          <ul>
            {!keyColumn && (
              <li>{t('step6.required.keyColumn', 'Select a key column for mapping')}</li>
            )}
            {!valueColumn && (
              <li>{t('step6.required.valueColumn', 'Select a value column for mapping')}</li>
            )}
            {!targetProperty && (
              <li>{t('step6.required.targetProperty', 'Select a target property')}</li>
            )}
            {!styleType && (
              <li>{t('step6.required.styleType', 'Select a style type')}</li>
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
          <AlertTitle>{t('step6.noData.title', 'No Data Available')}</AlertTitle>
          {t(
            'step6.noData.body',
            'No tabular data is available for preview. Please ensure data has been loaded in previous steps.'
          )}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      <StylerPreviewPanel
        data={previewData}
        selectedKeyColumn={keyColumn}
        selectedValueColumn={valueColumn}
        mapping={mapping}
        config={config}
        onColumnSelect={handleColumnSelect}
        maxRows={1000}
        enableVirtualization={previewData.length > 100}
      />

      {/*
       */}
      {tabularData.length > 1000 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('step6.truncate', 'Showing preview of first 1,000 rows. Full dataset contains')}{' '}
          {tabularData.length.toLocaleString()} {t('step6.rows', 'rows.') }
        </Alert>
      )}
    </Box>
  );
};

/**
 * : Step
 */
const StylerPreviewComponent = wrapDialogStepComponent(StylerPreviewStep);

export const StylerPreviewDefinition = {
  stepNumber: 6,
  get title() {
    const t = getStylerT();
    return t('step6.title', 'Preview with Style Mapping');
  },
  component: StylerPreviewComponent,
  validation: {
    validate: async (_data: StylerStepData) => {
      //  OK
      return { isValid: true, errors: [] };
    },
  },
};
