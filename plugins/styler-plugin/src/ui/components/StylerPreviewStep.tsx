import {
  Alert,
  AlertTitle,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import { FixedSizeList } from 'react-window';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { i18n } from '@hierarchidb/ui-i18n';
import {
  type StylerStepData,
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
  } = useStylerPreview({ data, onValidate, tabularData });
  const columnWidth = columns.length ? `${100 / columns.length}%` : '100%';
  const gridTemplateColumns = useMemo(
    () => columns.map(() => 'minmax(0, 1fr)').join(' '),
    [columns]
  );
  const ROW_HEIGHT = 40;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLTableSectionElement | null>(null);
  const [listHeight, setListHeight] = useState<number>(Math.max(ROW_HEIGHT * 8, ROW_HEIGHT));

  useLayoutEffect(() => {
    const updateHeight = () => {
      const containerHeight = containerRef.current?.getBoundingClientRect().height ?? 0;
      const headerHeight = headRef.current?.getBoundingClientRect().height ?? 0;
      const available = containerHeight - headerHeight;
      const fallback = ROW_HEIGHT * Math.min(sortedPreviewData.length, 10);
      const desired = available > 0 ? available : fallback;
      const maxNeeded = Math.max(ROW_HEIGHT, Math.min(sortedPreviewData.length, 2000) * ROW_HEIGHT);
      setListHeight(Math.max(ROW_HEIGHT, Math.min(desired, maxNeeded)));
    };

    updateHeight();
    if (!containerRef.current) return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [sortedPreviewData.length]);

  useEffect(() => {
    if (
      !keyColumn ||
      !valueColumn ||
      !targetProperty ||
      !styleType ||
      !featureIdProperty ||
      (valueType === 'number' && !mappingMode) ||
      !sortedPreviewData.length
    )
      return;
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

      if (valueType === 'color') {
        const rawValue = row[valueColumn];
        if (rawValue === null || rawValue === undefined || rawValue === '') return;
        const isNumeric = typeof rawValue === 'number' || (typeof rawValue === 'string' && rawValue.trim() !== '' && !Number.isNaN(Number(rawValue)));
        const colorResult = isNumeric
          ? valueToColor(Number(rawValue), mapping, derivedConfig, numericAllValues)
          : { color: String(rawValue) };
        colorPairs.push({
          nodeId: effectiveNodeId,
          key: keyStr,
          color: colorResult.color,
        });
      } else {
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

    const nextStyleKeyValues = valueType === 'color'
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
    targetProperty,
    valueColumn,
    valueType,
    mappingMode,
    featureIdProperty,
  ]);

  if (!keyColumn || !valueColumn || !targetProperty || !styleType || !featureIdProperty || (valueType === 'number' && !mappingMode)) {
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
            {!featureIdProperty && (
              <li>{t('stylePreview.required.featureIdProperty', 'Enter a feature ID property')}</li>
            )}
            {!targetProperty && (
              <li>{t('stylePreview.required.targetProperty', 'Select a target property')}</li>
            )}
            {!styleType && (
              <li>{t('stylePreview.required.styleType', 'Select a style type')}</li>
            )}
            {valueType === 'number' && !mappingMode && (
              <li>{t('stylePreview.required.mappingMode', 'Select a mapping mode')}</li>
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
      {isPreviewDeferred && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            {t('stylePreview.processing', 'Preparing preview data...')}
          </Typography>
          <LinearProgress />
        </Stack>
      )}
      <TableContainer
        component={Paper}
        sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
        ref={containerRef}
      >
        <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', flexShrink: 0 }}>
          <colgroup>
            {columns.map((col) => (
              <col key={col} style={{ width: columnWidth }} />
            ))}
          </colgroup>
          <TableHead ref={headRef}>
            <TableRow>
              {columns.map((col) => {
                const isKey = col === keyColumn;
                const isValue = col === valueColumn;
                const isActive = sortState.column === col;
                return (
                  <TableCell
                    key={col}
                    sortDirection={isActive && sortState.direction ? sortState.direction : false}
                    sx={{ width: columnWidth, minWidth: columnWidth, maxWidth: columnWidth }}
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
        </Table>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            position: 'relative',
          }}
        >
          <FixedSizeList
            height={listHeight}
            itemCount={sortedPreviewData.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            overscanCount={8}
          >
            {({ index, style }) => {
              const row = sortedPreviewData[index];
              if (!row) return null;
              const fallbackRowKey = `${index}`;
              const rowKey = `${row[keyColumn ?? 'id'] ?? fallbackRowKey}-${index}`;
              return (
                <Box
                  key={rowKey}
                  style={style}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns,
                    alignItems: 'center',
                    px: 1,
                    gap: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
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
                          const colorLabel = colorResult.color.startsWith('#')
                            ? colorResult.color.toUpperCase()
                            : colorResult.color;
                          chip = (
                            <Tooltip title={colorLabel} arrow describeChild enterDelay={100} placement="right">
                              <Box sx={{ display: 'inline-flex', pointerEvents: 'auto' }}>
                                <Chip
                                  size="small"
                                  label={colorLabel}
                                  sx={{
                                    width: '72px',
                                    justifyContent: 'center',
                                    fontFamily: 'Roboto Mono, monospace',
                                    backgroundColor: colorResult.color,
                                    color: '#000',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    cursor: 'pointer',
                                  }}
                                />
                              </Box>
                            </Tooltip>
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
                      <Box
                        key={`${rowKey}-${col}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          minWidth: 0,
                          px: 1,
                          justifyContent: isNumeric ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {chip ? <Box sx={{ flexShrink: 0, mr: 1 }}>{chip}</Box> : null}
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ flex: 1, textAlign: isNumeric ? 'right' : 'left' }}
                        >
                          {displayText}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              );
            }}
          </FixedSizeList>
        </Box>
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
