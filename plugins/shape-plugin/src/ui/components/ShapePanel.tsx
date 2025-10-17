/**
 * Shape Panel Component - UI Layer
 * Panel component for displaying shape-plugin entity information
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import type { NodeId } from '../../common/shared/types.js';
import { useShapeAPIGetter } from '../hooks/useShapeAPI.js';
import { useShapeEntityProgress } from '../hooks/useShapeProgress.js';
import { formatBytes, summarizeCheckboxState, type ShapeEntity } from '../../common/shared/index.js';

export interface ShapePanelProps {
  nodeId: NodeId;
  onEdit?: () => void;
  onError?: (error: Error) => void;
}

export function ShapePanel({ nodeId, onEdit, onError }: ShapePanelProps) {
  const getShapeAPI = useShapeAPIGetter();

  // State management
  const [entity, setEntity] = useState<ShapeEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkboxSummary = useMemo(
    () => summarizeCheckboxState(entity?.checkboxState),
    [entity?.checkboxState],
  );

  const derivedCountries = useMemo(() => {
    if (!entity?.urlMetadata?.length) {
      return [] as string[];
    }
    const codes = new Set<string>();
    entity.urlMetadata.forEach((meta) => {
      if (meta?.countryCode) {
        codes.add(meta.countryCode);
      }
    });
    return Array.from(codes).sort();
  }, [entity?.urlMetadata]);

  // Real-time progress monitoring
  const {
    progress: batchProgress,
    status: processingStatus,
    error: progressError,
    // isSubscribed,
    refresh: refreshProgress,
  } = useShapeEntityProgress(nodeId, {
    autoSubscribe: true,
    pollingInterval: 3000,
  });

  // Load entity data
  const loadEntity = useCallback(async () => {
    try {
      const api = await getShapeAPI();
      const entityData = await api.getEntity(nodeId);
      setEntity(entityData || null);
    } catch (error) {
      console.error('Failed to load shape entity:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to load entity'));
    } finally {
      setLoading(false);
    }
  }, [nodeId, getShapeAPI, onError]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadEntity(),
        refreshProgress(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadEntity, refreshProgress]);

  // Initial load
  useEffect(() => {
    loadEntity();
  }, [loadEntity]);

  // Handle progress errors
  useEffect(() => {
    if (progressError && progressError !== progressError) {
      console.error('Progress monitoring error:', progressError);
      onError?.(progressError);
    }
  }, [progressError, onError]);

  // Batch processing actions
  const handleStartProcessing = useCallback(async () => {
    if (!entity) return;

    try {
      const api = await getShapeAPI();
      // Note: startBatchProcessing expects a workingCopyId (NodeId alias), not nodeId
      // For now, we cast the nodeId, but this should be refactored to use proper WorkingCopyTypes
      await api.startBatchProcessing(
        nodeId as unknown as string,
        entity.processingConfig,
        entity.urlMetadata,
      );
      await handleRefresh();
    } catch (error) {
      console.error('Failed to start processing:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to start processing'));
    }
  }, [entity, nodeId, getShapeAPI, onError, handleRefresh]);

  const handlePauseProcessing = useCallback(async () => {
    if (!entity?.batchSessionId) return;

    try {
      const api = await getShapeAPI();
      await api.pauseBatchProcessing(entity.batchSessionId as unknown as string);
      await handleRefresh();
    } catch (error) {
      console.error('Failed to pause processing:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to pause processing'));
    }
  }, [entity, getShapeAPI, onError, handleRefresh]);

  const handleStopProcessing = useCallback(async () => {
    if (!entity?.batchSessionId) return;

    try {
      const api = await getShapeAPI();
      await api.cancelBatchProcessing(entity.batchSessionId as unknown as string);
      await handleRefresh();
    } catch (error) {
      console.error('Failed to stop processing:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to stop processing'));
    }
  }, [entity, getShapeAPI, onError, handleRefresh]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading shape data...
        </Typography>
      </Box>
    );
  }

  if (!entity) {
    return <Alert severity="error">Shape entity not found for node: {nodeId}</Alert>;
  }

  //const checkboxState = parseCheckboxState(entity.checkboxState);
  const isProcessing = processingStatus?.status === 'processing';

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" component="h2">
          {entity.name}
        </Typography>

        <Box display="flex" gap={1}>
          <Button
            size="small"
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </Button>

          <Button size="small" startIcon={<EditIcon />} onClick={onEdit}>
            Edit
          </Button>
        </Box>
      </Box>

      {/* Basic Information */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Basic Information
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Data Source
              </Typography>
              <Typography variant="body1">{entity.dataSourceName}</Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Processing Status
              </Typography>
              <Chip
                label={processingStatus?.status || 'unknown'}
                color={
                  processingStatus?.status === 'completed'
                    ? 'success'
                    : processingStatus?.status === 'processing'
                      ? 'primary'
                      : processingStatus?.status === 'failed'
                        ? 'error'
                        : 'default'
                }
                size="small"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">
                {entity.description || 'No description provided'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {processingStatus && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Processing Status
            </Typography>

            {batchProgress && isProcessing && (
              <Box sx={{ mb: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">
                    {batchProgress.currentStage || 'Processing'}
                  </Typography>
                  <Typography variant="body2">{batchProgress.percentage.toFixed(1)}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={batchProgress.percentage} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  {batchProgress.completed} of {batchProgress.total} completed
                  {batchProgress.failed > 0 && `, ${batchProgress.failed} failed`}
                </Typography>
              </Box>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Features
                </Typography>
                <Typography variant="body1">
                  {processingStatus.totalFeatures?.toLocaleString() || '0'}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Vector Tiles
                </Typography>
                <Typography variant="body1">
                  {processingStatus.totalVectorTiles?.toLocaleString() || '0'}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Storage Used
                </Typography>
                <Typography variant="body1">
                  {formatBytes(processingStatus.storageUsed || 0)}
                </Typography>
              </Grid>
            </Grid>

            {/* Processing Controls */}
            <Box mt={2}>
              {!isProcessing && checkboxSummary.hasSelection && (
                <Button
                  variant="contained"
                  startIcon={<PlayIcon />}
                  onClick={handleStartProcessing}
                  size="small"
                >
                  Start Processing
                </Button>
              )}

              {isProcessing && (
                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    startIcon={<PauseIcon />}
                    onClick={handlePauseProcessing}
                    size="small"
                  >
                    Pause
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={handleStopProcessing}
                    size="small"
                  >
                    Stop
                  </Button>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Configuration Details */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Configuration Details</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Selected Countries
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5} mt={1}>
                {(
                  derivedCountries.length > 0
                    ? derivedCountries
                    : entity?.selectedCountries ?? []
                ).map((country) => (
                  <Chip key={country} label={country} size="small" />
                ))}
                {derivedCountries.length === 0 && !(entity?.selectedCountries?.length) && checkboxSummary.selectedRowCount > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {checkboxSummary.selectedRowCount} countries selected (pending batch sync)
                  </Typography>
                )}
                {checkboxSummary.selectedRowCount === 0 && (
                  <Typography variant="body2" color="text.disabled">
                    No countries selected
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Admin Levels
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5} mt={1}>
                {(entity?.adminLevels?.length ? entity.adminLevels : checkboxSummary.levels).map((level) => (
                  <Chip key={level} label={`Level ${level}`} size="small" />
                ))}
                {entity?.adminLevels?.length === 0 && checkboxSummary.levels.length === 0 && (
                  <Typography variant="body2" color="text.disabled">
                    No admin levels selected
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Processing Configuration
              </Typography>
              <Box
                component="pre"
                sx={{
                  fontSize: '0.75rem',
                  backgroundColor: 'grey.50',
                  p: 1,
                  borderRadius: 1,
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(entity.processingConfig, null, 2)}
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* URL Metadata */}
      {entity.urlMetadata.length > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Data Sources ({entity.urlMetadata.length})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {entity.urlMetadata.slice(0, 5).map((metadata, index) => (
                <Box
                  key={index}
                  sx={{ mb: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}
                >
                  <Typography variant="body2" noWrap>
                    <strong>{metadata.countryCode}</strong> - Level {metadata.adminLevel}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {metadata.url}
                  </Typography>
                  {metadata.estimatedSize && (
                    <Typography variant="caption" color="text.secondary">
                      {' • '}
                      {formatBytes(metadata.estimatedSize)}
                    </Typography>
                  )}
                </Box>
              ))}
              {entity.urlMetadata.length > 5 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {entity.urlMetadata.length - 5} more
                </Typography>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}
