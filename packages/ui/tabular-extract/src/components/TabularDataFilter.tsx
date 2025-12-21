/**
 * @file TabularFilterStep.tsx
 * @description Filter rule creation and preview for Tabular data
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  GlobalStyles,
  Paper,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Preview as PreviewIcon } from '@mui/icons-material';
import { useTabularFilter } from '../hooks/useTabularFilter.js';
import type { TabularColumnInfo, TabularColumnType, TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult, TabularFilterRule, TabularFilterOperator } from '../types/index.js';
import type { FilterOperatorOption } from './TabularDataFilterRulesTable.js';
import { TabularDataFilterRulesVirtual } from './TabularDataFilterRulesVirtual.js';
import { LinearProgress } from '@mui/material';
import { TabularPreviewGrid } from './TabularPreviewGrid.js';

export interface TabularDataFilterProps {
  tableMetadata: TabularTableMetadata;
  /**
   * (Optional) Notify parent immediately when filters change.
   * Use sparingly: syncing on every keystroke can be expensive for host dialogs.
   */
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewData?: (data: TabularDataResult) => void;
  /** Optional: provide raw rows separately to avoid bloating dialogData */
  onPreviewRows?: (rows: TabularDataResult['rows']) => void;
  pluginId: string;
  maxPreviewRows?: number;
  initialFilters?: TabularFilterRule[];
  /** 明示的に親へ同期したいときに使うコールバックを受け取る */
  onSyncFilters?: (filters: TabularFilterRule[]) => void;
  /** When provided, keep menus/portals inside the dialog container */
  menuContainer?: Element | null;
  /** Custom renderer for filter/preview sections */
  renderSections?: (sections: {
    filterRules: ReactNode;
    preview: ReactNode | null;
    error: ReactNode | null;
    previewDirty: boolean;
  }) => ReactNode;
}

const FILTER_OPERATORS: FilterOperatorOption[] = [
  { value: 'equals', label: 'Equals', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'not_equals', label: 'Not Equals', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'contains', label: 'Contains', types: ['string'] },
  { value: 'not_contains', label: 'Does Not Contain', types: ['string'] },
  { value: 'starts_with', label: 'Starts With', types: ['string'] },
  { value: 'ends_with', label: 'Ends With', types: ['string'] },
  { value: 'greater_than', label: 'Greater Than', types: ['number', 'date'] },
  { value: 'less_than', label: 'Less Than', types: ['number', 'date'] },
  { value: 'greater_equal', label: 'Greater Than or Equal', types: ['number', 'date'] },
  { value: 'less_equal', label: 'Less Than or Equal', types: ['number', 'date'] },
  { value: 'is_null', label: 'Is Empty', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'is_not_null', label: 'Is Not Empty', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'regex', label: 'Regular Expression', types: ['string'] },
];

