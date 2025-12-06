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
  Button,
  CircularProgress,
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
import { ExpandMore as ExpandMoreIcon, ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';
import { useTabularFilter } from '../hooks/useTabularFilter.js';
import { TabularColumnInfo, TabularColumnType, TabularTableMetadata } from '@hierarchidb/tabular-store';
import { TabularDataResult, TabularFilterRule } from '../types/index.js';
import { FilterRulesTable, type FilterOperatorOption } from './FilterRulesTable.js';

export interface TabularFilterStepProps {
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

export const TabularFilterStep: React.FC<TabularFilterStepProps> = ({
  tableMetadata,
  onFiltersChanged,
  onPreviewData,
  pluginId,
  maxPreviewRows = 100,
  initialFilters = [],
  onSyncFilters,
}) => {
  const [filters, setFilters] = useState<TabularFilterRule[]>(initialFilters);
  const filtersRef = useRef(filters);

  const {
    previewData,
    isLoading,
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
  const columnOptions: TabularColumnInfo[] = useMemo(
    () => (hasMetadataColumns ? (tableMetadata.columns ?? []) : (previewData?.columns ?? [])),
    [hasMetadataColumns, previewData?.columns, tableMetadata.columns],
  );
  const previewColumns: TabularColumnInfo[] = hasPreviewColumns ? previewData!.columns : columnOptions;

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
    setFilters((prev) =>
      prev.map((rule) => {
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
      }),
    );
  }, [columnOptions]);

  const enabledFilters = useMemo(() => filters.filter((f) => f.enabled), [filters]);

  const handleFiltersChange = useCallback((next: TabularFilterRule[]) => {
    setFilters(next);
  }, []);

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
    if (enabledFilters.length === 0) return;
    const validation = validateFilters(enabledFilters);
    if (!validation.isValid) return;
    getFilteredPreview(enabledFilters);
  }, [enabledFilters, getFilteredPreview, syncFilters, validateFilters]);

  return (
    <Box
      sx={{ p: 3, maxHeight: '70vh', overflowY: 'auto', overscrollBehavior: 'contain' }}
      onWheelCapture={(event) => event.stopPropagation()}
    >
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
      <FilterRulesTable
        filters={filters}
        onChange={handleFiltersChange}
        columns={columnOptions}
        operatorOptions={FILTER_OPERATORS}
      />

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button
          variant="outlined"
          startIcon={isLoading ? <CircularProgress size={16} /> : <ArrowDownwardIcon />}
          onClick={handlePreview}
          disabled={isLoading || enabledFilters.length === 0}
        >
          {isLoading ? 'Loading Preview...' : 'Preview Filtered Data'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, mt: 2 }}>
          {error}
        </Alert>
      )}

      {previewData && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Preview Results ({previewData.rows.length} rows)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ maxHeight: 360, overflowY: 'auto', overscrollBehavior: 'contain' }}
              onWheelCapture={(event) => event.stopPropagation()}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {previewColumns.map((col: TabularColumnInfo) => (
                      <TableCell key={col.name}>
                        <Typography variant="subtitle2">{col.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {normalizeType(col.type)}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.rows.map((row: Record<string, string | number | null>, index: number) => (
                    <TableRow key={index}>
                      {previewColumns.map((col: TabularColumnInfo) => (
                        <TableCell key={col.name}>{row[col.name]?.toString() || ''}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {previewData.totalRows > previewData.rows.length && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Showing first {previewData.rows.length} of {previewData.totalRows} rows
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {previewData && (
        <Box
          sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Data Summary
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Rows
              </Typography>
              <Typography variant="h6">{previewData.totalRows.toLocaleString()}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Columns
              </Typography>
              <Typography variant="h6">
                {(previewData.columns?.length ?? columnOptions.length).toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Filters Applied
              </Typography>
              <Typography variant="h6">{enabledFilters.length}</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
