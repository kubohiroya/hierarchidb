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
import React, { useEffect } from 'react';
import { i18n } from '@hierarchidb/ui-i18n';
import {
  type StylerStepData,
  MAPLIBRE_PROPERTY_METADATA,
  type ColorStyleKeyValue,
  type ScalarStyleKeyValue,
} from '../../common/types/StylerEntity.js';
import type { NodeId } from '@hierarchidb/common-types';
import { wrapDialogStepComponent } from '@hierarchidb/plugin-ui-sdk';
import type { StylerStepProps } from './StylerStepProps.tsx';
import { valueToColor } from '../../common/utils/colorUtils.js';
import type { ColorCalculationResult } from '../../common/types/StylerEntity.js';
import { useStylerPreview } from './hooks/useStylerPreview.js';

const getStylerT = () =>
  typeof i18n.getFixedT === 'function'
    ? i18n.getFixedT(i18n.language ?? 'en', 'styler-plugin')
    : (i18n.t.bind(i18n) as typeof i18n.t);

export const StylerPreviewStep: React.FC<StylerStepProps> = ({
  data,
  onChange,
  onValidate,
  tabularData = [],
  nodeId,
}) => {
  const {
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
  } = useStylerPreview({ data, onValidate, tabularData });
  const targetMeta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;

  useEffect(() => {
    if (!keyColumn || !valueColumn || !targetProperty || !styleType || !sortedPreviewData.length) return;
    const effectiveNodeId: NodeId = (nodeId ??
      (data as { treeNodeId?: string | null })?.treeNodeId ??
      (data as { id?: string | null })?.id ??
      '') as NodeId;

    const colorPairs: ColorStyleKeyValue[] = [];
    const scalarPairs: ScalarStyleKeyValue[] = [];
    const seenKeys = new Set<string>();

    sortedPreviewData.forEach((row) => {
      const rawKey = row[keyColumn];
      if (rawKey === null || rawKey === undefined) return;
      const keyStr = String(rawKey);
      if (seenKeys.has(keyStr)) return;
      seenKeys.add(keyStr);

      if (targetMeta?.type === 'color') {
        const rawValue = row[valueColumn];
        const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (!Number.isFinite(num)) return;
        const colorResult = valueToColor(num, mapping, derivedConfig, numericAllValues);
        colorPairs.push({
          nodeId: effectiveNodeId,
          key: keyStr,
          color: colorResult.color,
        });
      } else if (targetMeta?.type === 'number') {
        const rawValue = row[valueColumn];
        const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (!Number.isFinite(num)) return;
        scalarPairs.push({
          nodeId: effectiveNodeId,
          key: keyStr,
          scalarValue: num,
        });
      }
    });

    const nextStyleKeyValues = targetMeta?.type === 'color'
      ? { colors: colorPairs, scalars: [] as ScalarStyleKeyValue[] }
      : { colors: [] as ColorStyleKeyValue[], scalars: scalarPairs };
    const prev = data?.styleKeyValues ?? {};
    const colorsEqual =
      (prev.colors?.length ?? 0) === nextStyleKeyValues.colors.length &&
      (prev.colors ?? []).every((item, idx) => {
        const next = nextStyleKeyValues.colors[idx];
        return next && item.key === next.key && item.color === next.color && item.nodeId === next.nodeId;
      });
    const scalarsEqual =
      (prev.scalars?.length ?? 0) === nextStyleKeyValues.scalars.length &&
      (prev.scalars ?? []).every((item, idx) => {
        const next = nextStyleKeyValues.scalars[idx];
        return next && item.key === next.key && item.scalarValue === next.scalarValue && item.nodeId === next.nodeId;
      });
    if (colorsEqual && scalarsEqual) {
      return;
    }
    onChange({
      ...(data as StylerStepData),
      styleKeyValues: nextStyleKeyValues,
    });
  }, [
    data,
    derivedConfig,
    keyColumn,
    mapping,
    nodeId,
    numericAllValues,
    onChange,
    sortedPreviewData,
    styleType,
    targetMeta,
    targetProperty,
    valueColumn,
  ]);

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
    <Box
      sx={{
        width: '100%',
        height: '100%',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minHeight: 0,
      }}
    >
      <TableContainer component={Paper} sx={{ flex: 1, minHeight: 0, height: '100%' }}>
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
                      const num = typeof cellValue === 'number' ? cellValue : Number(cellValue);
                      const safeValue = Number.isFinite(num) ? num : 0;
                      const colorResult: ColorCalculationResult = valueToColor(
                        safeValue,
                        mapping,
                        derivedConfig,
                        numericAllValues
                      );
                      if (colorResult?.color) {
                        chip = (
                          <Chip
                            size="small"
                            label={colorResult.color}
                            sx={{
                              width: '72px',
                              justifyContent: 'center',
                              fontFamily: 'Roboto Mono, monospace',
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
                    <TableCell key={`${row}-${col}`} align={isNumeric ? 'right' : 'left'}>
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

      {previewRowsSource.length > 1000 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          {t('stylePreview.truncate', 'Showing preview of first 1,000 rows. Full dataset contains')}{' '}
          {previewRowsSource.length.toLocaleString()} {t('stylePreview.rows', 'rows.')}
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
