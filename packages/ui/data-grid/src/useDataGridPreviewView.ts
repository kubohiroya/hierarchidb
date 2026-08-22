import type { SelectChangeEvent } from '@mui/material';
import { useCallback, useMemo } from 'react';
import { type DataGridPreviewOp, useDataGridPreview } from './hooks/useDataGridPreview.js';

type UseDataGridPreviewViewArgs = {
  pluginId?: string;
  tableId?: string | null;
  rows?: Array<Record<string, unknown>>;
  columns?: string[];
};

export const useDataGridPreviewView = ({
  pluginId = 'generic',
  tableId,
  rows: providedRows,
  columns: providedColumns,
}: UseDataGridPreviewViewArgs) => {
  const hasProvidedRows = Array.isArray(providedRows) && providedRows.length > 0;

  const dataPreview = useDataGridPreview({
    pluginId,
    tableId,
    rows: providedRows,
    columns: providedColumns,
  });

  const operatorOptions = useMemo<DataGridPreviewOp[]>(
    () => ['eq', 'contains', 'gt', 'gte', 'lt', 'lte', 'neq'],
    []
  );

  const handleVisibleColsChange = useCallback(
    (event: SelectChangeEvent<string[]>) => {
      const value = event.target.value;
      dataPreview.setVisibleCols(Array.isArray(value) ? value : [value]);
    },
    [dataPreview]
  );

  const renderVisibleColsValue = useCallback((selected: unknown) => {
    const values = Array.isArray(selected) ? selected : [];
    const preview = values.slice(0, 3).join(', ');
    return `${preview}${values.length > 3 ? '…' : ''}`;
  }, []);

  const shouldShowTablePlaceholder = !tableId && !hasProvidedRows;

  return {
    ...dataPreview,
    hasProvidedRows,
    operatorOptions,
    handleVisibleColsChange,
    renderVisibleColsValue,
    shouldShowTablePlaceholder,
  };
};
