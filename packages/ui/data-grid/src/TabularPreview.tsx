import { useEffect, useMemo, useState, useId, type ReactElement } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { Add, Delete, FilterAlt, ViewColumn } from '@mui/icons-material';
import { GenericDataGrid } from './GenericDataGrid.js';
import { CrossViewStyles } from './CrossViewStyles.js';
import type { Id } from './CrossViewStyles.js';
import { useCrossHighlightSync } from './hooks/useCrossHighlightSync.js';
import { ensureDefaultStyles } from './utils/ensureDefaultStyles.js';
import { CrossViewSnackbar } from './CrossViewSnackbar.js';
import { getDBName } from '@hierarchidb/util';
import {type  ColumnFilter, SimpleTableMetadataManager, TabularQueryService } from '@hierarchidb/tabular-store';
import { useTranslation } from '../../i18n/src/index.js';

const logTabularPreviewWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[TabularPreview]', message, error);
};

const isValidId = (value: unknown): value is Id => typeof value === 'string' || typeof value === 'number';

type Op = ColumnFilter['op'];

export function TabularPreview({
  pluginId = 'generic',
  tableId,
  rows: providedRows,
  columns: providedColumns,
  height = 420,
}: {
  pluginId?: string;
  tableId?: string | null;
  rows?: Array<Record<string, unknown>>;
  columns?: string[];
  height?: number;
}): ReactElement {
  const { t } = useTranslation('common');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  // Filters: multi-condition AND
  const [filters, setFilters] = useState<Array<{ column: string; op: Op; value: string }>>([]);
  // Column visibility
  const [visibleCols, setVisibleCols] = useState<string[] | null>(null);
  const controlId = useId();

  // Minimal column type compatible with GenericDataGrid
  type GridCol = {
    id: string;
    label: string;
    sortable?: boolean;
    filterable?: boolean;
    width?: number | string;
    align?: 'left' | 'center' | 'right';
    hidden?: boolean;
    // format?: (value: any, row: any) => React.ReactNode; // optional
  };

  const gridColumns = useMemo(() => {
    const active = visibleCols && visibleCols.length > 0 ? visibleCols : columns;
    const cols: GridCol[] = active.map((c) => ({ id: c, label: c, sortable: false, filterable: false }));
    return cols;
  }, [columns, visibleCols]);

  // Cross-view integration: datasetId and common wiring
  const datasetId = useMemo(() => `${pluginId}:${tableId || 'unknown'}` as const, [pluginId, tableId]);
  const { rowSets, dataGrid } = useCrossHighlightSync({ datasetId });
  // Ensure default styles exist for basic hover/select/match visuals
  useEffect(() => {
    if (!tableId) return;
    try {
      ensureDefaultStyles(datasetId, { includeRow: true, includeMap: true });
    } catch (error) {
      logTabularPreviewWarning('Failed to ensure default styles', error);
    }
  }, [datasetId, tableId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Array.isArray(providedRows) && providedRows.length > 0) {
        setColumns(providedColumns?.length ? providedColumns : Object.keys(providedRows[0] ?? {}));
        if (!visibleCols && providedColumns) setVisibleCols(providedColumns);
        setRows(providedRows);
        setLoading(false);
        setError(undefined);
        return;
      }
      if (!tableId) {
        setColumns([]);
        setRows([]);
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        const manager = new SimpleTableMetadataManager(getDBName(`${pluginId}-metadata-db`));
        const meta = await manager.get(tableId);
        type ColumnMeta = string | { name?: unknown; id?: unknown } | undefined | null;
        const rawColumns: ColumnMeta[] = Array.isArray(meta?.columns) ? meta.columns : [];
        const cols = rawColumns
          .map((col: ColumnMeta) => {
            if (typeof col === 'string') return col;
            if (col && typeof col === 'object') {
              if ('name' in col && typeof col.name === 'string') {
                return col.name;
              }
              if ('id' in col) {
                const identifier = col.id;
                if (typeof identifier === 'string' || typeof identifier === 'number') {
                  return String(identifier);
                }
              }
            }
            return undefined;
          })
          .filter((value: string | undefined): value is string => typeof value === 'string');
        if (!cancelled) {
          setColumns(cols);
          if (!visibleCols) setVisibleCols(cols);
        }
        const svc = new TabularQueryService(pluginId);
        const filterArgs: ColumnFilter[] = filters.map(({ column, op, value }) => ({ column, op, value }));
        const data = await svc.query(tableId, filterArgs, 1000);
        if (!cancelled) setRows(data);
        // Auto-detect row→features mapping when possible
        try {
          const pairs: Array<{ rowId: Id; featureIds: Id[] }> = [];
          for (let i = 0; i < Math.min(500, data.length); i++) {
            const row = data[i] as Record<string, unknown> | undefined;
            const rowId = isValidId(row?.id) ? row.id : (i as Id);
            const featureIds = Array.isArray(row?.featureIds)
              ? row?.featureIds.filter(isValidId)
              : isValidId(row?.featureId)
                ? [row?.featureId]
                : [];
            if (featureIds.length > 0) pairs.push({ rowId, featureIds });
          }
          if (pairs.length > 0) CrossViewStyles.setMapping(datasetId, pairs);
        } catch (error) {
          logTabularPreviewWarning('Failed to set row to features mapping', error);
        }
      } catch (err) {
        if (!cancelled) setError((err as {message:string})?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [datasetId, filters, pluginId, tableId, visibleCols, providedRows, providedColumns]);

  const matchedRowSet = useMemo(() => {
    if (rowSets.matched.size > 0) {
      return rowSets.matched;
    }
    const derived = new Set<Id>();
    rows.forEach((row, index) => {
      const rowObj = row as Record<string, unknown> | undefined;
      const identifier = isValidId(rowObj?.id) ? rowObj?.id : (index as Id);
      derived.add(identifier);
    });
    return derived;
  }, [rowSets.matched, rows]);

  const addFilter = () => setFilters((fs) => [...fs, { column: '', op: 'contains', value: '' }]);
  const removeFilter = (i: number) => setFilters((fs) => fs.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, patch: Partial<{ column: string; op: Op; value: string }>) =>
    setFilters((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <Box sx={{ p: 2, height, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Typography variant="subtitle1" sx={{ flex: 1 }}>{t('dataGrid.preview.title', 'Data table')}</Typography>
        {/* Visible columns selector */}
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel htmlFor="tp-cols-label"><ViewColumn fontSize="small" sx={{ mr: 0.5 }} />{t('dataGrid.preview.visibleColumns', 'Visible columns')}</InputLabel>
          <Select<string[]> multiple labelId="tp-cols-label" input={<OutlinedInput label={t('dataGrid.preview.visibleColumns', 'Visible columns')} />} value={visibleCols || []}
                  onChange={(e: SelectChangeEvent<string[]>) => {
                    const value = e.target.value;
                    setVisibleCols(Array.isArray(value) ? value : [value]);
                  }}
                  renderValue={(selected) => {
                    const values = Array.isArray(selected) ? selected : [];
                    const preview = values.slice(0, 3).join(', ');
                    return `${preview}${values.length > 3 ? '…' : ''}`;
                  }}>
            {columns.map((name) => (
              <MenuItem key={name} value={name}>
                <Checkbox checked={(visibleCols || []).indexOf(name) > -1} />
                <ListItemText primary={name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Tooltip title={t('dataGrid.preview.addFilter', 'Add filter')}><IconButton size="small" onClick={addFilter}><Add /></IconButton></Tooltip>
        {filters.length === 0 && <Chip icon={<FilterAlt />} label={t('dataGrid.preview.noFilters', 'No filters (all rows)')} size="small" />}
        {filters.map((f, i) => (
          <Box key={`filters-${f}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id={`${controlId}-col-${i}`} htmlFor={`${controlId}-col-select-${i}`}>{t('dataGrid.preview.column', 'Column')}</InputLabel>
              <Select labelId={`${controlId}-col-${i}`} id={`${controlId}-col-select-${i}`} label={t('dataGrid.preview.column', 'Column')} value={f.column}
                      onChange={(e) => updateFilter(i, { column: String(e.target.value) })}>
                <MenuItem value=""><em>{t('dataGrid.preview.select', 'Select')}</em></MenuItem>
                {columns.map((c) => (<MenuItem key={c} value={c}>{c}</MenuItem>))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id={`${controlId}-op-${i}`} htmlFor={`${controlId}-op-select-${i}`}>{t('dataGrid.preview.operator', 'Operator')}</InputLabel>
              <Select labelId={`${controlId}-op-${i}`} id={`${controlId}-op-select-${i}`} label={t('dataGrid.preview.operator', 'Operator')} value={f.op}
                      onChange={(e) => updateFilter(i, { op: e.target.value as Op })}>
                {(['eq', 'contains', 'gt', 'gte', 'lt', 'lte', 'neq'] as Op[]).map((op) => (
                  <MenuItem key={op} value={op}>{op}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField size="small" label={t('dataGrid.preview.value', 'Value')} id={`${controlId}-value-${i}`} name={`value-${i}`} value={f.value}
                       onChange={(e) => updateFilter(i, { value: e.target.value })} />
            <Tooltip title={t('dataGrid.preview.remove', 'Remove')}><IconButton size="small" onClick={() => removeFilter(i)}><Delete
              fontSize="small" /></IconButton></Tooltip>
          </Box>
        ))}
      </Box>

      {!tableId ? (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">{t('dataGrid.preview.noTable', 'Table not created yet')}</Typography>
        </Paper>
      ) : (
        <GenericDataGrid
          columns={gridColumns}
          rows={rows}
          loading={loading}
          error={error}
          maxHeight={'100%'}
          rowsPerPage={50}
          stickyHeader
          hover
          striped
          // Cross-view synced row state and handlers
          selectedRows={rowSets.selected}
          hoveredRows={rowSets.hovered}
          matchedRows={matchedRowSet}
          disabledRows={rowSets.disabled}
          rowSx={dataGrid.rowSx}
          onRowHover={dataGrid.onRowHover}
          onRowLeave={dataGrid.onRowLeave}
        />
      )}
      {/* Focus detail via Snackbar */}
      {tableId && <CrossViewSnackbar datasetId={datasetId} />}
    </Box>
  );
}
