import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import type { TabularColumnInfo, TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult, TabularFilterRule } from '@hierarchidb/ui-tabular-extract';
import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  LinearProgress,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import PreviewIcon from '@mui/icons-material/Preview';
import KeyIcon from '@mui/icons-material/Key';

import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';
import {
  binCountAtom,
  filterRulesAtom,
  histogramStatsAtom,
  keyColumnAtom,
  numericValuesAtom,
  tabularRowsAtom,
  valueColumnAtom,
} from '../state/tabularKeyValueAtoms.js';
import { KeyValueSourcePanel } from '../components/KeyValueSourcePanel.js';
import { ValueHistogram } from '../components/ValueHistogram.js';

const coerceColumns = (
  metadata?: TabularTableMetadata | null,
  previewColumns?: unknown[] | null,
  previewRows?: Record<string, unknown>[],
): string[] => {
  const fromMetadata = (metadata?.columns ?? [])
    .map((col: TabularColumnInfo | string) => (typeof col === 'string' ? col : col.name))
    .filter((name): name is string => Boolean(name));

  const fromPreview = Array.isArray(previewColumns)
    ? previewColumns
        .map((col, index) => {
          if (typeof col === 'string') return col;
          if (col && typeof col === 'object' && 'name' in col) {
            const name = (col as Partial<TabularColumnInfo>).name;
            if (typeof name === 'string' && name.trim()) return name;
          }
          return `col_${index}`;
        })
        .filter(Boolean)
    : [];

  const fromRows =
    Array.isArray(previewRows) && previewRows.length > 0
      ? Object.keys(previewRows[0] as Record<string, unknown>)
      : [];

  return Array.from(new Set([...fromMetadata, ...fromPreview, ...fromRows]));
};

export interface UseTabularKeyValueStateParams<T extends SpreadsheetEntity> {
  data: T;
  onChange: StepComponentProps<T>['onChange'];
  setError: StepComponentProps<T>['setError'];
  dialogRef?: StepComponentProps<T>['dialogRef'];
  onSetFilterValid: (valid: boolean) => void;
  translationNamespace?: string;
}

