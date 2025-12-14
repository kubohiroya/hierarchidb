import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { StepComponentProps } from '@hierarchidb/plugin-base';
import {
  TabularDataFilter,
  TabularProvider,
  useTabularData,
  type TabularDataFilterProps,
  type TabularDataResult,
  type TabularFilterRule,
} from '@hierarchidb/ui-tabular-extract';
import type { SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useTabularDataFilter } from '../../hooks/useTabularDataFilter.js';
import type { TabularColumnInfo, TabularColumnType, TabularTableMetadata } from '@hierarchidb/tabular-store';
import { useTabularKeyValueState } from '../../hooks/useTabularKeyValueState.js';
import { TabularKeyValuePanels } from '../TabularKeyValuePanels.js';
import { filterRulesAtom, rulesEqual } from '../../state/tabularKeyValueAtoms.js';

type FilterInnerProps<T extends SpreadsheetEntity> = ReturnType<typeof useTabularDataFilter<T>> & {
  setValid: StepComponentProps<T>['setValid'];
  setError: StepComponentProps<T>['setError'];
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
  keyValueState: ReturnType<typeof useTabularKeyValueState<T>>;
  keyValueValid: boolean;
  dialogRef?: StepComponentProps<T>['dialogRef'];
  translationNamespace?: string;
};

const TabularDataFilterInner = <T extends SpreadsheetEntity>({
  pluginId,
  menuContainer,
  initialFilters,
  shouldUploadFirst,
  syncFilters,
  dialogData,
  setValid,
  setError,
  renderSections,
  onFiltersChanged,
  onPreviewReady,
  keyValueState,
  keyValueValid,
  dialogRef,
  translationNamespace,
}: FilterInnerProps<T>) => {
  const { t } = useTranslation('spreadsheet-plugin');
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
  const stablePreviewHandler = useCallback(
    (preview: TabularDataResult) => {
      onPreviewReady?.(preview);
    },
    [onPreviewReady],
  );
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

  const lastValidRef = useRef<boolean | null>(null);

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
    }, 20); // slight delay to observe rapid loops
    return () => window.clearTimeout(timer);
  }, [error, keyValueValid, loading, setError, setValid, shouldUploadFirst, tabularTableMetadata]);

  if (shouldUploadFirst) {
    return (
      <Typography color="text.secondary">
        {t('filtering.instructions.uploadFirst', 'Upload a dataset in Step 1 to configure filters.')}
      </Typography>
    );
  }
  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          {t('filtering.loading', 'Loading table metadata...')}
        </Typography>
      </Box>
    );
  }
  if (error) {
    return (
      <Typography color="error">
        {error}
      </Typography>
    );
  }
  if (!tableMetadata) {
    return (
      <Typography color="text.secondary">
        {t('filtering.noMetadata', 'No table metadata found for the selected dataset.')}
      </Typography>
    );
  }

  const renderSectionsNode: NonNullable<TabularDataFilterProps['renderSections']> =
    renderSections ??
    ((sections) => (
      <TabularKeyValuePanels
        dialogRef={dialogRef}
        translationNamespace={translationNamespace}
        columns={columns}
        selectedKeyColumn={selectedKeyColumn}
        selectedValueColumn={selectedValueColumn}
        onKeyColumnChange={handleKeyColumnChange}
        onValueColumnChange={handleValueColumnChange}
        filterRulesSlot={sections.filterRules}
        previewSlot={sections.preview}
        errorSlot={sections.error}
        previewDirty={sections.previewDirty}
      />
    ));

  return (
    <TabularDataFilter
      tableMetadata={tableMetadata}
      pluginId={pluginId}
      onPreviewData={stablePreviewHandler}
      onPreviewRows={handlePreviewRows}
      initialFilters={initialFilters}
      onSyncFilters={(filters: TabularFilterRule[]) => {
        syncFilters(filters);
        handleFiltersChanged(filters);
        // 外部通知は同期タイミングに限定してループを防ぐ
        onFiltersChanged?.(filters);
      }}
      menuContainer={menuContainer}
      renderSections={renderSectionsNode}
    />
  );
};

export interface TabularDataFilterStepProps<T extends SpreadsheetEntity> extends StepComponentProps<T> {
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
  translationNamespace?: string;
}

export const TabularDataFilterStep = <T extends SpreadsheetEntity>({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
  renderSections,
  onFiltersChanged,
  onPreviewReady,
  translationNamespace,
}: TabularDataFilterStepProps<T>) => {
  const [keyValueValid, setKeyValueValid] = useState(false);
  const keyValueState = useTabularKeyValueState<T>({
    data,
    onChange,
    setError,
    onSetFilterValid: setKeyValueValid,
  });
  const {
    pluginId,
    tabularApi,
    menuContainer,
    initialFilters,
    shouldUploadFirst,
    syncFilters,
    handlePreviewData,
    dialogData,
  } = useTabularDataFilter<T>({ data, onChange, setValid, setError, dialogRef });
  const filtersFromAtom = useAtomValue(filterRulesAtom);

  const stableInitialFilters = useMemo<TabularFilterRule[]>(() => {
    if (filtersFromAtom.length && !rulesEqual(filtersFromAtom, initialFilters)) {
      return filtersFromAtom;
    }
    return initialFilters;
  }, [filtersFromAtom, initialFilters]);

  return (
    <TabularProvider tabularApi={tabularApi}>
      <TabularDataFilterInner
        pluginId={pluginId}
        menuContainer={menuContainer}
        initialFilters={stableInitialFilters}
        shouldUploadFirst={shouldUploadFirst}
        syncFilters={syncFilters}
        handlePreviewData={handlePreviewData}
        dialogData={dialogData}
        tabularApi={tabularApi}
        setValid={setValid}
        setError={setError}
        renderSections={renderSections}
        onFiltersChanged={onFiltersChanged}
        onPreviewReady={onPreviewReady}
        keyValueState={keyValueState}
        keyValueValid={keyValueValid}
        dialogRef={dialogRef}
        translationNamespace={translationNamespace}
      />
    </TabularProvider>
  );
};
