import { useEffect, useMemo, type FC } from 'react';
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

type FilterInnerProps = ReturnType<typeof useTabularDataFilter> & {
  setValid: StepComponentProps<SpreadsheetEntity>['setValid'];
  setError: StepComponentProps<SpreadsheetEntity>['setError'];
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
};

const TabularDataFilterInner: FC<FilterInnerProps> = ({
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
}) => {
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

  useEffect(() => {
    if (error) {
      setValid(false);
      setError(error);
      return;
    }
    if (loading) {
      setValid(false);
      return;
    }
    setValid(Boolean(tabularTableMetadata));
    setError(null);
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

export interface TabularDataFilterStepProps extends StepComponentProps<SpreadsheetEntity> {
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
}

export const TabularDataFilterStep: FC<TabularDataFilterStepProps> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
  renderSections,
  onFiltersChanged,
  onPreviewReady,
}) => {
  const {
    pluginId,
    tabularApi,
    menuContainer,
    initialFilters,
    shouldUploadFirst,
    syncFilters,
    handlePreviewData,
    dialogData,
  } = useTabularDataFilter({ data, onChange, setValid, setError, dialogRef });

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
