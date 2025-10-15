import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { useTranslation } from 'react-i18next';
import type { StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { createSpreadsheetCSVApi } from '../ui/facade/index.js';
import type { ColumnFilter, FilterConfig, RowFilter } from '../extension/types.js';
import { PLUGIN_METADATA } from '../extension/constants.js';

interface SpreadsheetFilteringData {
  spreadsheetMetadataId?: string;
  filters?: FilterConfig;
  [key: string]: unknown;
}

interface ColumnSummary {
  name: string;
  visible: boolean;
  order?: number;
}

const DEFAULT_OPERATORS: RowFilter['operator'][] = [
  'contains',
  'equals',
  'starts_with',
  'ends_with',
];
const PRIMARY_OPERATOR: RowFilter['operator'] = DEFAULT_OPERATORS[0]!;

const ensureFilterConfig = (config?: FilterConfig): FilterConfig => ({
  rows: Array.isArray(config?.rows) ? [...config!.rows] : [],
  columns: Array.isArray(config?.columns) ? [...config!.columns] : [],
});

const ensureColumnFilters = (metadataColumns: string[], existing: ColumnFilter[]): ColumnSummary[] => {
  if (metadataColumns.length === 0 && existing.length > 0) {
    return existing.map((column, index) => ({
      name: column.name,
      visible: column.visible,
      order: column.order ?? index,
    }) as ColumnSummary);
  }
  const byName = new Map(existing.map((entry) => [entry.name, entry] as const));
  return metadataColumns.map((name, index) => {
    const current = byName.get(name);
    return {
      name,
      visible: current?.visible ?? true,
      order: current?.order ?? index,
    } as ColumnSummary;
  });
};

const toFilterConfig = (columns: ColumnSummary[], rows: RowFilter[]): FilterConfig => ({
  columns: columns.map((column, index) => ({
    name: column.name,
    visible: column.visible,
    order: column.order ?? index,
  })),
  rows,
});

export const FilteringStep: FC<StepComponentProps> = ({ data, onChange, setValid, setError }) => {
  const { t } = useTranslation('spreadsheet-plugin');
  const dialogData: SpreadsheetFilteringData = useMemo(() => (
    typeof data === 'object' && data !== null ? data as SpreadsheetFilteringData : {}
  ), [data]);

  const initialFilterConfig = useMemo(() => ensureFilterConfig(dialogData.filters), [dialogData.filters]);

  const [columns, setColumns] = useState<ColumnSummary[]>(() => ensureColumnFilters([], initialFilterConfig.columns));
  const [rowFilters, setRowFilters] = useState<RowFilter[]>(initialFilterConfig.rows);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setValid(true);
    setError(null);
  }, [setValid, setError]);

  useEffect(() => {
    const config = ensureFilterConfig(dialogData.filters);
    setRowFilters(config.rows);
  }, [dialogData.filters]);

  useEffect(() => {
    let cancelled = false;
    const metadataId = dialogData.spreadsheetMetadataId;
    if (!metadataId) {
      setColumns(ensureColumnFilters([], ensureFilterConfig(dialogData.filters).columns));
      return;
    }

    const api = createSpreadsheetCSVApi(PLUGIN_METADATA.NODE_TYPE);
    setLoading(true);
    setLoadError(null);

    api.getTableMetadata(metadataId)
      .then((metadata) => {
        if (cancelled) return;
        const columnNames = metadata?.columns?.map((column) => column.name).filter(Boolean) ?? [];
        const existing = ensureFilterConfig(dialogData.filters).columns;
        setColumns(ensureColumnFilters(columnNames, existing));
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[FilteringStep] Failed to load metadata columns', error);
        setColumns(ensureColumnFilters([], ensureFilterConfig(dialogData.filters).columns));
        setLoadError(t('filtering.errors.metadataFetch', 'Unable to load column metadata. You can still configure filters manually.'));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dialogData.filters, dialogData.spreadsheetMetadataId, t]);

  const commitFilters = useCallback((nextColumns: ColumnSummary[], nextRows: RowFilter[]) => {
    setColumns(nextColumns);
    setRowFilters(nextRows);
    onChange({
      ...dialogData,
      filters: toFilterConfig(nextColumns, nextRows),
    });
  }, [dialogData, onChange]);

  const handleToggleColumn = useCallback((name: string, visible: boolean) => {
    const nextColumns = columns.map((column) => (
      column.name === name ? { ...column, visible } : column
    ));
    commitFilters(nextColumns, rowFilters);
  }, [columns, rowFilters, commitFilters]);

  const handleAddRowFilter = useCallback(() => {
    const firstColumn = columns[0]?.name ?? '';
    if (!firstColumn) {
      return;
    }
    const newFilter: RowFilter = {
      id: `filter-${Date.now()}`,
      column: firstColumn,
      operator: PRIMARY_OPERATOR,
      value: '',
      enabled: true,
    };
    commitFilters(columns, [...rowFilters, newFilter]);
  }, [columns, rowFilters, commitFilters]);

  const handleUpdateRowFilter = useCallback((id: string, updates: Partial<RowFilter>) => {
    const nextRows = rowFilters.map((filter) => (
      filter.id === id ? { ...filter, ...updates } : filter
    ));
    commitFilters(columns, nextRows);
  }, [columns, rowFilters, commitFilters]);

  const handleRemoveRowFilter = useCallback((id: string) => {
    const nextRows = rowFilters.filter((filter) => filter.id !== id);
    commitFilters(columns, nextRows);
  }, [columns, rowFilters, commitFilters]);

  const columnSection = (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            {t('filtering.columns.title', 'Column Visibility')}
          </Typography>
          {loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                {t('filtering.columns.loading', 'Loading columns...')}
              </Typography>
            </Stack>
          ) : columns.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('filtering.columns.empty', 'No column metadata available. All columns remain visible by default.')}
            </Typography>
          ) : (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {columns.map((column) => (
                <Chip
                  key={column.name}
                  label={column.name}
                  color={column.visible ? 'primary' : 'default'}
                  variant={column.visible ? 'filled' : 'outlined'}
                  onClick={() => handleToggleColumn(column.name, !column.visible)}
                />
              ))}
            </Stack>
          )}
          {loadError && (
            <Typography variant="caption" color="warning.main">
              {loadError}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  const rowFiltersSection = (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">
              {t('filtering.rows.title', 'Row Filters')}
            </Typography>
            <Button variant="outlined" size="small" onClick={handleAddRowFilter} disabled={columns.length === 0}>
              {t('filtering.rows.add', 'Add Filter')}
            </Button>
          </Stack>
          {rowFilters.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('filtering.rows.empty', 'No filters applied. All rows will be included.')}
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {rowFilters.map((filter) => (
                <Card key={filter.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel id={`column-select-${filter.id}`}>
                        {t('filtering.rows.column', 'Column')}
                      </InputLabel>
                      <Select
                        labelId={`column-select-${filter.id}`}
                        value={filter.column ?? columns[0]?.name ?? ''}
                        label={t('filtering.rows.column', 'Column')}
                        onChange={(event: any) => handleUpdateRowFilter(filter.id, { column: String(event.target.value) })}
                      >
                        {columns.map((column) => (
                          <MenuItem key={column.name} value={column.name}>
                            {column.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel id={`operator-select-${filter.id}`}>
                        {t('filtering.rows.operator', 'Operator')}
                      </InputLabel>
                     <Select
                        labelId={`operator-select-${filter.id}`}
                        value={filter.operator ?? PRIMARY_OPERATOR}
                        label={t('filtering.rows.operator', 'Operator')}
                        onChange={(event: any) => handleUpdateRowFilter(filter.id, { operator: event.target.value as RowFilter['operator'] })}
                      >
                        {DEFAULT_OPERATORS.map((operator) => (
                          <MenuItem key={operator} value={operator}>
                            {t(`filtering.rows.operators.${operator}`, operator)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label={t('filtering.rows.value', 'Value')}
                      value={filter.value ?? ''}
                      onChange={(event: any) => handleUpdateRowFilter(filter.id, { value: event.target.value })}
                      sx={{ flex: 1, minWidth: 180 }}
                    />
                    <FormControlLabel
                      control={(
                        <Switch
                          color="primary"
                          checked={filter.enabled !== false}
                          onChange={(event: any) => handleUpdateRowFilter(filter.id, { enabled: event.target.checked })}
                        />
                      )}
                      label={t('filtering.rows.enabled', 'Enabled')}
                    />
                    <Button color="secondary" onClick={() => handleRemoveRowFilter(filter.id)}>
                      {t('filtering.rows.remove', 'Remove')}
                    </Button>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FilterAltIcon fontSize="small" />
        <Typography variant="h6">
          {t('filtering.title', 'Filtering (optional)')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        {t('filtering.description', 'Hide unused columns and add simple filters to narrow down the dataset before importing.')}
      </Typography>
      {columnSection}
      {rowFiltersSection}
    </Stack>
  );
};
