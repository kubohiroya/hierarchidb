import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Memory as MemoryIcon,
  PlayArrow as PlayIcon,
  Speed as SpeedIcon,
  Stop as StopIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { MappingPreviewResult, MappingValidationResult, ResolverUpdaterPayload, SchemaInfo, PropertyInfo, PropertyMappingRule, ValidationWarning } from '../../../common/types/index.js';

interface PreviewTestStepProps {
  data: Partial<ResolverUpdaterPayload>;
  onUpdate: (updates: Partial<ResolverUpdaterPayload>) => void;
  onValidationChange: (isValid: boolean) => void;
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
  onValidationResult: (result: MappingValidationResult | null) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

export const PreviewTestStep: React.FC<PreviewTestStepProps> = ({
                                                                  data,
                                                                  onUpdate: _onUpdate,
                                                                  onValidationChange,
                                                                  sourceSchema,
                                                                  targetSchema,
                                                                  onValidationResult,
                                                                }) => {
  const draftData = data.draftData ?? {};
  const [isRunning, setIsRunning] = useState(false);
  const [previewResult, setPreviewResult] = useState<MappingPreviewResult | null>(null);
  const [validationResult, setValidationResult] = useState<MappingValidationResult | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [memoryUsage, setMemoryUsage] = useState<number>(0);

  // Always valid for this step (preview is optional)
  useEffect(() => {
    onValidationChange(true);
  }, [onValidationChange]);

  const runPreview = useCallback(async () => {
    if (!sourceSchema || !targetSchema || !draftData.mappingRules) {
      return;
    }

    setIsRunning(true);
    const startTime = performance.now();
    const startMemory = readHeapUsage();

    try {
      // Simulate mapping execution
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate mock preview result
      const mockResult: MappingPreviewResult = {
        success: true,
        mappedData: sourceSchema.sampleData?.slice(0, 5).map((sample: Record<string, unknown>, index: number) => {
          const mapped: Record<string, unknown> = {};
          draftData.mappingRules!.forEach((rule: PropertyMappingRule) => {
            if (sample && typeof sample === 'object' && rule.sourceProperty in sample) {
              let value = (sample as Record<string, unknown>)[rule.sourceProperty];

              // Apply simple transformations if specified
              if (rule.transformFunction) {
                if (rule.transformFunction === 'lowercase' && typeof value === 'string') {
                  value = value.toLowerCase();
                } else if (rule.transformFunction === 'uppercase' && typeof value === 'string') {
                  value = value.toUpperCase();
                }
              }

              mapped[rule.targetProperty] = value;
            }
          });

          // Add mock ID for display
          mapped._id = index + 1;
          return mapped;
        }) || [],
        unmappedProperties: sourceSchema.properties
          .filter((prop: PropertyInfo) => !draftData.mappingRules!.some((rule: PropertyMappingRule) => rule.sourceProperty === prop.name))
          .map((prop: PropertyInfo) => prop.name),
        errors: [],
        statistics: {
          totalRecords: sourceSchema.sampleData?.length || 0,
          successfulMappings: draftData.mappingRules!.length,
          failedMappings: 0,
          duplicatesFound: Math.floor(Math.random() * 5),
          duplicatesResolved: Math.floor(Math.random() * 3),
        },
      };

      setPreviewResult(mockResult);

      // Generate validation result
      const mockValidation: MappingValidationResult = {
        isValid: (mockResult.errors ?? []).length === 0,
        errors: (mockResult.errors ?? []).map((err) => ({
          property: err.property ?? 'mapping',
          message: err.message,
          suggestion: err.suggestion,
        })),
        warnings: mockResult.unmappedProperties && mockResult.unmappedProperties.length > 0 ? [{
          property: 'unmapped',
          message: `${mockResult.unmappedProperties.length} source properties are not mapped`,
          suggestion: 'Consider mapping all source properties for complete data transformation',
        }] : [],
        coverage: (draftData.mappingRules!.length / sourceSchema.properties.length) * 100,
      };

      setValidationResult(mockValidation);
      onValidationResult(mockValidation);

      const endTime = performance.now();
      const endMemory = readHeapUsage();

      setExecutionTime(endTime - startTime);
      setMemoryUsage(Math.max(0, endMemory - startMemory));

    } catch (error) {
      console.error('Preview failed:', error);

      const errorResult: MappingPreviewResult = {
        success: false,
        mappedData: [],
        unmappedProperties: [],
        errors: [{ property: 'mapping', message: 'Failed to execute mapping preview' }],
        statistics: {
          totalRecords: 0,
          successfulMappings: 0,
          failedMappings: 0,
          duplicatesFound: 0,
          duplicatesResolved: 0,
        },
      };

      setPreviewResult(errorResult);
    } finally {
      setIsRunning(false);
    }
  }, [sourceSchema, targetSchema, draftData.mappingRules, onValidationResult]);

  const toggleRowExpansion = (rowIndex: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowIndex)) {
      newExpanded.delete(rowIndex);
    } else {
      newExpanded.add(rowIndex);
    }
    setExpandedRows(newExpanded);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  if (!sourceSchema || !targetSchema) {
    return (
      <Alert severity="warning">
        Please complete the Schema Selection step before running preview tests.
      </Alert>
    );
  }

