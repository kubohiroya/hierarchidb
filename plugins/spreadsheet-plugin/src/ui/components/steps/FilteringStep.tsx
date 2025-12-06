import { useCallback, useEffect, useMemo, useRef } from 'react';
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

const shallowEqualFilters = (a?: TabularFilterRule[], b?: TabularFilterRule[]): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.id !== right.id ||
      left.column !== right.column ||
      left.operator !== right.operator ||
      left.value !== right.value ||
      left.enabled !== right.enabled
    ) {
      return false;
    }
  }
  return true;
};

const FilteringStepContent: FC<{
  dialogData: SpreadsheetEntity;
  onChange: (data: SpreadsheetEntity) => void;
  setValid: (valid: boolean) => void;
  setError: (error: string | null) => void;
  initialFilters: TabularFilterRule[];
}> = ({ dialogData, onChange, setValid, setError, initialFilters }) => {
  const { tabularTableMetadata, loading, error } = useTabularData({
    tableMetadataId: dialogData.spreadsheetMetadataId,
    pluginId: SPREADSHEET_NODE_TYPE,
    autoload: Boolean(dialogData.spreadsheetMetadataId),
  });

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

  const tableMetadata = useMemo(() => {
    if (!tabularTableMetadata) return null;

    // Use server metadata when columns are present
    if ((tabularTableMetadata.columns?.length ?? 0) > 0) {
      return tabularTableMetadata;
    }

    // Fallback to preview columns (Step2) when metadata.columns is empty
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

    // If still no columns, synthesize placeholder columns from lastPreview rows
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
    setValid(true);
    setError(null);
  }, [setError, setValid]);

  const syncFilters = useCallback((filters: TabularFilterRule[]) => {
    onChange({
      ...dialogData,
      filters,
    });
  }, [dialogData, onChange]);

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
      onPreviewData={handlePreviewData}
      initialFilters={initialFilters}
      onSyncFilters={syncFilters}
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
  const filtersRef = useRef<TabularFilterRule[]>(dialogData.filters ?? []);
  const memoizedFilters = useMemo<TabularFilterRule[]>(() => {
    const next = dialogData.filters ?? [];
    if (shallowEqualFilters(filtersRef.current, next)) {
      return filtersRef.current;
    }
    filtersRef.current = next;
    return next;
  }, [dialogData.filters]);
  const tabularApi = useMemo(() => createSpreadsheetTabularApi(SPREADSHEET_NODE_TYPE), []);

  return (
    <TabularProvider tabularApi={tabularApi}>
      <FilteringStepContent
        dialogData={dialogData}
        onChange={onChange}
        setValid={setValid}
        setError={setError}
        initialFilters={memoizedFilters}
      />
    </TabularProvider>
  );
};
