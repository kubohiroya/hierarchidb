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
import { CrossViewSnackbar } from './CrossViewSnackbar.js';
import { useTranslation } from '../../i18n/src/index.js';
import { useDataGridPreview, type DataGridPreviewOp } from './hooks/useDataGridPreview.js';
import type { ReactNode } from 'react';

export function DataGridPreview({
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
}): ReactNode {
  const { t } = useTranslation('common');
  const {
    controlId,
    columns,
    loading,
    error,
    filters,
    visibleCols,
    setVisibleCols,
    gridColumns,
    matchedRowSet,
    rowSets,
    dataGrid,
    datasetId,
    sortState,
    sortedRows,
    onSort,
    addFilter,
    removeFilter,
    updateFilter,
  } = useDataGridPreview({ pluginId, tableId, rows: providedRows, columns: providedColumns });

  // Minimal column type compatible with GenericDataGrid

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
                      onChange={(e) => updateFilter(i, { op: e.target.value as DataGridPreviewOp })}>
                {(['eq', 'contains', 'gt', 'gte', 'lt', 'lte', 'neq'] as DataGridPreviewOp[]).map((op) => (
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
          rows={sortedRows as unknown[]}
          loading={loading}
          error={error}
          maxHeight={height}
          rowHeight={42}
          rowsPerPage={50}
          stickyHeader
          hover
          striped
          enableVirtualization
          sortColumn={sortState.column}
          sortDirection={sortState.direction}
          onSort={onSort}
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
