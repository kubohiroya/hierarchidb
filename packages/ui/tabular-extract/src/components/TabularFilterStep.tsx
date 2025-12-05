/**
 * @file TabularFilterStep.tsx
 * @description Filter rule creation and preview for Tabular data
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { useTabularFilter } from '../hooks/useTabularFilter.js';
import { TabularColumnInfo, TabularColumnType, TabularTableMetadata } from '@hierarchidb/tabular-store';
import { TabularDataResult, TabularFilterOperator, TabularFilterRule } from '../types/index.js';
import { ModalSelect } from './ModalSelect.js';

export interface TabularFilterStepProps {
  tableMetadata: TabularTableMetadata;
  onFiltersChanged: (filters: TabularFilterRule[]) => void;
  onPreviewData: (data: TabularDataResult) => void;
  pluginId: string;
  maxPreviewRows?: number;
}

const FILTER_OPERATORS: { value: TabularFilterOperator; label: string; types: TabularColumnType[] }[] = [
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
}) => {
  const [filters, setFilters] = useState<TabularFilterRule[]>([]);
  const [newFilter, setNewFilter] = useState<Partial<TabularFilterRule>>({
    column: '',
    operator: 'equals',
    value: '',
    enabled: true,
  });

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
  });

  const hasPreviewColumns = Boolean(previewData?.columns && previewData.columns.length > 0);
  const columnOptions: TabularColumnInfo[] = hasPreviewColumns
    ? previewData!.columns
    : (tableMetadata.columns ?? []);
  const previewColumns: TabularColumnInfo[] = hasPreviewColumns ? previewData!.columns : columnOptions;

  // Update parent when filters change
  useEffect(() => {
    onFiltersChanged(filters);
  }, [filters, onFiltersChanged]);

  // Update preview data when available
  useEffect(() => {
    if (previewData) {
      onPreviewData(previewData);
    }
  }, [previewData, onPreviewData]);

  // Ensure a default column is selected once options are available
  useEffect(() => {
    if (columnOptions.length === 0) return;
    setNewFilter((prev) => {
      if (prev.column && columnOptions.some(col => col.name === prev.column)) {
        return prev;
      }
      const [firstColumn] = columnOptions;
      if (!firstColumn) return prev;
      return {
        ...prev,
        column: firstColumn.name,
        operator: prev.operator ?? 'equals',
      };
    });
  }, [columnOptions]);

  const normalizeType = (type?: TabularColumnType): TabularColumnType => type ?? 'string';

  const getAvailableOperators = useCallback((columnName: string) => {
    const column = columnOptions.find((col: TabularColumnInfo) => col.name === columnName);
    if (!column) return FILTER_OPERATORS;

    const columnType = normalizeType(column.type);
    return FILTER_OPERATORS.filter(op => op.types.includes(columnType));
  }, [columnOptions]);

  const handleAddFilter = () => {
    if (!newFilter.column || !newFilter.operator) return;

    // Validate the new filter
    const validation = validateFilters([...filters, newFilter as TabularFilterRule]);
    if (!validation.isValid) {
      // Could show validation errors here
      return;
    }

    const filter: TabularFilterRule = {
      id: crypto.randomUUID(),
      column: newFilter.column!,
      operator: newFilter.operator!,
      value: newFilter.value || '',
      enabled: true,
    };

    setFilters((prev: TabularFilterRule[]) => [...prev, filter]);
    setNewFilter({
      column: '',
      operator: 'equals',
      value: '',
      enabled: true,
    });
  };

  // Align operator with the selected column type
  useEffect(() => {
    if (!newFilter.column) return;
    const available = getAvailableOperators(newFilter.column);
    if (available.length === 0) return;
    const [firstAvailable] = available;
    if (!firstAvailable) return;
    if (!available.some(op => op.value === newFilter.operator)) {
      setNewFilter((prev) => ({
        ...prev,
        operator: firstAvailable.value,
      }));
    }
  }, [columnOptions, getAvailableOperators, newFilter.column, newFilter.operator]);

  const handleRemoveFilter = (filterId: string) => {
    setFilters((prev: TabularFilterRule[]) => prev.filter(f => f.id !== filterId));
  };

  const handleToggleFilter = (filterId: string) => {
    setFilters((prev: TabularFilterRule[]) =>
      prev.map(f =>
        f.id === filterId ? { ...f, enabled: !f.enabled } : f,
      ),
    );
  };

  const handleUpdateFilterValue = (filterId: string, value: string) => {
    setFilters((prev: TabularFilterRule[]) =>
      prev.map(f =>
        f.id === filterId ? { ...f, value } : f,
      ),
    );
  };

  const handlePreview = () => {
    const enabledFilters = filters.filter(f => f.enabled);
    getFilteredPreview(enabledFilters);
  };

  const getFilterValueInput = (filter: TabularFilterRule, onChange: (value: string) => void) => {
    if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
      return null; // No value input needed for null checks
    }

    const column = columnOptions.find((col: TabularColumnInfo) => col.name === filter.column);

    if (column?.type === 'boolean') {
      return (
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={filter.value}
            onChange={(e) => onChange(String(e.target.value))}
          >
            <MenuItem value="true">True</MenuItem>
            <MenuItem value="false">False</MenuItem>
          </Select>
        </FormControl>
      );
    }

    if (column?.type === 'date') {
      return (
        <TextField
          size="small"
          type="date"
          value={filter.value}
          onChange={(e) => onChange(String(e.target.value))}
          InputLabelProps={{
            shrink: true,
          }}
        />
      );
    }

    if (column?.type === 'number') {
      return (
        <TextField
          size="small"
          type="number"
          value={filter.value}
          onChange={(e) => onChange(String(e.target.value))}
          placeholder="Enter number"
        />
      );
    }

    return (
      <TextField
        size="small"
        value={filter.value}
        onChange={(e) => onChange(String(e.target.value))}
        placeholder={filter.operator === 'regex' ? 'Enter regex pattern' : 'Enter value'}
      />
    );
  };

  return (
    <Box
      sx={{ p: 3, maxHeight: '70vh', overflowY: 'auto', overscrollBehavior: 'contain' }}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <Typography variant="h6" gutterBottom>
        Filter Tabular Data
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create filters to include only the data you need. Preview the results before proceeding.
      </Typography>

      {/* Filter Creation */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon />
          Add Filter Rule
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Column</InputLabel>
            <ModalSelect
              value={newFilter.column || ''}
              usePortal={true}
              label="Column"
        onChange={(e) => setNewFilter((prev: Partial<TabularFilterRule>) => ({ ...prev, column: e.target.value }))}
      >
              {columnOptions.map((col: TabularColumnInfo) => (
                <MenuItem key={col.name} value={col.name}>
                  {col.name} ({col.type})
                </MenuItem>
              ))}
            </ModalSelect>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Operator</InputLabel>
            <ModalSelect
              value={newFilter.operator || 'equals'}
              usePortal={true}
              label="Operator"
              onChange={(e) => setNewFilter((prev: Partial<TabularFilterRule>) => ({ ...prev, operator: e.target.value as TabularFilterOperator }))}
              disabled={!newFilter.column}
            >
              {getAvailableOperators(newFilter.column || '').map(op => (
                <MenuItem key={op.value} value={op.value}>
                  {op.label}
                </MenuItem>
              ))}
            </ModalSelect>
          </FormControl>

          <TextField
            size="small"
            label="Value"
            value={newFilter.value || ''}
            onChange={(e) => setNewFilter((prev: Partial<TabularFilterRule>) => ({ ...prev, value: e.target.value }))}
            disabled={!newFilter.column || newFilter.operator === 'is_null' || newFilter.operator === 'is_not_null'}
            placeholder="Enter filter value"
          />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddFilter}
            disabled={!newFilter.column || !newFilter.operator}
          >
            Add Filter
          </Button>
        </Box>
      </Paper>

      {/* Active Filters */}
      {filters.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1">
              Active Filters ({filters.filter(f => f.enabled).length}/{filters.length})
            </Typography>
          </Box>

          <Box sx={{ p: 2 }}>
            {filters.map((filter, index) => (
              <Box key={filter.id} sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                mb: index < filters.length - 1 ? 2 : 0,
                p: 1.5,
                bgcolor: filter.enabled ? 'background.default' : 'action.disabled',
                borderRadius: 1,
                border: 1,
                borderColor: filter.enabled ? 'divider' : 'transparent',
              }}>
                <Chip
                  label={filter.enabled ? 'ON' : 'OFF'}
                  size="small"
                  color={filter.enabled ? 'primary' : 'default'}
                  onClick={() => handleToggleFilter(filter.id)}
                  sx={{ cursor: 'pointer' }}
                />

                <Typography variant="body2" sx={{ minWidth: 100 }}>
                  {filter.column}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                  {FILTER_OPERATORS.find(op => op.value === filter.operator)?.label}
                </Typography>

                {getFilterValueInput(filter, (value) => handleUpdateFilterValue(filter.id, value))}

                <IconButton
                  size="small"
                  onClick={() => handleRemoveFilter(filter.id)}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button
              variant="outlined"
              startIcon={isLoading ? <CircularProgress size={16} /> : <PreviewIcon />}
              onClick={handlePreview}
              disabled={isLoading || filters.filter(f => f.enabled).length === 0}
            >
              {isLoading ? 'Loading Preview...' : 'Preview Filtered Data'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Preview Data */}
      {previewData && (
        <Accordion defaultExpanded={true}>
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
                        <Typography variant="subtitle2">
                          {col.name}
                        </Typography>
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
                        <TableCell key={col.name}>
                          {row[col.name]?.toString() || ''}
                        </TableCell>
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

      {/* Data Statistics */}
      {previewData && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            Data Summary
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Rows
              </Typography>
              <Typography variant="h6">
                {previewData.totalRows.toLocaleString()}
              </Typography>
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
              <Typography variant="h6">
                {filters.filter(f => f.enabled).length}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
