import { useCallback, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularFilterStep, useTabularData } from '@hierarchidb/ui-tabular-extract';
import type { TabularColumnInfo, TabularColumnType, TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularFilterRule, TabularDataResult } from '@hierarchidb/ui-tabular-extract';
import type { SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';
import { createSpreadsheetTabularApi } from '../../../services/spreadsheetTabularApiFactory.js';
import { SPREADSHEET_NODE_TYPE } from '../../../common/constants.js';

const coerceDialogData = (value: unknown): SpreadsheetEntity =>
  (typeof value === 'object' && value !== null ? (value as SpreadsheetEntity) : {});

const FilteringStepContent: FC<{
  dialogData: SpreadsheetEntity;
  onChange: (data: SpreadsheetEntity) => void;
  setValid: (valid: boolean) => void;
  setError: (error: string | null) => void;
}> = ({ dialogData, onChange, setValid, setError }) => {
  const { tabularTableMetadata, loading, error } = useTabularData({
    tableMetadataId: dialogData.spreadsheetMetadataId,
    pluginId: SPREADSHEET_NODE_TYPE,
    autoload: Boolean(dialogData.spreadsheetMetadataId),
  });

  const tableMetadata = useMemo(() => {
    if (!tabularTableMetadata) return null;
    const hasColumns = (tabularTableMetadata.columns?.length ?? 0) > 0;
    if (hasColumns) return tabularTableMetadata;

    const previewColumns = dialogData.lastPreview?.columns;
    if (previewColumns && previewColumns.length > 0) {
      const columnsFromPreview: TabularColumnInfo[] = previewColumns.map((col, index) => {
        if (typeof col === 'string') {
          return { name: col, index, type: 'string' as TabularColumnType };
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
        return { name: String(col), index, type: 'string' as TabularColumnType };
      });

      return {
        ...tabularTableMetadata,
        columns: columnsFromPreview,
      } as TabularTableMetadata;
    }
    return tabularTableMetadata;
  }, [dialogData.lastPreview?.columns, tabularTableMetadata]);

  useEffect(() => {
    setValid(true);
    setError(null);
  }, [setError, setValid]);

  const handleFiltersChanged = useCallback(
    (filters: TabularFilterRule[]) => {
      onChange({
        ...dialogData,
        filters,
      });
    },
    [dialogData, onChange],
  );

  const handlePreviewData = useCallback(
    (preview: TabularDataResult) => {
      onChange({
        ...dialogData,
        lastPreview: preview,
      });
    },
    [dialogData, onChange],
  );

  if (!dialogData.spreadsheetMetadataId) {
    return (
      <Typography color="text.secondary">
        Upload a dataset in Step 1 to configure filters.
      </Typography>
    );
  }
  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          Loading table metadata...
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
        No table metadata found for the selected dataset.
      </Typography>
    );
  }
  return (
    <TabularFilterStep
      tableMetadata={tableMetadata}
      pluginId={SPREADSHEET_NODE_TYPE}
      onFiltersChanged={handleFiltersChanged}
      onPreviewData={handlePreviewData}
    />
  );
};

export const FilteringStep: FC<StepComponentProps<SpreadsheetEntity>> = ({
  data,
  onChange,
  setValid,
  setError,
}) => {
  const dialogData = useMemo<SpreadsheetEntity>(() => coerceDialogData(data), [data]);
  const tabularApi = useMemo(() => createSpreadsheetTabularApi(SPREADSHEET_NODE_TYPE), []);

  return (
    <TabularProvider tabularApi={tabularApi}>
      <FilteringStepContent
        dialogData={dialogData}
        onChange={onChange}
        setValid={setValid}
        setError={setError}
      />
    </TabularProvider>
  );
};
