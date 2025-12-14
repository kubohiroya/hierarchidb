import { useCallback, useMemo, useRef, type RefObject } from 'react';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import type { TabularDataResult, TabularFilterRule } from '@hierarchidb/ui-tabular-extract';
import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';
import { SPREADSHEET_NODE_TYPE } from '../../common/constants.js';
import { createSpreadsheetTabularApi } from '../../services/spreadsheetTabularApiFactory.js';

const coerceDialogData = <T extends SpreadsheetEntity>(value: unknown): T =>
  (typeof value === 'object' && value !== null ? (value as T) : ({} as T));

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

export type UseTabularDataFilterParams<T extends SpreadsheetEntity> = Pick<
  StepComponentProps<T>,
  'data' | 'onChange' | 'setValid' | 'setError'
> & {
  dialogRef?: RefObject<HTMLElement | null>;
};

export interface UseTabularDataFilterResult<T extends SpreadsheetEntity> {
  pluginId: string;
  dialogData: T;
  tabularApi: ReturnType<typeof createSpreadsheetTabularApi>;
  menuContainer: Element | null;
  initialFilters: TabularFilterRule[];
  shouldUploadFirst: boolean;
  syncFilters: (filters: TabularFilterRule[]) => void;
  handlePreviewData: (preview: TabularDataResult) => void;
}

export const useTabularDataFilter = <T extends SpreadsheetEntity>({
  data,
  onChange,
  dialogRef,
}: UseTabularDataFilterParams<T>): UseTabularDataFilterResult<T> => {
  const dialogData = useMemo<T>(() => coerceDialogData<T>(data), [data]);
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

  const syncFilters = useCallback(
    (filters: TabularFilterRule[]) => {
      if (shallowEqualFilters(filtersRef.current, filters)) {
        return;
      }
      filtersRef.current = filters;
      onChange({
        ...dialogData,
        filters,
      });
    },
    [dialogData, onChange],
  );

  const handlePreviewData = useCallback(
    (preview: TabularDataResult) => {
      if (dialogData.lastPreview === preview) {
        return;
      }
      const { rows, ...rest } = preview;
      onChange({
        ...dialogData,
        lastPreview: {
          ...(rest as Omit<TabularDataResult, 'rows'>),
          rows: undefined,
          rowCount: Array.isArray(rows) ? rows.length : (rest as { rowCount?: number }).rowCount ?? 0,
        } as unknown as TabularDataResult,
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
    shouldUploadFirst: !dialogData.spreadsheetMetadataId,
    syncFilters,
    handlePreviewData,
  };
};