export const useTabularKeyValueState = <T extends SpreadsheetEntity>({
  data,
  onChange,
  setError,
  dialogRef,
  onSetFilterValid,
  translationNamespace = 'spreadsheet-plugin',
}: UseTabularKeyValueStateParams<T>) => {
  const { t } = useTranslation(translationNamespace);
  const [filterReady, setFilterReady] = useState<boolean>(false);
  const setTabularRows = useSetAtom(tabularRowsAtom);
  const setFilterRules = useSetAtom(filterRulesAtom);
  const setKeyColumnAtom = useSetAtom(keyColumnAtom);
  const setValueColumnAtom = useSetAtom(valueColumnAtom);
  const binCount = useAtomValue(binCountAtom);
  const setBinCount = useSetAtom(binCountAtom);
  const numericValues = useAtomValue(numericValuesAtom);
  const stats = useAtomValue(histogramStatsAtom);
  const histogramContainerRef = useRef<HTMLDivElement | null>(null);
  const [histogramWidth, setHistogramWidth] = useState<number>(480);

  const dialogData = useMemo<T>(() => (typeof data === 'object' && data ? (data as T) : ({} as T)), [data]);

  const columns = useMemo(
    () =>
      coerceColumns(
        dialogData.tabularTableMetadata as TabularTableMetadata | undefined,
        dialogData.lastPreview?.columns ?? null,
        (dialogData.lastPreview?.rows as Record<string, unknown>[] | undefined) ?? [],
      ),
    [dialogData.lastPreview?.columns, dialogData.lastPreview?.rows, dialogData.tabularTableMetadata],
  );

  const valueRows: Record<string, unknown>[] = useMemo(() => {
    const previewRows = dialogData.lastPreview?.rows;
    if (Array.isArray(previewRows) && previewRows.length > 0) {
      return previewRows as Record<string, unknown>[];
    }
    return [];
  }, [dialogData.lastPreview?.rows]);

  const mapping = (dialogData as { mapping?: { keyColumn?: string; valueColumn?: string } }).mapping;
  const stylerConfig = (dialogData as { stylerConfig?: { keyColumn?: string; valueColumn?: string } }).stylerConfig;
  const legacySelection = dialogData as { selectedKeyColumn?: string; selectedValueColumn?: string };

  const selectedValueColumn =
    dialogData.valueColumn ??
    mapping?.valueColumn ??
    legacySelection.selectedValueColumn ??
    stylerConfig?.valueColumn ??
    '';

  const selectedKeyColumn =
    dialogData.keyColumn ??
    mapping?.keyColumn ??
    legacySelection.selectedKeyColumn ??
    stylerConfig?.keyColumn ??
    '';

  const handleKeyColumnChange = useCallback(
    (keyColumn: string) => {
      if (selectedKeyColumn === keyColumn) return;
      const nextData: T = {
        ...(dialogData as T),
        keyColumn,
      };
      if (mapping || 'mapping' in dialogData) {
        (nextData as T & { mapping?: Record<string, unknown> }).mapping = {
          ...(mapping ?? {}),
          keyColumn,
        };
      }
      onChange(nextData);
      setKeyColumnAtom(keyColumn);
    },
    [dialogData, mapping, onChange, setKeyColumnAtom],
  );

  const handleValueColumnChange = useCallback(
    (valueColumn: string) => {
      if (selectedValueColumn === valueColumn) return;
      const nextData: T = {
        ...(dialogData as T),
        valueColumn,
      };
      if (mapping || 'mapping' in dialogData) {
        (nextData as T & { mapping?: Record<string, unknown> }).mapping = {
          ...(mapping ?? {}),
          valueColumn,
        };
      }
      onChange(nextData);
      setValueColumnAtom(valueColumn);
    },
    [dialogData, mapping, onChange, setValueColumnAtom],
  );

  useEffect(() => {
    setFilterRules(Array.isArray(dialogData.filters) ? (dialogData.filters as TabularFilterRule[]) : []);
  }, [dialogData.filters, setFilterRules]);

  useEffect(() => {
    setTabularRows(Array.isArray(valueRows) ? valueRows : []);
  }, [setTabularRows, valueRows]);

  useEffect(() => {
    setKeyColumnAtom(selectedKeyColumn ?? '');
    setValueColumnAtom(selectedValueColumn ?? '');
  }, [selectedKeyColumn, selectedValueColumn, setKeyColumnAtom, setValueColumnAtom]);

  const lastValidRef = useRef<boolean | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hasKeyValue = Boolean(selectedKeyColumn && selectedValueColumn);
      const valid = filterReady && hasKeyValue;
      if (lastValidRef.current !== valid) {
        // eslint-disable-next-line no-console
        console.log('[TabularKeyValueStep] setValid', valid, { filterReady, hasKeyValue });
        onSetFilterValid(valid);
        lastValidRef.current = valid;
      }
      const nextError = valid
        ? null
        : t('styleSettings.keyValuePair.validation.required', 'Select both key and value columns to continue.');
      if (lastErrorRef.current !== nextError) {
        setError(nextError);
        lastErrorRef.current = nextError;
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [filterReady, selectedKeyColumn, selectedValueColumn, onSetFilterValid, setError, t]);

  useEffect(() => {
    const el = histogramContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = (target: Element) => {
      const measured = target.getBoundingClientRect().width;
      if (measured > 0) {
        setHistogramWidth(measured);
      }
    };
    update(el);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const target = entry?.target;
      if (target) {
        update(target);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const keyValueSection = useMemo(
    () => (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {t(
            'styleSettings.keyValuePair.description',
            'Select the key and value columns to drive calculations and review basic statistics.',
          )}
        </Typography>
        <KeyValueSourcePanel
          keyColumn={selectedKeyColumn}
          valueColumn={selectedValueColumn}
          onKeyColumnChange={handleKeyColumnChange}
          onValueColumnChange={handleValueColumnChange}
          menuContainer={(dialogRef?.current as Element | null) ?? null}
          columns={columns}
          translationNamespace={translationNamespace}
        />
        <Divider />
        {stats ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box>
              <Stack spacing={1}>
                <Box component="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      { label: t('styleSettings.keyValuePair.stats.count', 'Count'), value: stats.count },
                      { label: t('styleSettings.keyValuePair.stats.min', 'Min'), value: stats.min },
                      { label: t('styleSettings.keyValuePair.stats.max', 'Max'), value: stats.max },
                      { label: t('styleSettings.keyValuePair.stats.mean', 'Average'), value: stats.mean },
                      { label: t('styleSettings.keyValuePair.stats.median', 'Median'), value: stats.median },
                      { label: t('styleSettings.keyValuePair.stats.stdDev', 'Std Dev'), value: stats.stdDev },
                    ].map(({ label, value }) => (
                      <tr key={label} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                          <Typography variant="body2">{label}</Typography>
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                          <Typography variant="body2">
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(value)}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Stack>
            </Box>
            <Box>
              <Stack spacing={1.5}>
                <Box px={2}>
                  <Typography variant="caption" color="text.secondary">
                    {t('styleSettings.keyValuePair.histogram.binCount', 'Number of bins')}
                  </Typography>
                  <Slider
                    value={binCount}
                    min={1}
                    max={256}
                    step={1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 64, label: '64' },
                      { value: 128, label: '128' },
                      { value: 256, label: '256' },
                    ]}
                    onChange={(_e, value) => setBinCount(value as number)}
                  />
                </Box>
                <Box ref={histogramContainerRef} sx={{ width: '100%' }}>
                  <ValueHistogram
                    values={numericValues}
                    binCount={binCount}
                    width={histogramWidth}
                    height={300}
                    min={stats.min}
                    max={stats.max}
                    mean={stats.mean}
                    valueLabel={
                      selectedValueColumn && typeof selectedValueColumn === 'string'
                        ? selectedValueColumn
                        : t('styleSettings.keyValuePair.value', 'Value') ?? undefined
                    }
                    keyLabel={t('styleSettings.keyValuePair.key', 'frequency') ?? undefined}
                  />
                </Box>
              </Stack>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t(
              'styleSettings.keyValuePair.stats.empty',
              'Select a value column with numeric values to view statistics.',
            )}
          </Typography>
        )}
      </Stack>
    ),
    [
      binCount,
      columns,
      dialogRef,
      handleKeyColumnChange,
      handleValueColumnChange,
      histogramWidth,
      numericValues,
      selectedKeyColumn,
      selectedValueColumn,
      setBinCount,
      stats,
      t,
      translationNamespace,
    ],
  );

  const handleFiltersChanged = useCallback(
    (rules: TabularFilterRule[]) => {
      setFilterRules(rules);
    },
    [setFilterRules],
  );

  const handlePreviewReady = useCallback(
    (preview: TabularDataResult) => {
      if (Array.isArray(preview?.rows)) {
        setTabularRows(preview.rows as Record<string, unknown>[]);
      }
    },
    [setTabularRows],
  );

  const renderSections = useCallback(
    ({
      filterRules,
      preview,
      error,
      previewDirty,
    }: {
      filterRules: ReactNode;
      preview: ReactNode | null;
      error: ReactNode | null;
      previewDirty: boolean;
    }) => (
      <Stack spacing={1}>
        <Accordion defaultExpanded disableGutters square>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FilterAltIcon fontSize="small" />
              <Typography variant="subtitle1">
                {t('styleSettings.filterRules.title', 'Filter Rules')}
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              {filterRules}
              {error}
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded disableGutters square>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
              <PreviewIcon fontSize="small" />
              <Typography variant="subtitle1">
                {t('styleSettings.previewTabular.title', 'Preview Tabular')}
              </Typography>
              {previewDirty && <LinearProgress variant="indeterminate" sx={{ flexGrow: 1, ml: 1 }} />}
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            {preview ?? (
              <Typography variant="body2" color="text.secondary">
                {t('styleSettings.previewTabular.empty', 'Preview data will appear after filters are applied.')}
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded disableGutters square>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <KeyIcon fontSize="small" />
              <Typography variant="subtitle1">
                {t('styleSettings.accordion.previewStats', 'Preview Stats')}
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>{keyValueSection}</AccordionDetails>
        </Accordion>
      </Stack>
    ),
    [keyValueSection, t],
  );

  return {
    dialogData,
    renderSections,
    handleFiltersChanged,
    handlePreviewReady,
    handleFilterStepValid: setFilterReady,
  };
};
