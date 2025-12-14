import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult, TabularFilterRule } from '@hierarchidb/ui-tabular-extract';
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

const coerceColumns = (
  metadata?: TabularTableMetadata | null,
  previewColumns?: unknown[] | null,
): string[] => {
  const fromMetadata = (metadata?.columns ?? [])
    .map((col) => (typeof col === 'string' ? col : col?.name))
    .filter((name): name is string => Boolean(name));

  const fromPreview =
    Array.isArray(previewColumns) && previewColumns.length > 0
      ? previewColumns
          .map((col, index) => {
            if (typeof col === 'string') return col;
            if (col && typeof col === 'object' && 'name' in col) {
              const name = (col as { name?: string }).name;
              if (typeof name === 'string' && name.trim()) return name;
            }
            return `col_${index}`;
          })
          .filter(Boolean)
      : [];

  return Array.from(new Set([...fromMetadata, ...fromPreview]));
};

export interface UseTabularKeyValueStateParams<T extends SpreadsheetEntity> {
  data: T;
  onChange: StepComponentProps<T>['onChange'];
  setError: StepComponentProps<T>['setError'];
  onSetFilterValid: (valid: boolean) => void;
  translationNamespace?: string;
}

export const useTabularKeyValueState = <T extends SpreadsheetEntity>({
  data,
  onChange,
  setError,
  onSetFilterValid,
}: UseTabularKeyValueStateParams<T>) => {
  const [filterReady, setFilterReady] = useState<boolean>(false);
  const setTabularRows = useSetAtom(tabularRowsAtom);
  const setFilterRules = useSetAtom(filterRulesAtom);
  const setKeyColumnAtom = useSetAtom(keyColumnAtom);
  const setValueColumnAtom = useSetAtom(valueColumnAtom);
  const binCount = useAtomValue(binCountAtom);
  const setBinCount = useSetAtom(binCountAtom);
  const numericValues = useAtomValue(numericValuesAtom);
  const stats = useAtomValue(histogramStatsAtom);
  const [histogramWidth, setHistogramWidth] = useState<number>(480);

  const dialogData = useMemo<T>(() => (typeof data === 'object' && data ? (data as T) : ({} as T)), [data]);

  const columns = useMemo(
    () =>
      coerceColumns(
        dialogData.tabularTableMetadata as TabularTableMetadata | undefined,
        dialogData.lastPreview?.columns ?? null,
      ),
    [dialogData.lastPreview?.columns, dialogData.tabularTableMetadata],
  );

  useEffect(() => {
    setFilterRules(Array.isArray(dialogData.filters) ? (dialogData.filters as TabularFilterRule[]) : []);
  }, [dialogData.filters, setFilterRules]);

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
    [dialogData, mapping, onChange, selectedKeyColumn, setKeyColumnAtom],
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
    [dialogData, mapping, onChange, selectedValueColumn, setValueColumnAtom],
  );

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
        onSetFilterValid(valid);
        lastValidRef.current = valid;
      }
      const nextError = valid ? null : 'Select both key and value columns to continue.';
      if (lastErrorRef.current !== nextError) {
        setError(nextError);
        lastErrorRef.current = nextError;
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [filterReady, selectedKeyColumn, selectedValueColumn, onSetFilterValid, setError]);

  return {
    dialogData,
    columns,
    binCount,
    setBinCount,
    numericValues,
    stats,
    histogramWidth,
    setHistogramWidth,
    handleKeyColumnChange,
    handleValueColumnChange,
    handleFiltersChanged: setFilterRules,
    handlePreviewReady: (preview: TabularDataResult) => {
      const rows = Array.isArray(preview?.rows) ? (preview.rows as Record<string, unknown>[]) : [];
      setTabularRows(rows);
      setFilterReady(true);
    },
    selectedKeyColumn,
    selectedValueColumn,
    setFilterReady,
  };
};
