/**
 * @file CSVColumnSelectionStep.tsx
 * @description Column selection and mapping interface for CSV data
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import type { 
  CSVTableMetadata, 
  CSVColumnInfo, 
  CSVColumnMapping,
  CSVColumnType,
  CSVDataResult 
} from '../types';

export interface CSVColumnSelectionStepProps {
  tableMetadata: CSVTableMetadata;
  previewData?: CSVDataResult;
  targetColumns?: { name: string; type: string; required: boolean; description?: string }[];
  onSelectionChanged: (mapping: CSVColumnMapping[]) => void;
  onPreviewChanged?: (showPreview: boolean) => void;
  allowRename?: boolean;
  allowTypeChange?: boolean;
  maxPreviewRows?: number;
}

export const CSVColumnSelectionStep: React.FC<CSVColumnSelectionStepProps> = ({
  tableMetadata,
  previewData,
  targetColumns = [],
  onSelectionChanged,
  onPreviewChanged,
  allowRename = true,
  allowTypeChange = true,
  maxPreviewRows = 50,
}) => {
  const [columnMappings, setColumnMappings] = useState<CSVColumnMapping[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [selectAll, setSelectAll] = useState(true);

  // Initialize column mappings
  useEffect(() => {
    const initialMappings: CSVColumnMapping[] = tableMetadata.columns.map((col, index) => ({
      sourceColumn: col.name,
      sourceType: col.type,
      targetColumn: col.name,
      targetType: col.type,
      included: true,
      order: index,
      transform: 'none',
    }));

    setColumnMappings(initialMappings);
  }, [tableMetadata.columns]);

  // Update parent when mappings change
  useEffect(() => {
    onSelectionChanged(columnMappings);
  }, [columnMappings, onSelectionChanged]);

  // Update preview visibility
  useEffect(() => {
    onPreviewChanged?.(showPreview);
  }, [showPreview, onPreviewChanged]);

  const handleToggleColumn = (sourceColumn: string, included: boolean) => {
    setColumnMappings(prev =>
      prev.map(mapping =>
        mapping.sourceColumn === sourceColumn
          ? { ...mapping, included }
          : mapping
      )
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setColumnMappings(prev =>
      prev.map(mapping => ({ ...mapping, included: checked }))
    );
  };

  const handleColumnRename = (sourceColumn: string, targetColumn: string) => {
    setColumnMappings(prev =>
      prev.map(mapping =>
        mapping.sourceColumn === sourceColumn
          ? { ...mapping, targetColumn }
          : mapping
      )
    );
  };

  const handleTypeChange = (sourceColumn: string, targetType: string) => {
    setColumnMappings(prev =>
      prev.map(mapping =>
        mapping.sourceColumn === sourceColumn
          ? { ...mapping, targetType: targetType as CSVColumnType }
          : mapping
      )
    );
  };

  const handleTargetMapping = (sourceColumn: string, targetColumn: string) => {
    setColumnMappings(prev =>
      prev.map(mapping =>
        mapping.sourceColumn === sourceColumn
          ? { ...mapping, targetColumn }
          : mapping
      )
    );
  };

  const handleOrderChange = (sourceColumn: string, order: number) => {
    setColumnMappings(prev =>
      prev.map(mapping =>
        mapping.sourceColumn === sourceColumn
          ? { ...mapping, order }
          : mapping
      )
    );
  };

  const getSelectedColumns = () => columnMappings.filter(m => m.included);
  const getUnmappedTargetColumns = () => {
    const mappedTargets = new Set(columnMappings.map(m => m.targetColumn));
    return targetColumns.filter(tc => !mappedTargets.has(tc.name));
  };

  const getMappingValidation = () => {
    const errors: string[] = [];
    const selectedMappings = getSelectedColumns();
    
    // Check for required target columns
    const requiredColumns = targetColumns.filter(tc => tc.required);
    const mappedTargets = selectedMappings.map(m => m.targetColumn);
    
    for (const required of requiredColumns) {
      if (!mappedTargets.includes(required.name)) {
        errors.push(`Required column "${required.name}" is not mapped`);
      }
    }

    // Check for duplicate target column names
    const targetCounts = new Map<string, number>();
    mappedTargets.forEach(target => {
      targetCounts.set(target, (targetCounts.get(target) || 0) + 1);
    });

    for (const [target, count] of targetCounts) {
      if (count > 1) {
        errors.push(`Target column "${target}" is mapped multiple times`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const validation = getMappingValidation();

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
                checked={selectAll}
                indeterminate={selectAll !== (getSelectedColumns().length === columnMappings.length)}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            }
            label="Select All Columns"
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {getSelectedColumns().length} of {columnMappings.length} columns selected
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={showPreview}
                  onChange={(e) => setShowPreview(e.target.checked)}
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
            {columnMappings.map((mapping) => {
              const sampleData = previewData?.rows
                .slice(0, 3)
                .map(row => row[mapping.sourceColumn])
                .filter(val => val != null && val !== '')
                .slice(0, 2);

              return (
                <TableRow key={mapping.sourceColumn}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={mapping.included}
                      onChange={(e) => handleToggleColumn(mapping.sourceColumn, e.target.checked)}
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
                        value={mapping.targetColumn}
                        onChange={(e) => handleColumnRename(mapping.sourceColumn, e.target.value)}
                        disabled={!mapping.included}
                        placeholder="Target column name"
                      />
                    </TableCell>
                  )}

                  {allowTypeChange && (
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <Select
                          value={mapping.targetType}
                          onChange={(e) => handleTypeChange(mapping.sourceColumn, e.target.value)}
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
                          value={mapping.targetColumn}
                          onChange={(e) => handleTargetMapping(mapping.sourceColumn, e.target.value)}
                          disabled={!mapping.included}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Select target...</em>
                          </MenuItem>
                          {targetColumns.map(tc => (
                            <MenuItem key={tc.name} value={tc.name}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {tc.name}
                                {tc.required && <Chip size="small" label="Required" color="warning" />}
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
                      value={mapping.order}
                      onChange={(e) => handleOrderChange(mapping.sourceColumn, parseInt(e.target.value))}
                      disabled={!mapping.included}
                      inputProps={{ min: 0, max: columnMappings.length - 1, style: { width: 60 } }}
                    />
                  </TableCell>

                  <TableCell>
                    <Box sx={{ maxWidth: 200 }}>
                      {sampleData && sampleData.length > 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          {sampleData.map(val => String(val)).join(', ')}
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
      {!validation.isValid && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Column Mapping Issues:
          </Typography>
          <ul style={{ margin: 0 }}>
            {validation.errors.map((error, index) => (
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
                  {targetColumns.map(tc => {
                    const mapping = columnMappings.find(m => m.targetColumn === tc.name && m.included);
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
                              <Typography variant="body2">
                                {mapping.sourceColumn}
                              </Typography>
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
      {showPreview && previewData && (
        <Accordion sx={{ mt: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Data Preview with Selected Columns
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {getSelectedColumns()
                      .sort((a, b) => a.order - b.order)
                      .map(mapping => (
                        <TableCell key={mapping.sourceColumn}>
                          <Typography variant="subtitle2">
                            {mapping.targetColumn}
                          </Typography>
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
                      {getSelectedColumns()
                        .sort((a, b) => a.order - b.order)
                        .map(mapping => (
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
      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" gutterBottom>
          Selection Summary
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Selected Columns
            </Typography>
            <Typography variant="h6">
              {getSelectedColumns().length} of {columnMappings.length}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Mapping Status
            </Typography>
            <Typography variant="h6" color={validation.isValid ? 'success.main' : 'error.main'}>
              {validation.isValid ? 'Valid' : 'Invalid'}
            </Typography>
          </Box>
          {targetColumns.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                Required Columns Mapped
              </Typography>
              <Typography variant="h6">
                {targetColumns.filter(tc => tc.required && columnMappings.some(m => m.targetColumn === tc.name && m.included)).length} of {targetColumns.filter(tc => tc.required).length}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};