  if (!draftData.mappingRules || draftData.mappingRules.length === 0) {
    return (
      <Alert severity="warning">
        Please define mapping rules in the Property Mapping step before running preview tests.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Preview & Test
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Test your property mapping configuration with sample data and review the results.
      </Typography>

      {/* Control Panel */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="subtitle1">Test Execution</Typography>
            <Typography variant="body2" color="text.secondary">
              Run mapping on sample data to preview results
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={isRunning ? <StopIcon /> : <PlayIcon />}
            onClick={runPreview}
            disabled={isRunning}
          >
            {isRunning ? 'Running...' : 'Run Preview'}
          </Button>
        </Box>

        {isRunning && (
          <LinearProgress sx={{ mt: 2 }} />
        )}
      </Paper>

      {/* Performance Metrics */}
      {previewResult && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SpeedIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Execution Time
                  </Typography>
                  <Typography variant="h6">
                    {executionTime.toFixed(2)} ms
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MemoryIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Memory Usage
                  </Typography>
                  <Typography variant="h6">
                    {formatBytes(memoryUsage)}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StorageIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Coverage
                  </Typography>
                  <Typography variant="h6">
                    {validationResult ? `${(validationResult.coverage ?? 0).toFixed(1)}%` : '0%'}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Results Tabs */}
      {previewResult && (
        <Paper>
          <Tabs
            value={selectedTab}
            onChange={(_, newValue: number) => setSelectedTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Mapped Data" />
            <Tab label="Validation" />
            <Tab label="Statistics" />
          </Tabs>

          <TabPanel value={selectedTab} index={0}>
            {/* Mapped Data Table */}
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={40}></TableCell>
                    {targetSchema.properties.slice(0, 5).map((prop: PropertyInfo) => (
                      <TableCell key={prop.name}>{prop.name}</TableCell>
                    ))}
                    {targetSchema.properties.length > 5 && (
                      <TableCell>...</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(previewResult.mappedData ?? []).map((row: Record<string, unknown>, index: number) => (
                    <React.Fragment key={index}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => toggleRowExpansion(index)}
                          >
                            {expandedRows.has(index) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                    {targetSchema.properties.slice(0, 5).map((prop: PropertyInfo) => (
                      <TableCell key={prop.name}>
                        {String(row[prop.name] ?? '-')}
                      </TableCell>
                    ))}
                        {targetSchema.properties.length > 5 && (
                          <TableCell>...</TableCell>
                        )}
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={targetSchema.properties.length + 2} sx={{ py: 0 }}>
                          <Collapse in={expandedRows.has(index)} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Full Record
                              </Typography>
                              <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
                                {JSON.stringify(row, null, 2)}
                              </pre>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={selectedTab} index={1}>
            {/* Validation Results */}
            {validationResult && (
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {validationResult.isValid ? (
                    <>
                      <CheckIcon color="success" />
                      <Typography variant="subtitle1" color="success.main">
                        Validation Passed
                      </Typography>
                    </>
                  ) : (
                    <>
                      <ErrorIcon color="error" />
                      <Typography variant="subtitle1" color="error.main">
                        Validation Failed
                      </Typography>
                    </>
                  )}
                </Box>

                {(validationResult?.errors?.length ?? 0) > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Errors ({validationResult?.errors?.length ?? 0})
                    </Typography>
                    <List dense>
                      {(validationResult?.errors ?? []).map((error: MappingValidationResult['errors'][number], index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <ErrorIcon color="error" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={error.message}
                            secondary={`Property: ${error.property}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {(validationResult?.warnings?.length ?? 0) > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Warnings ({validationResult?.warnings?.length ?? 0})
                    </Typography>
                    <List dense>
                      {(validationResult?.warnings ?? []).map((warning: ValidationWarning, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <WarningIcon color="warning" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={warning.message}
                            secondary={warning.suggestion}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {validationResult?.isValid && (validationResult.warnings?.length ?? 0) === 0 && (
                  <Alert severity="success">
                    All validation checks passed successfully.
                  </Alert>
                )}
              </Box>
            )}
          </TabPanel>

          <TabPanel value={selectedTab} index={2}>
            {/* Statistics */}
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Records
                  </Typography>
                  <Typography variant="h6">
                    {previewResult.statistics?.totalRecords ?? 0}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Successful Mappings
                  </Typography>
                  <Typography variant="h6">
                    {previewResult.statistics?.successfulMappings ?? 0}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Failed Mappings
                  </Typography>
                  <Typography variant="h6">
                    {previewResult.statistics?.failedMappings ?? 0}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Duplicates Found
                  </Typography>
                  <Typography variant="h6">
                    {previewResult.statistics?.duplicatesFound ?? 0}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Duplicates Resolved
                  </Typography>
                  <Typography variant="h6">
                    {previewResult.statistics?.duplicatesResolved ?? 0}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Unmapped Properties
                  </Typography>
                  <Typography variant="h6">
                    {previewResult.unmappedProperties?.length ?? 0}
                  </Typography>
                </Grid>
              </Grid>

              {(previewResult.unmappedProperties?.length ?? 0) > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Unmapped Source Properties
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {previewResult.unmappedProperties?.map((prop: string) => (
                      <Chip
                        key={prop}
                        label={prop}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </TabPanel>
        </Paper>
      )}

      {!previewResult && !isRunning && (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
          <Typography variant="body1" color="text.secondary">
            Click "Run Preview" to test your mapping configuration with sample data.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

const hasMemory = (perf: Performance): perf is Performance & { memory: { usedJSHeapSize?: number }} => {
  return typeof (perf as { memory?: unknown }).memory !== 'undefined';
};

const readHeapUsage = (): number => {
  if (typeof performance === 'undefined') return 0;
  if (!hasMemory(performance)) return 0;
  const memory = performance.memory;
  return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : 0;
};