export const TabularDataFilter: React.FC<TabularDataFilterProps> = ({
  tableMetadata,
  onFiltersChanged,
  onPreviewData,
  onPreviewRows,
  pluginId,
  initialFilters = [],
  onSyncFilters,
  menuContainer,
  renderSections,
}) => {
  void menuContainer;
  const [filters, setFilters] = useState<TabularFilterRule[]>(initialFilters);
  const [previewDirty, setPreviewDirty] = useState(false);
  const filtersRef = useRef(filters);

  const {
    previewData,
    error,
    getFilteredPreview,
    validateFilters,
    isLoading,
  } = useTabularFilter({
    tableId: tableMetadata.id,
    pluginId,
    maxPreviewRows: Number.MAX_SAFE_INTEGER,
    initialRules: initialFilters,
  });
  const previewBusy = previewDirty || isLoading;

  const hasMetadataColumns = Boolean(tableMetadata.columns && tableMetadata.columns.length > 0);
  const hasPreviewColumns = Boolean(previewData?.columns && previewData.columns.length > 0);

  // Stabilize column options to avoid rerender loops when upstream passes new array references.
  const columnOptionsRef = useRef<TabularColumnInfo[]>([]);
  const columnOptions: TabularColumnInfo[] = useMemo(() => {
    const nextColumns = hasMetadataColumns ? (tableMetadata.columns ?? []) : (previewData?.columns ?? []);
    const prevColumns = columnOptionsRef.current;
    const sameLength = prevColumns.length === nextColumns.length;
    const shallowEqual =
      sameLength &&
      prevColumns.every((col, idx) => {
        const other = nextColumns[idx];
        return (
          col?.name === other?.name &&
          col?.type === other?.type &&
          col?.index === other?.index
        );
      });
    if (shallowEqual) {
      return prevColumns;
    }
    columnOptionsRef.current = nextColumns;
    return nextColumns;
  }, [hasMetadataColumns, previewData?.columns, tableMetadata.columns]);
  const previewColumns: TabularColumnInfo[] = hasPreviewColumns && previewData?.columns ? previewData?.columns : columnOptions;

  // filters のスナップショットを常に保持（アンマウント時の同期に利用）
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // (オプション) 親へ即時通知したい場合のみ呼ぶ（デバウンスして負荷を下げる）
  useEffect(() => {
    if (!onFiltersChanged) return;
    const timer = window.setTimeout(() => onFiltersChanged(filters), 120);
    return () => window.clearTimeout(timer);
  }, [filters, onFiltersChanged]);

  // Update preview data when available (rows除外 & 変化がある時だけ通知)
  const lastPreviewSignatureRef = useRef<string>('');
  useEffect(() => {
    if (!previewData) return;
    if (onPreviewRows) {
      onPreviewRows(previewData.rows);
    }
    if (!onPreviewData) return;
    const { rows, ...rest } = previewData;
    const rowCount =
      Array.isArray(rows) && typeof rows.length === 'number'
        ? rows.length
        : (rest as { totalRows?: number }).totalRows ?? 0;
    const payload: TabularDataResult = {
      ...(rest as Omit<TabularDataResult, 'rows'>),
      rows: [],
      totalRows: (rest as { totalRows?: number }).totalRows ?? rowCount,
    };
    const signature = JSON.stringify({
      columns: payload.columns,
      totalRows: payload.totalRows,
      rowCount,
      hash: (rest as { hash?: string }).hash ?? null,
    });
    if (signature === lastPreviewSignatureRef.current) return;
    lastPreviewSignatureRef.current = signature;
    onPreviewData(payload);
  }, [previewData, onPreviewData, onPreviewRows]);

  useEffect(() => {
    if (columnOptions.length === 0) return;
    setFilters((prev) => {
      const nextRules = prev.map((rule) => {
        const columnExists = columnOptions.some((col) => col.name === rule.column);
        const columnName = columnExists ? rule.column : columnOptions[0]?.name ?? rule.column;
        const normalizeType = (type?: TabularColumnType): TabularColumnType => type ?? 'string';
        const columnType = normalizeType(columnOptions.find((col) => col.name === columnName)?.type);
        const availableOps = FILTER_OPERATORS.filter((op) => op.types.includes(columnType));
        const operator = availableOps.some((op) => op.value === rule.operator)
          ? rule.operator
          : availableOps[0]?.value ?? rule.operator;
        return {
          ...rule,
          column: columnName,
          operator,
        } as TabularFilterRule;
      });
      const changed =
        nextRules.length !== prev.length ||
        nextRules.some((rule, idx) => {
          const current = prev[idx];
          return (
            !current ||
            current.column !== rule.column ||
            current.operator !== rule.operator
          );
        });
      return changed ? nextRules : prev;
    });
  }, [columnOptions]);

  const enabledFilters = useMemo(() => filters.filter((f) => f.enabled), [filters]);
  const effectiveFilters = enabledFilters.length > 0 ? enabledFilters : filters;
  const hasAnyFilters = filters.length > 0;

  const filtersEqual = useCallback((a: TabularFilterRule[], b: TabularFilterRule[]): boolean => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const left = a[i];
      const right = b[i];
      if (
        !left ||
        !right ||
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
  }, []);

  const handleFiltersChange = useCallback((next: TabularFilterRule[]) => {
    setFilters((prev) => {
      if (filtersEqual(prev, next)) {
        return prev;
      }
      return next;
    });
    setPreviewDirty((prev) => (prev ? prev : true));
  }, [filtersEqual]);

  // 親に明示的に同期するためのヘルパー
  const syncFilters = useCallback(() => {
    onSyncFilters?.(filters);
  }, [filters, onSyncFilters]);

  // コンテキストメニューからフィルタを追加する
  const handleCreateFilterFromCell = useCallback(
    ({
      column,
      operator,
      value,
    }: {
      column: string;
      operator: TabularFilterOperator;
      value: string | number | null;
    }) => {
      if (!column) return;
      const id = `cell-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
      setFilters((prev) => [
        ...prev,
        {
          id,
          column,
          operator,
          value: value ?? '',
          enabled: true,
        },
      ]);
      setPreviewDirty(true);
    },
    []
  );

  // ステップ離脱・ダイアログ閉鎖時にも最新のフィルタを同期する
  useEffect(() => {
    return () => {
      if (onSyncFilters) {
        onSyncFilters(filtersRef.current);
      }
    };
  }, [onSyncFilters]);

  const handlePreview = useCallback(() => {
    syncFilters();
    if (!hasAnyFilters) {
      setPreviewDirty(false);
      return;
    }
    const validation = validateFilters(effectiveFilters);
    if (!validation.isValid) {
      setPreviewDirty(false);
      return;
    }
    getFilteredPreview(effectiveFilters);
    setPreviewDirty(false);
  }, [effectiveFilters, getFilteredPreview, hasAnyFilters, syncFilters, validateFilters]);

  // Keep latest preview handler in a ref to avoid resetting debounce on dependency changes.
  const handlePreviewRef = useRef(handlePreview);
  useEffect(() => {
    handlePreviewRef.current = handlePreview;
  }, [handlePreview]);

  // Auto-preview with debounce after edits.
  useEffect(() => {
    if (!previewDirty) return;
    const timer = window.setTimeout(() => {
      handlePreviewRef.current();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [previewDirty]);

  const rowHeight = 36;
  const previewVisible = Math.max(10, Math.min(previewData?.rows?.length ?? 0, 20));
  const previewHeightRows = Math.max(1, previewVisible - 4);
  const previewHeight = Math.min(480, 48 + rowHeight * previewHeightRows);

  const filterRulesNode = (
    <TabularDataFilterRulesVirtual
      filters={filters}
      onChange={handleFiltersChange}
      onDirty={() => setPreviewDirty(true)}
      columns={columnOptions}
      operatorOptions={FILTER_OPERATORS}
      maxVisibleRows={10}
      rowHeight={rowHeight}
      renderAsAccordion={!renderSections}
      title={renderSections ? '' : 'Filter Rules'}
    />
  );

  // 外部（初期値/atom）から filters が更新された場合に内部状態へ同期する
  useEffect(() => {
    setFilters((prev) => (filtersEqual(prev, initialFilters) ? prev : initialFilters));
  }, [filtersEqual, initialFilters]);

  const previewNode = previewData ? (
    <Paper variant="outlined" sx={{ height: previewHeight, overflowY: 'auto' }}>
      <TabularPreviewGrid
        rows={previewData?.rows ?? []}
        columns={previewColumns.map((c) => c.name ?? '').filter(Boolean)}
        height={previewHeight}
        onCreateFilter={handleCreateFilterFromCell}
        initialVisibleRows={10}
        resizable
        headerCellSx={{ py: 0.5 }}
        totalRowCount={tableMetadata.totalRows}
        filteredRowCount={previewData.totalRows ?? previewData.rows.length}
        hasFilters={filters.length > 0}
      />
    </Paper>
  ) : null;

  const errorNode = error ? (
    <Alert severity="error" sx={{ mb: 3, mt: 2 }}>
      {error}
    </Alert>
  ) : null;

  if (renderSections) {
    return (
      <Box sx={{ p: 2 }}>
        {renderSections({
          filterRules: filterRulesNode,
          preview: previewNode,
          error: errorNode,
          previewDirty: previewBusy,
        })}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <GlobalStyles
        styles={{
          '.MuiPopover-root[aria-hidden="true"], .MuiModal-root[aria-hidden="true"]': {
            pointerEvents: 'none !important',
          },
          '.MuiPopover-root[aria-hidden="true"] *': {
            pointerEvents: 'none !important',
          },
        }}
      />
      {filterRulesNode}
      {errorNode}

      {previewData && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PreviewIcon fontSize="small" />
                Preview Tabular
              </Typography>
              {previewBusy && <LinearProgress variant="indeterminate" sx={{ mt: 0.5 }} />}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 4, mb: 4 }}>
            {previewNode}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};
