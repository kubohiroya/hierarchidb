import { useEffect, useMemo, useState, type ReactElement } from 'react';
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
} from '@mui/material';
import { Add, Delete, FilterAlt, ViewColumn } from '@mui/icons-material';
import { GenericDataGrid } from '@hierarchidb/ui-data-grid';
import { CrossViewStyles, useCrossHighlightSync, CrossViewSnackbar, ensureDefaultStyles } from '../../index';
import { SimpleTableMetadataManager } from '@hierarchidb/table-metadata';
import { type ColumnFilter, TabularQueryService } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

type Op = ColumnFilter['op'];

export function TabularPreview({ pluginId, tableId }: {
  pluginId: 'location' | 'shape' | 'route';
  tableId?: string | null
}): ReactElement {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  // Filters: multi-condition AND
  const [filters, setFilters] = useState<Array<{ column: string; op: Op; value: string }>>([]);
  // Column visibility
  const [visibleCols, setVisibleCols] = useState<string[] | null>(null);

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
    try { ensureDefaultStyles(datasetId, { includeRow: true, includeMap: true }); } catch {}
  }, [datasetId, tableId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        const cols = Array.isArray(meta?.columns) && meta!.columns!.length > 0
          ? (meta!.columns as any[]).map((c: any) => typeof c === 'string' ? c : (c.name || c.id || String(c)))
          : [];
        if (!cancelled) {
          setColumns(cols);
          if (!visibleCols) setVisibleCols(cols);
        }
        const svc = new TabularQueryService(pluginId);
        const data = await svc.query(tableId, filters as ColumnFilter[], 1000);
        if (!cancelled) setRows(data);
        // Auto-detect row→feature mapping when possible
        try {
          const pairs: Array<{ rowId: any; featureIds: any[] }> = [];
          for (let i = 0; i < Math.min(500, data.length); i++) {
            const row: any = data[i];
            const rowId = (row?.id ?? i) as any;
            const featureIds: any[] = Array.isArray(row?.featureIds)
              ? row.featureIds
              : (row?.featureId != null ? [row.featureId] : []);
            if (featureIds.length > 0) pairs.push({ rowId, featureIds });
          }
          if (pairs.length > 0) CrossViewStyles.setMapping(datasetId, pairs);
        } catch {}
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pluginId, tableId, JSON.stringify(filters), JSON.stringify(visibleCols)]);

  const addFilter = () => setFilters((fs) => [...fs, { column: '', op: 'contains', value: '' }]);
  const removeFilter = (i: number) => setFilters((fs) => fs.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, patch: Partial<{ column: string; op: Op; value: string }>) =>
    setFilters((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <Box sx={{ p: 2, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Typography variant="subtitle1" sx={{ flex: 1 }}>データテーブル</Typography>
        {/* Visible columns selector */}
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="tp-cols-label"><ViewColumn fontSize="small" sx={{ mr: 0.5 }} />表示列</InputLabel>
          <Select multiple labelId="tp-cols-label" input={<OutlinedInput label="表示列" />} value={visibleCols || []}
                  onChange={(e) => setVisibleCols(e.target.value as string[])}
                  renderValue={(sel) => (sel as string[]).slice(0, 3).join(', ') + (((sel as string[]).length > 3) ? '…' : '')}>
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
        <Tooltip title="条件追加"><IconButton size="small" onClick={addFilter}><Add /></IconButton></Tooltip>
        {filters.length === 0 && <Chip icon={<FilterAlt />} label="条件なし (全件)" size="small" />}
        {filters.map((f, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id={`col-${i}`}>列</InputLabel>
              <Select labelId={`col-${i}`} label="列" value={f.column}
                      onChange={(e) => updateFilter(i, { column: String(e.target.value) })}>
                <MenuItem value=""><em>選択</em></MenuItem>
                {columns.map((c) => (<MenuItem key={c} value={c}>{c}</MenuItem>))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id={`op-${i}`}>条件</InputLabel>
              <Select labelId={`op-${i}`} label="条件" value={f.op}
                      onChange={(e) => updateFilter(i, { op: e.target.value as Op })}>
                {(['eq', 'contains', 'gt', 'gte', 'lt', 'lte', 'neq'] as Op[]).map((op) => (
                  <MenuItem key={op} value={op}>{op}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField size="small" label="値" value={f.value}
                       onChange={(e) => updateFilter(i, { value: e.target.value })} />
            <Tooltip title="削除"><IconButton size="small" onClick={() => removeFilter(i)}><Delete
              fontSize="small" /></IconButton></Tooltip>
          </Box>
        ))}
      </Box>

      {!tableId ? (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">テーブルがまだ作成されていません</Typography>
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
          matchedRows={rowSets.matched.size > 0 ? rowSets.matched : new Set(rows.map((r, i) => (r as any)?.id ?? i))}
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
