import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import { useTabularData } from '@hierarchidb/ui-tabular-extract';
import type { TabularColumnInfo, TabularColumnType, TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult, TabularFilterRule } from '@hierarchidb/ui-tabular-extract';
import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';
import { SPREADSHEET_NODE_TYPE } from '../../common/constants.js';
import { createSpreadsheetTabularApi } from '../../services/spreadsheetTabularApiFactory.js';

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

export type UseTabularDataFilterParams = Pick<
  StepComponentProps<SpreadsheetEntity>,
  'data' | 'onChange' | 'setValid' | 'setError'
> & {
  dialogRef?: RefObject<HTMLElement | null>;
};

export interface UseTabularDataFilterResult {
  pluginId: string;
  dialogData: SpreadsheetEntity;
  tabularApi: ReturnType<typeof createSpreadsheetTabularApi>;
  menuContainer: Element | null;
  initialFilters: TabularFilterRule[];
  tableMetadata: TabularTableMetadata | null;
  loading: boolean;
  error: string | null;
  shouldUploadFirst: boolean;
  syncFilters: (filters: TabularFilterRule[]) => void;
  handlePreviewData: (preview: TabularDataResult) => void;
}

export const useTabularDataFilter = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
}: UseTabularDataFilterParams): UseTabularDataFilterResult => {
  const dialogData = useMemo<SpreadsheetEntity>(() => coerceDialogData(data), [data]);
  const filtersRef = useRef<TabularFilterRule[]>(dialogData.filters ?? []);
  const initialFilters = useMemo<TabularFilterRule[]>(() => {
    const next = dialogData.filters ?? [];
    if (shallowEqualFilters(filtersRef.current, next)) {
      return filtersRef.current;
    }
    filtersRef.current = next;
    return next;
  }, [dialogData.filters]);

  const tabularApi = useMemo(() => createSpreadsheetTabularApi(SPREADSHEET_NODE_TYPE), []);
  const menuContainer = useMemo(() => {
    const dialogEl = dialogRef?.current;
    const modalRoot = dialogEl?.closest?.('.MuiModal-root') as Element | null;
    if (modalRoot) return modalRoot;
    const roleDialog = dialogEl?.closest?.('[role="dialog"]') as Element | null;
    if (roleDialog) return roleDialog;
    if (dialogEl) return dialogEl;
    if (typeof document !== 'undefined') {
      const fallbackDialog =
        (document.querySelector('.MuiModal-root') as Element | null) ??
        (document.querySelector('[role="dialog"]') as Element | null);
      if (fallbackDialog) return fallbackDialog;
    }
    return null;
  }, [dialogRef]);

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
    setValid(true);
    setError(null);
  }, [setError, setValid]);

  const syncFilters = useCallback(
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

  return {
    pluginId: SPREADSHEET_NODE_TYPE,
    dialogData,
    tabularApi,
    menuContainer,
    initialFilters,
    tableMetadata,
    loading,
    error: error ?? null,
    shouldUploadFirst: !dialogData.spreadsheetMetadataId,
    syncFilters,
    handlePreviewData,
  };
};
