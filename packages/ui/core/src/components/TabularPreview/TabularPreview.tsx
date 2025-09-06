import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { GenericDataGrid, type GridColumn } from '@hierarchidb/ui-data-grid';
import { SimpleTableMetadataManager } from '@hierarchidb/table-metadata';
import { TabularQueryService, type ColumnFilter } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

export function TabularPreview({ pluginId, tableId }: { pluginId: 'location' | 'shape' | 'route'; tableId?: string | null }) {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [filterValue, setFilterValue] = useState('');

  const gridColumns = useMemo(() => {
    const cols: GridColumn[] = columns.map((c) => ({ id: c, label: c, sortable: false, filterable: false }));
    return cols;
  }, [columns]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tableId) { setColumns([]); setRows([]); return; }
      setLoading(true); setError(undefined);
      try {
        const manager = new SimpleTableMetadataManager(getDBName(`${pluginId}-metadata-db`));
        const meta = await manager.get(tableId);
        const cols = Array.isArray(meta?.columns) && meta!.columns!.length > 0
          ? (meta!.columns as any[]).map((c: any) => typeof c === 'string' ? c : (c.name || c.id || String(c)))
          : [];
        if (!cancelled) setColumns(cols);
        const svc = new TabularQueryService(pluginId);
        const filters: ColumnFilter[] = selectedColumn && filterValue
          ? [{ column: selectedColumn, op: 'contains', value: filterValue }]
          : [];
        const data = await svc.query(tableId, filters, 1000);
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pluginId, tableId, selectedColumn, filterValue]);

  return (
    <Box sx={{ p: 2, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ flex: 1 }}>データテーブル</Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="tp-col-label">列</InputLabel>
          <Select labelId="tp-col-label" label="列" value={selectedColumn} onChange={(e) => setSelectedColumn(String(e.target.value))}>
            <MenuItem value=""><em>指定なし</em></MenuItem>
            {columns.map((c) => (<MenuItem key={c} value={c}>{c}</MenuItem>))}
          </Select>
        </FormControl>
        <TextField size="small" label="値" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
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
          maxHeight={"100%"}
          rowsPerPage={50}
          stickyHeader
          hover
          striped
        />
      )}
    </Box>
  );
}
