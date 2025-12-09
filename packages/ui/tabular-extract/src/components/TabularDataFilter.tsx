/**
 * @file TabularFilterStep.tsx
 * @description Filter rule creation and preview for Tabular data
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  GlobalStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Abc, Pin, CheckBox, Preview as PreviewIcon } from '@mui/icons-material';
import { useTabularFilter } from '../hooks/useTabularFilter.js';
import { TabularColumnInfo, TabularColumnType, TabularTableMetadata } from '@hierarchidb/tabular-store';
import { TabularDataResult, TabularFilterRule } from '../types/index.js';
import { TabularDataFilterRulesTable, type FilterOperatorOption } from './TabularDataFilterRulesTable.js';
import {LinearProgress} from "@mui/material";

export interface TabularDataFilterProps {
  tableMetadata: TabularTableMetadata;
  /**
   * (Optional) Notify parent immediately when filters change.
   * Use sparingly: syncing on every keystroke can be expensive for host dialogs.
   */
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewData?: (data: TabularDataResult) => void;
  pluginId: string;
  maxPreviewRows?: number;
  initialFilters?: TabularFilterRule[];
  /** 明示的に親へ同期したいときに使うコールバックを受け取る */
  onSyncFilters?: (filters: TabularFilterRule[]) => void;
  /** When provided, keep menus/portals inside the dialog container */
  menuContainer?: Element | null;
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
  pluginId,
  maxPreviewRows = Number.MAX_SAFE_INTEGER,
  initialFilters = [],
  onSyncFilters,
  menuContainer,
}) => {
  const [filters, setFilters] = useState<TabularFilterRule[]>(initialFilters);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const filtersRef = useRef(filters);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    previewData,
    error,
    getFilteredPreview,
    validateFilters,
  } = useTabularFilter({
    tableId: tableMetadata.id,
    pluginId,
    maxPreviewRows,
    initialRules: initialFilters,
  });

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
  const previewColumns: TabularColumnInfo[] = hasPreviewColumns ? previewData!.columns : columnOptions;
  const rowHeight = 44;
  const totalRows = previewData?.rows.length ?? 0;
  const containerHeight = tableContainerRef.current?.clientHeight ?? 420;
  const overscan = 8;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan);
  const visibleRows = previewData ? previewData.rows.slice(startIndex, endIndex) : [];
  const columnWidth = previewColumns.length > 0 ? `${100 / previewColumns.length}%` : 'auto';
  const [tableMaxHeight, setTableMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    const contentEl = tableContainerRef.current?.closest('.MuiDialogContent-root') as HTMLElement | null;
    if (!contentEl) return;
    const updateHeight = () => setTableMaxHeight(contentEl.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, []);

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

  // Update preview data when available
  useEffect(() => {
    if (previewData && onPreviewData) {
      onPreviewData(previewData);
    }
  }, [previewData, onPreviewData]);

  const normalizeType = (type?: TabularColumnType): TabularColumnType => type ?? 'string';
  useEffect(() => {
    if (columnOptions.length === 0) return;
    setFilters((prev) => {
      const nextRules = prev.map((rule) => {
        const columnExists = columnOptions.some((col) => col.name === rule.column);
        const columnName = columnExists ? rule.column : columnOptions[0]?.name ?? rule.column;
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

  return (
    <Box sx={{ p: 3 }}>
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
      <TabularDataFilterRulesTable
        filters={filters}
        onChange={handleFiltersChange}
        onDirty={() => setPreviewDirty(true)}
        columns={columnOptions}
        operatorOptions={FILTER_OPERATORS}
        menuContainer={menuContainer ?? undefined}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3, mt: 2 }}>
          {error}
        </Alert>
      )}

      {previewData && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PreviewIcon fontSize="small" />
                Preview Results
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Rows: {previewData.totalRows.toLocaleString()} • Filters Applied: {enabledFilters.length}
              </Typography>
              {previewDirty && <LinearProgress variant={"indeterminate"}/>}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer
              component={Paper}
              variant="outlined"
              ref={tableContainerRef}
              sx={{
                maxHeight: tableMaxHeight ? `${tableMaxHeight}px` : 'calc(100vh - 320px)',
                height: tableMaxHeight ? `${tableMaxHeight}px` : 'calc(100vh - 320px)',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
              }}
              onWheelCapture={(event) => event.stopPropagation()}
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            >
              <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow sx={{ display: 'table', tableLayout: 'fixed', width: '100%' }}>
                    {previewColumns.map((col: TabularColumnInfo) => (
                      <TableCell key={col.name} sx={{ width: columnWidth, whiteSpace: 'nowrap' }}>
                        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {normalizeType(col.type) === 'number' && <Pin fontSize="small" />}
                          {normalizeType(col.type) === 'boolean' && <CheckBox fontSize="small" />}
                          {(normalizeType(col.type) === 'string' || normalizeType(col.type) === 'date') && <Abc fontSize="small" />}
                          {col.name}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody
                  sx={{ display: 'block', position: 'relative', height: totalRows * rowHeight }}
                >
                  {visibleRows.map((row, virtualIdx) => {
                    const absoluteIndex = startIndex + virtualIdx;
                    const top = absoluteIndex * rowHeight;
                    return (
                      <TableRow
                        key={absoluteIndex}
                        sx={{
                          position: 'absolute',
                          top,
                          left: 0,
                          width: '100%',
                          display: 'table',
                          tableLayout: 'fixed',
                        }}
                      >
                        {previewColumns.map((col: TabularColumnInfo) => (
                          <TableCell key={`${absoluteIndex}-${col.name}`} sx={{ whiteSpace: 'nowrap', width: columnWidth }}>
                            {row?.[col.name]?.toString() ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};
