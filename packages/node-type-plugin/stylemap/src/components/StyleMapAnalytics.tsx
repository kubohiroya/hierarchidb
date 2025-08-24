/**
 * @file StyleMapAnalytics.tsx
 * @description Advanced analytics and data quality monitoring component for StyleMap
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Grid,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Analytics as AnalyticsIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  DataUsage as DataUsageIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
} from '@mui/icons-material';

import type { NodeId } from '@hierarchidb/common-core';
import { StyleMapAdvancedService } from '../services/StyleMapAdvancedService';
import type {
  DataAnalysisResult,
  PerformanceMetrics,
  DataValidationResult,
  StyleMapExportOptions,
} from '../services/StyleMapAdvancedService';

interface StyleMapAnalyticsProps {
  nodeId: NodeId;
  onOptimizationApplied?: () => void;
  onExportRequested?: (format: string) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * Advanced analytics component for StyleMap plugin
 */
export const StyleMapAnalytics: React.FC<StyleMapAnalyticsProps> = ({
  nodeId,
  onOptimizationApplied,
  onExportRequested,
}) => {
  // Temporarily disabled for type safety
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6">
        StyleMap Analytics (Coming Soon)
      </Typography>
      <Typography color="text.secondary">
        Advanced data analytics and performance monitoring features will be available soon.
      </Typography>
    </Box>
  );
};

  const advancedService = StyleMapAdvancedService.getInstance();

  useEffect(() => {
    loadAnalytics();
  }, [nodeId]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const [analysis, perf, valid] = await Promise.all([
        advancedService.analyzeData(nodeId),
        advancedService.optimizePerformance(nodeId),
        advancedService.validateData(nodeId),
      ]);

      setDataAnalysis(analysis);
      setPerformance(perf);
      setValidation(valid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExport = async (format: string) => {
    if (onExportRequested) {
      onExportRequested(format);
    }
    setExportDialogOpen(false);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getQualityColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getPerformanceColor = (time: number): 'success' | 'warning' | 'error' => {
    if (time < 100) return 'success';
    if (time < 500) return 'warning';
    return 'error';
  };

  if (loading && !dataAnalysis) {
    return (
      <Box sx={{ width: '100%', p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Analyzing Data...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
        <Button onClick={loadAnalytics} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
        <Typography variant="h5">
          Data Analytics & Quality
        </Typography>
        <Box>
          <IconButton onClick={loadAnalytics} disabled={loading}>
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={() => setExportDialogOpen(true)}>
            <ExportIcon />
          </IconButton>
        </Box>
      </Box>

      <Tabs value={tabValue} onChange={handleTabChange} aria-label="analytics tabs">
        <Tab icon={<DataUsageIcon />} label="Data Analysis" />
        <Tab icon={<SpeedIcon />} label="Performance" />
        <Tab icon={<AssessmentIcon />} label="Validation" />
        <Tab icon={<AnalyticsIcon />} label="Recommendations" />
      </Tabs>

      {/* Data Analysis Tab */}
      <TabPanel value={tabValue} index={0}>
        {dataAnalysis && (
          <Grid container spacing={3}>
            {/* Overview Cards */}
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {dataAnalysis.totalRows.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Rows
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {dataAnalysis.totalColumns}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Columns
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Chip
                    label={formatPercentage(dataAnalysis.dataQuality.completeness)}
                    color={getQualityColor(dataAnalysis.dataQuality.completeness)}
                    size="large"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Completeness
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Chip
                    label={formatPercentage(dataAnalysis.dataQuality.consistency)}
                    color={getQualityColor(dataAnalysis.dataQuality.consistency)}
                    size="large"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Consistency
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Column Statistics */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Column Statistics
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Column</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Unique Values</TableCell>
                          <TableCell>Missing</TableCell>
                          <TableCell>Range</TableCell>
                          <TableCell>Sample Values</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(dataAnalysis.columnStats).map(([columnName, stats]) => (
                          <TableRow key={columnName}>
                            <TableCell component="th" scope="row">
                              <Typography variant="body2" fontWeight="medium">
                                {columnName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={stats.dataType} 
                                size="small" 
                                color={stats.isNumeric ? 'primary' : 'default'}
                              />
                            </TableCell>
                            <TableCell>{stats.uniqueValues.toLocaleString()}</TableCell>
                            <TableCell>
                              {stats.nullCount > 0 && (
                                <Chip 
                                  label={formatPercentage((stats.nullCount / dataAnalysis.totalRows) * 100)}
                                  size="small"
                                  color="warning"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {stats.isNumeric && stats.minValue !== undefined && stats.maxValue !== undefined ? (
                                `${stats.minValue} - ${stats.maxValue}`
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              <Tooltip title={stats.sampleValues.join(', ')}>
                                <Typography variant="body2" sx={{ 
                                  maxWidth: 200, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {stats.sampleValues.slice(0, 3).join(', ')}
                                  {stats.sampleValues.length > 3 && '...'}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Performance Tab */}
      <TabPanel value={tabValue} index={1}>
        {performance && (
          <Grid container spacing={3}>
            {/* Performance Overview */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Metrics
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="h5" color="primary">
                          {formatBytes(performance.dataSize)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Data Size
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box textAlign="center">
                        <Chip
                          label={`${performance.processingTime.toFixed(1)}ms`}
                          color={getPerformanceColor(performance.processingTime)}
                          size="large"
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Processing Time
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="h5" color="primary">
                          {formatBytes(performance.memoryUsage)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Memory Usage
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box textAlign="center">
                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                          <CircularProgress
                            variant="determinate"
                            value={performance.cacheHitRate}
                            size={60}
                            thickness={6}
                          />
                          <Box
                            sx={{
                              top: 0,
                              left: 0,
                              bottom: 0,
                              right: 0,
                              position: 'absolute',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Typography variant="caption" component="div" color="text.secondary">
                              {`${Math.round(performance.cacheHitRate)}%`}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Cache Hit Rate
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Optimization Suggestions */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    Performance Optimizations ({performance.optimizationSuggestions.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {performance.optimizationSuggestions.length > 0 ? (
                    <List>
                      {performance.optimizationSuggestions.map((suggestion, index) => (
                        <ListItem key={index}>
                          <InfoIcon color="info" sx={{ mr: 2 }} />
                          <ListItemText
                            primary={suggestion}
                            secondary={`Optimization ${index + 1}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">
                      No performance optimizations available. Your data is well optimized!
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Validation Tab */}
      <TabPanel value={tabValue} index={2}>
        {validation && (
          <Grid container spacing={3}>
            {/* Validation Status */}
            <Grid item xs={12}>
              <Alert
                severity={validation.isValid ? 'success' : 'error'}
                icon={validation.isValid ? <CheckCircleIcon /> : <ErrorIcon />}
              >
                <Typography variant="h6">
                  Data Quality Score: {validation.dataQuality.score}/100
                </Typography>
                <Typography>
                  {validation.isValid
                    ? 'Data is valid and ready for styling'
                    : `Found ${validation.errors.length} error(s) and ${validation.warnings.length} warning(s)`}
                </Typography>
              </Alert>
            </Grid>

            {/* Issues */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="error">
                    Errors ({validation.errors.length})
                  </Typography>
                  {validation.errors.length === 0 ? (
                    <Typography color="text.secondary">
                      No errors found
                    </Typography>
                  ) : (
                    <List dense>
                      {validation.errors.map((error, index) => (
                        <ListItem key={index}>
                          <ErrorIcon color="error" sx={{ mr: 1 }} />
                          <ListItemText primary={error} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="warning.main">
                    Warnings ({validation.warnings.length})
                  </Typography>
                  {validation.warnings.length === 0 ? (
                    <Typography color="text.secondary">
                      No warnings found
                    </Typography>
                  ) : (
                    <List dense>
                      {validation.warnings.map((warning, index) => (
                        <ListItem key={index}>
                          <WarningIcon color="warning" sx={{ mr: 1 }} />
                          <ListItemText primary={warning} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Suggestions */}
            {validation.suggestions.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Improvement Suggestions
                    </Typography>
                    <List dense>
                      {validation.suggestions.map((suggestion, index) => (
                        <ListItem key={index}>
                          <InfoIcon color="info" sx={{ mr: 1 }} />
                          <ListItemText primary={suggestion} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}
      </TabPanel>

      {/* Recommendations Tab */}
      <TabPanel value={tabValue} index={3}>
        {dataAnalysis && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recommended Column Mappings
                  </Typography>
                  {dataAnalysis.recommendedMappings.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Key Column</TableCell>
                            <TableCell>Value Column</TableCell>
                            <TableCell>Confidence</TableCell>
                            <TableCell>Reason</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dataAnalysis.recommendedMappings.map((mapping, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {mapping.keyColumn}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {mapping.valueColumn}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={`${mapping.confidence}%`}
                                  color={getQualityColor(mapping.confidence)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {mapping.reason}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography color="text.secondary">
                      No specific recommendations available. Current configuration appears optimal.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Data Quality Suggestions */}
            {dataAnalysis.dataQuality.suggestions.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Data Quality Improvements
                    </Typography>
                    <List>
                      {dataAnalysis.dataQuality.suggestions.map((suggestion, index) => (
                        <ListItem key={index}>
                          <InfoIcon color="info" sx={{ mr: 2 }} />
                          <ListItemText primary={suggestion} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}
      </TabPanel>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export StyleMap</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Choose the export format for your StyleMap data:
          </Typography>
          <List>
            {['maplibre-style', 'css', 'json', 'geojson', 'csv', 'sld'].map((format) => (
              <ListItem key={format} button onClick={() => handleExport(format)}>
                <ListItemText
                  primary={format.toUpperCase()}
                  secondary={`Export as ${format} format`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Action Buttons */}
      <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={loadAnalytics}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
        >
          {loading ? 'Analyzing...' : 'Refresh Analytics'}
        </Button>
        {onOptimizationApplied && performance && (
          <Button
            variant="contained"
            onClick={onOptimizationApplied}
            disabled={performance.optimizationSuggestions.length === 0}
          >
            Apply Optimizations
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default StyleMapAnalytics;
