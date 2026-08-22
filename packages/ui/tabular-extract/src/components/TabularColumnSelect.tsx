/**
 * @file TabularColumnSelect.tsx
 * @description Column selection and mapping interface for Tabular data
 */

import { TabularTableMetadata } from '@hierarchidb/tabular-store';
import {
  ExpandMore as ExpandMoreIcon,
  SwapHoriz as SwapHorizIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import type { TabularColumnMapping, TabularDataResult } from '../types/index';
import { useTabularColumnSelect } from './useTabularColumnSelect.js';

export interface TabularColumnSelectProps {
  tableMetadata: TabularTableMetadata;
  previewData?: TabularDataResult;
  targetColumns?: { name: string; type: string; required: boolean; description?: string }[];
  onSelectionChanged: (mapping: TabularColumnMapping[]) => void;
  onPreviewChanged?: (showPreview: boolean) => void;
  allowRename?: boolean;
  allowTypeChange?: boolean;
  maxPreviewRows?: number;
}

export const TabularColumnSelect: React.FC<TabularColumnSelectProps> = ({
  tableMetadata,
  previewData,
  targetColumns = [],
  onSelectionChanged,
  onPreviewChanged,
  allowRename = true,
  allowTypeChange = true,
  maxPreviewRows = 50,
}) => {
  const view = useTabularColumnSelect({
    tableMetadata,
    targetColumns,
    onSelectionChanged,
    onPreviewChanged,
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Select and Map Columns
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose which columns to include and how they should be mapped to your target schema.
      </Typography>

      {/* Column Selection Controls */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={view.selectAll}
                indeterminate={view.selectAllIndeterminate}
                onChange={(e) => view.handleSelectAll(e.target.checked)}
              />
            }
            label="Select All Columns"
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {view.selectedColumns.length} of {view.columnMappings.length} columns selected
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={view.showPreview}
                  onChange={(e) => view.setShowPreview(e.target.checked)}
                />
              }
              label="Show Preview"
            />
          </Box>
        </Box>
      </Paper>

      {/* Column Mapping Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">Include</TableCell>
              <TableCell>Source Column</TableCell>
              <TableCell>Source Type</TableCell>
              {allowRename && <TableCell>Target Name</TableCell>}
              {allowTypeChange && <TableCell>Target Type</TableCell>}
              {targetColumns.length > 0 && <TableCell>Map to Target</TableCell>}
              <TableCell>Order</TableCell>
              <TableCell>Sample Data</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {view.columnMappings.map((mapping) => {
              const sampleData = previewData?.rows
                .slice(0, 3)
                .map((row) => row[mapping.sourceColumn])
                .filter((val) => val != null && val !== '')
                .slice(0, 2);

              return (
                <TableRow key={mapping.sourceColumn}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={mapping.included}
                      onChange={(e) =>
                        view.handleToggleColumn(mapping.sourceColumn, e.target.checked)
                      }
                    />
                  </TableCell>

                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={mapping.included ? 'bold' : 'normal'}>
                        {mapping.sourceColumn}
                      </Typography>
                      {!mapping.included && <VisibilityOffIcon fontSize="small" color="disabled" />}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip size="small" label={mapping.sourceType} variant="outlined" />
                  </TableCell>

                  {allowRename && (
                    <TableCell>
                      <TextField
                        size="small"
                        id={`${view.controlId}-target-column-${mapping.sourceColumn}`}
                        name={`target-column-${mapping.sourceColumn}`}
                        value={mapping.targetColumn}
                        onChange={(e) =>
                          view.handleColumnRename(mapping.sourceColumn, e.target.value)
                        }
                        disabled={!mapping.included}
                        placeholder="Target column name"
                      />
                    </TableCell>
                  )}

                  {allowTypeChange && (
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <Select
                          id={`${view.controlId}-type-${mapping.sourceColumn}`}
                          value={mapping.targetType}
                          onChange={(e) =>
                            view.handleTypeChange(mapping.sourceColumn, e.target.value)
                          }
                          disabled={!mapping.included}
                        >
                          <MenuItem value="string">String</MenuItem>
                          <MenuItem value="number">Number</MenuItem>
                          <MenuItem value="date">Date</MenuItem>
                          <MenuItem value="boolean">Boolean</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                  )}

                  {targetColumns.length > 0 && (
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <Select
                          id={`${view.controlId}-mapping-${mapping.sourceColumn}`}
                          value={mapping.targetColumn}
                          onChange={(e) =>
                            view.handleTargetMapping(mapping.sourceColumn, e.target.value)
                          }
                          disabled={!mapping.included}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Select target...</em>
                          </MenuItem>
                          {targetColumns.map((tc) => (
                            <MenuItem key={tc.name} value={tc.name}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {tc.name}
                                {tc.required && (
                                  <Chip size="small" label="Required" color="warning" />
                                )}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                  )}

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      id={`${view.controlId}-order-${mapping.sourceColumn}`}
                      name={`order-${mapping.sourceColumn}`}
                      value={mapping.order}
                      onChange={(e) =>
                        view.handleOrderChange(mapping.sourceColumn, parseInt(e.target.value))
                      }
                      disabled={!mapping.included}
                      inputProps={{
                        min: 0,
                        max: view.columnMappings.length - 1,
                        style: { width: 60 },
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <Box sx={{ maxWidth: 200 }}>
                      {sampleData && sampleData.length > 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          {sampleData.map((val) => String(val)).join(', ')}
                          {sampleData.length === 2 && '...'}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No data
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Validation Errors */}
      {!view.validation.isValid && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Column Mapping Issues:
          </Typography>
          <ul style={{ margin: 0 }}>
            {view.validation.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Target Column Requirements */}
      {targetColumns.length > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Target Schema ({targetColumns.length} columns)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Column Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Required</TableCell>
                    <TableCell>Mapped From</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {targetColumns.map((tc) => {
                    const mapping = view.columnMappings.find(
                      (m) => m.targetColumn === tc.name && m.included
                    );
                    return (
                      <TableRow key={tc.name}>
                        <TableCell>{tc.name}</TableCell>
                        <TableCell>
                          <Chip size="small" label={tc.type} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {tc.required ? (
                            <Chip size="small" label="Required" color="warning" />
                          ) : (
                            <Chip size="small" label="Optional" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          {mapping ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">{mapping.sourceColumn}</Typography>
                              <SwapHorizIcon fontSize="small" color="primary" />
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Not mapped
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {tc.description || 'No description'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Preview Data (if enabled) */}
      {view.showPreview && previewData && (
        <Accordion sx={{ mt: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Data Preview with Selected Columns</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {view.selectedColumnsSorted.map((mapping) => (
                      <TableCell key={mapping.sourceColumn}>
                        <Typography variant="subtitle2">{mapping.targetColumn}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {mapping.sourceColumn} → {mapping.targetType}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.rows.slice(0, maxPreviewRows).map((row, index) => (
                    <TableRow key={index}>
                      {view.selectedColumnsSorted.map((mapping) => (
                        <TableCell key={mapping.sourceColumn}>
                          {row[mapping.sourceColumn]?.toString() || ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Summary */}
      <Box
        sx={{
          mt: 3,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          Selection Summary
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              Selected Columns
            </Typography>
            <Typography variant="h6">
              {view.selectedColumns.length} of {view.columnMappings.length}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Mapping Status
            </Typography>
            <Typography
              variant="h6"
              color={view.validation.isValid ? 'success.main' : 'error.main'}
            >
              {view.validation.isValid ? 'Valid' : 'Invalid'}
            </Typography>
          </Box>
          {targetColumns.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                Required Columns Mapped
              </Typography>
              <Typography variant="h6">
                {view.requiredColumnsMappedCount} of {view.requiredColumnsCount}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
