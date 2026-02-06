import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult, TabularFilterRule } from '@hierarchidb/ui-tabular';
import type { SpreadsheetDraft } from '../../common/types/SpreadsheetEntity.js';
import {
  binCountAtom,
  filterRulesAtom,
  histogramStatsAtom,
  rulesEqual,
  keyColumnAtom,
  numericValuesAtom,
  tabularProcessingAtom,
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

export interface UseTabularKeyValueStateParams<T extends SpreadsheetDraft> {
  data: T;
  onChange: PluginStepProps<T>['onChange'];
  setError: PluginStepProps<T>['setError'];
  onSetFilterValid: (valid: boolean) => void;
  translationNamespace?: string;
}

export const useTabularKeyValueState = <T extends SpreadsheetDraft>({
  data,
  onChange,
  setError,
  onSetFilterValid,
}: UseTabularKeyValueStateParams<T>) => {
  const [filterReady, setFilterReady] = useState<boolean>(false);
  const previewRowsCacheRef = useRef<Record<string, unknown>[]>([]);
  const setTabularRows = useSetAtom(tabularRowsAtom);
  const setTabularProcessing = useSetAtom(tabularProcessingAtom);
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
    const next = Array.isArray(dialogData.filters) ? (dialogData.filters as TabularFilterRule[]) : [];
    setFilterRules((prev: TabularFilterRule[]) => (rulesEqual(prev, next) ? prev : next));
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

  const deferProcessingUpdate = useCallback((fn: () => void) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => fn());
      return;
    }
    setTimeout(fn, 0);
  }, []);

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
    handleFiltersChanged: (rules: TabularFilterRule[]) =>
      setFilterRules((prev: TabularFilterRule[]) => (rulesEqual(prev, rules) ? prev : rules)),
    handlePreviewRows: (rows: TabularDataResult['rows']) => {
      const nextRows = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
      setTabularProcessing(true);
      deferProcessingUpdate(() => {
        setTabularRows(nextRows);
        setFilterReady(true);
        // cache lightweight preview rows into dialogData to survive step navigation
        const limited = nextRows.slice(0, 1000);
        const sameRef = previewRowsCacheRef.current === limited;
        const sameLength =
          previewRowsCacheRef.current.length === limited.length &&
          previewRowsCacheRef.current.every((r, i) => r === limited[i]);
        if (!sameRef && !sameLength) {
          previewRowsCacheRef.current = limited;
          onChange({
            ...(dialogData as T),
            previewRows: limited as T['previewRows'],
          });
        }
        setTabularProcessing(false);
      });
    },
    selectedKeyColumn,
    selectedValueColumn,
    setFilterReady,
  };
};
