import { useEffect, useMemo, useRef } from 'react';
import { StepComponentProps } from '@hierarchidb/plugin-base';
import {
  TabularProvider,
  TabularDataFilter,
  useTabularData,
  type TabularDataFilterProps,
} from '@hierarchidb/ui-tabular-extract';
import type { SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useTabularDataFilter } from '../../hooks/useTabularDataFilter.js';
import type { TabularColumnInfo, TabularColumnType, TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult, TabularFilterRule } from '@hierarchidb/ui-tabular-extract';

type FilterInnerProps<T extends SpreadsheetEntity> = ReturnType<typeof useTabularDataFilter<T>> & {
  setValid: StepComponentProps<T>['setValid'];
  setError: StepComponentProps<T>['setError'];
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
};

const TabularDataFilterInner = <T extends SpreadsheetEntity>({
  pluginId,
  menuContainer,
  initialFilters,
  shouldUploadFirst,
  syncFilters,
  handlePreviewData,
  dialogData,
  setValid,
  setError,
  renderSections,
  onFiltersChanged,
  onPreviewReady,
}: FilterInnerProps<T>) => {
  const { t } = useTranslation('spreadsheet-plugin');
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

    const previewRows = dialogData.lastPreview?.rows;
    if (Array.isArray(previewRows) && previewRows.length > 0) {
      const firstRow = previewRows[0] as Record<string, unknown>;
      const keys = Object.keys(firstRow);
      if (keys.length > 0) {
        const columnsFromRows: TabularColumnInfo[] = keys.map((key, index) => ({
          name: key,
          index,
          type: 'string',
        }));
        return {
          ...tabularTableMetadata,
          columns: columnsFromRows,
        } satisfies TabularTableMetadata;
      }
    }

    return tabularTableMetadata;
  }, [dialogData.lastPreview?.columns, dialogData.lastPreview?.rows, tabularTableMetadata]);

  const lastValidRef = useRef<boolean | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (error) {
        if (lastValidRef.current !== false) {
          // debug log for validation churn
          // eslint-disable-next-line no-console
          console.log('[TabularDataFilterStep] setValid(false) due to error', error);
          setValid(false);
          lastValidRef.current = false;
        }
        if (lastErrorRef.current !== error) {
          setError(error);
          lastErrorRef.current = error;
        }
        return;
      }
      if (loading) {
        if (lastValidRef.current !== false) {
          // eslint-disable-next-line no-console
          console.log('[TabularDataFilterStep] setValid(false) due to loading');
          setValid(false);
          lastValidRef.current = false;
        }
        return;
      }
      const nextValid = Boolean(tabularTableMetadata);
      if (lastValidRef.current !== nextValid) {
        // eslint-disable-next-line no-console
        console.log('[TabularDataFilterStep] setValid', nextValid, {
          hasMetadata: Boolean(tabularTableMetadata),
        });
        setValid(nextValid);
        lastValidRef.current = nextValid;
      }
      if (lastErrorRef.current !== null) {
        setError(null);
        lastErrorRef.current = null;
      }
    }, 20); // slight delay to observe rapid loops
    return () => window.clearTimeout(timer);
  }, [error, loading, setError, setValid, tabularTableMetadata]);

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

  return (
    <TabularDataFilter
      tableMetadata={tableMetadata}
      pluginId={pluginId}
      onFiltersChanged={(next) => {
        onFiltersChanged?.(next);
        syncFilters(next);
      }}
      onPreviewData={(preview) => {
        handlePreviewData(preview);
        onPreviewReady?.(preview);
      }}
      initialFilters={initialFilters}
      onSyncFilters={syncFilters}
      menuContainer={menuContainer}
      renderSections={renderSections}
    />
  );
};

export interface TabularDataFilterStepProps<T extends SpreadsheetEntity> extends StepComponentProps<T> {
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
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
}: TabularDataFilterStepProps<T>) => {
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

  return (
    <TabularProvider tabularApi={tabularApi}>
      <TabularDataFilterInner
        pluginId={pluginId}
        menuContainer={menuContainer}
        initialFilters={initialFilters}
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
      />
    </TabularProvider>
  );
};
