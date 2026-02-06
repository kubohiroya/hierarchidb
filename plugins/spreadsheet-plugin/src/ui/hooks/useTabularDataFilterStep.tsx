import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  useTabularData,
  type TabularDataFilterProps,
  type TabularDataResult,
  type TabularFilterRule,
} from '@hierarchidb/ui-tabular';
import type { SpreadsheetDraft } from '../../common/types/SpreadsheetEntity.js';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import type { TabularColumnInfo, TabularColumnType, TabularTableMetadata } from '@hierarchidb/tabular-store';
import { rulesEqual } from '../state/tabularKeyValueAtoms.js';
import type { useTabularKeyValueState } from './useTabularKeyValueState.js';

type KeyValueState = ReturnType<typeof useTabularKeyValueState<SpreadsheetDraft>>;

export interface UseTabularDataFilterStepParams<T extends SpreadsheetDraft> {
  pluginId: string;
  dialogData: T;
  setValid: PluginStepProps<T>['setValid'];
  setError: PluginStepProps<T>['setError'];
  shouldUploadFirst: boolean;
  keyValueValid: boolean;
  keyValueState: KeyValueState;
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
  translationNamespace?: string;
  initialFilters: TabularFilterRule[];
  filtersFromAtom: TabularFilterRule[];
  syncFilters: (filters: TabularFilterRule[]) => void;
  menuContainer: Element | null;
  dialogRef?: PluginStepProps<T>['dialogRef'];
}

export const useTabularDataFilterStep = <T extends SpreadsheetDraft>({
  pluginId,
  dialogData,
  setValid,
  setError,
  shouldUploadFirst,
  keyValueValid,
  keyValueState,
  renderSections,
  onFiltersChanged,
  onPreviewReady,
  translationNamespace,
  initialFilters,
  filtersFromAtom,
  syncFilters,
  menuContainer,
  dialogRef,
}: UseTabularDataFilterStepParams<T>) => {
  const { t } = useTranslation('spreadsheet-plugin');
  const lastValidRef = useRef<boolean | null>(null);
  const {
    columns,
    selectedKeyColumn,
    selectedValueColumn,
    handleKeyColumnChange,
    handleValueColumnChange,
    handleFiltersChanged,
    handlePreviewRows,
    setFilterReady,
  } = keyValueState;

  const { tabularTableMetadata, loading, error } = useTabularData({
    tableMetadataId: dialogData.spreadsheetMetadataId,
    pluginId,
    autoload: Boolean(dialogData.spreadsheetMetadataId),
  });

  const tableMetadata = useMemo(() => {
    if (!tabularTableMetadata) return null;

    if ((tabularTableMetadata.columns?.length ?? 0) > 0) {
      return tabularTableMetadata;
    }

    const previewColumns = dialogData.lastPreview?.columns;
    if (previewColumns && previewColumns.length > 0) {
      const columnsFromPreview: TabularColumnInfo[] = previewColumns.map((col, index) => {
        if (typeof col === 'string') {
          return { name: col, index, type: 'string' };
        }
        if (typeof col === 'object' && col) {
          const asInfo = col as Partial<TabularColumnInfo>;
          return {
            name: asInfo.name ?? `col_${index}`,
            index: typeof asInfo.index === 'number' ? asInfo.index : index,
            type: (asInfo.type as TabularColumnType) ?? 'string',
            hasNullValues: asInfo.hasNullValues,
            sampleValues: asInfo.sampleValues,
          };
        }
        return { name: String(col), index, type: 'string' };
      });

      return {
        ...tabularTableMetadata,
        columns: columnsFromPreview,
      } satisfies TabularTableMetadata;
    }

    // rows are no longer stored on dialogData; fallback to metadata only.
    return tabularTableMetadata;
  }, [dialogData.lastPreview?.columns, tabularTableMetadata]);

  useEffect(() => {
    if (loading || error || !tabularTableMetadata) {
      setFilterReady(false);
      return;
    }
    setFilterReady(true);
  }, [error, loading, setFilterReady, tabularTableMetadata]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (error) {
        setValid(false);
        setError(error);
        return;
      }
      if (loading) {
        setValid(false);
        return;
      }
      const baseValid = Boolean(tabularTableMetadata) && !shouldUploadFirst;
      const nextValid = baseValid && keyValueValid;
      if (lastValidRef.current !== nextValid) {
        setValid(nextValid);
        lastValidRef.current = nextValid;
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [error, keyValueValid, loading, setError, setValid, shouldUploadFirst, tabularTableMetadata]);

  const stableInitialFilters = useMemo<TabularFilterRule[]>(() => {
    if (filtersFromAtom.length && !rulesEqual(filtersFromAtom, initialFilters)) {
      return filtersFromAtom;
    }
    return initialFilters;
  }, [filtersFromAtom, initialFilters]);

  const panelDialogRef = useMemo<React.RefObject<HTMLElement | null> | undefined>(() => {
    if (dialogRef) return dialogRef;
    if (menuContainer) {
      return { current: menuContainer as unknown as HTMLElement };
    }
    return undefined;
  }, [dialogRef, menuContainer]);

  const stablePreviewHandler = useCallback(
    (preview: TabularDataResult) => {
      onPreviewReady?.(preview);
      handlePreviewRows(preview.rows);
    },
    [handlePreviewRows, onPreviewReady]
  );

  const handleSyncFilters = useCallback(
    (filters: TabularFilterRule[]) => {
      syncFilters(filters);
      handleFiltersChanged(filters);
      onFiltersChanged?.(filters);
    },
    [handleFiltersChanged, onFiltersChanged, syncFilters]
  );

  return {
    t,
    tableMetadata,
    loading,
    error,
    stableInitialFilters,
    renderSections,
    renderSectionsProps: {
      columns,
      selectedKeyColumn: selectedKeyColumn ?? '',
      selectedValueColumn: selectedValueColumn ?? '',
      onKeyColumnChange: handleKeyColumnChange,
      onValueColumnChange: handleValueColumnChange,
      translationNamespace,
      dialogRef: panelDialogRef,
      menuContainer,
    },
    stablePreviewHandler,
    handleSyncFilters,
    handlePreviewRows,
  };
};
