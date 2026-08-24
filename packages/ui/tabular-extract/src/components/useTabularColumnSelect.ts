import {
  TabularColumnInfo,
  TabularColumnType,
  TabularTableMetadata,
} from '@hierarchidb/tabular-store';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { TabularColumnMapping } from '../types/index.js';

interface TargetColumn {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

interface UseTabularColumnSelectArgs {
  tableMetadata: TabularTableMetadata;
  targetColumns: TargetColumn[];
  onSelectionChanged: (mapping: TabularColumnMapping[]) => void;
  onPreviewChanged?: (showPreview: boolean) => void;
}

const normalizeType = (type?: TabularColumnType): TabularColumnType => type ?? 'string';

export const useTabularColumnSelect = ({
  tableMetadata,
  targetColumns,
  onSelectionChanged,
  onPreviewChanged,
}: UseTabularColumnSelectArgs) => {
  const controlId = useId();
  const [columnMappings, setColumnMappings] = useState<TabularColumnMapping[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [selectAll, setSelectAll] = useState(true);

  useEffect(() => {
    const cols: TabularColumnInfo[] = tableMetadata.columns ?? [];
    const initialMappings: TabularColumnMapping[] = cols.map((col, index) => ({
      sourceColumn: col.name,
      sourceType: normalizeType(col.type),
      targetColumn: col.name,
      targetType: normalizeType(col.type),
      included: true,
      order: index,
      transform: 'none',
    }));
    setColumnMappings(initialMappings);
  }, [tableMetadata.columns]);

  useEffect(() => {
    onSelectionChanged(columnMappings);
  }, [columnMappings, onSelectionChanged]);

  useEffect(() => {
    onPreviewChanged?.(showPreview);
  }, [showPreview, onPreviewChanged]);

  const updateMapping = useCallback(
    (sourceColumn: string, updater: (mapping: TabularColumnMapping) => TabularColumnMapping) => {
      setColumnMappings((prev) =>
        prev.map((mapping) => (mapping.sourceColumn === sourceColumn ? updater(mapping) : mapping))
      );
    },
    []
  );

  const handleToggleColumn = useCallback(
    (sourceColumn: string, included: boolean) => {
      updateMapping(sourceColumn, (mapping) => ({ ...mapping, included }));
    },
    [updateMapping]
  );

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked);
    setColumnMappings((prev) => prev.map((mapping) => ({ ...mapping, included: checked })));
  }, []);

  const handleColumnRename = useCallback(
    (sourceColumn: string, targetColumn: string) => {
      updateMapping(sourceColumn, (mapping) => ({ ...mapping, targetColumn }));
    },
    [updateMapping]
  );

  const handleTypeChange = useCallback(
    (sourceColumn: string, targetType: string) => {
      updateMapping(sourceColumn, (mapping) => ({
        ...mapping,
        targetType: targetType as TabularColumnType,
      }));
    },
    [updateMapping]
  );

  const handleTargetMapping = useCallback(
    (sourceColumn: string, targetColumn: string) => {
      updateMapping(sourceColumn, (mapping) => ({ ...mapping, targetColumn }));
    },
    [updateMapping]
  );

  const handleOrderChange = useCallback(
    (sourceColumn: string, order: number) => {
      updateMapping(sourceColumn, (mapping) => ({ ...mapping, order }));
    },
    [updateMapping]
  );

  const selectedColumns = useMemo(
    () => columnMappings.filter((mapping) => mapping.included),
    [columnMappings]
  );

  const selectedColumnsSorted = useMemo(
    () => [...selectedColumns].sort((a, b) => a.order - b.order),
    [selectedColumns]
  );

  const validation = useMemo(() => {
    const errors: string[] = [];
    const mappedTargets = selectedColumns.map((mapping) => mapping.targetColumn);

    const requiredColumns = targetColumns.filter((targetColumn) => targetColumn.required);
    for (const required of requiredColumns) {
      if (!mappedTargets.includes(required.name)) {
        errors.push(`Required column "${required.name}" is not mapped`);
      }
    }

    const targetCounts = new Map<string, number>();
    mappedTargets.forEach((target) => {
      targetCounts.set(target, (targetCounts.get(target) || 0) + 1);
    });

    for (const [target, count] of targetCounts) {
      if (count > 1) {
        errors.push(`Target column "${target}" is mapped multiple times`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [selectedColumns, targetColumns]);

  const requiredColumnsCount = useMemo(
    () => targetColumns.filter((targetColumn) => targetColumn.required).length,
    [targetColumns]
  );

  const requiredColumnsMappedCount = useMemo(
    () =>
      targetColumns.filter(
        (targetColumn) =>
          targetColumn.required &&
          columnMappings.some(
            (mapping) => mapping.targetColumn === targetColumn.name && mapping.included
          )
      ).length,
    [columnMappings, targetColumns]
  );

  const selectAllIndeterminate = selectAll !== (selectedColumns.length === columnMappings.length);

  return {
    controlId,
    columnMappings,
    showPreview,
    setShowPreview,
    selectAll,
    selectedColumns,
    selectedColumnsSorted,
    validation,
    requiredColumnsCount,
    requiredColumnsMappedCount,
    selectAllIndeterminate,
    handleToggleColumn,
    handleSelectAll,
    handleColumnRename,
    handleTypeChange,
    handleTargetMapping,
    handleOrderChange,
  };
};
