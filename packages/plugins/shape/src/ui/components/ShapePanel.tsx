/**
 * Shape Panel Component - UI Layer
 * Panel component for displaying shape entity information
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  LinearProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { NodeId, EntityId } from '@hierarchidb/00-core';
import { useShapeAPIGetter } from '../hooks/useShapeAPI';
import { 
  ShapeEntity,
  ProcessingStatus,
  ProgressInfo,
  formatBytes,
  formatDuration,
  parseCheckboxState
} from '../../shared';

export interface ShapePanelProps {
  nodeId: NodeId;
  onEdit?: () => void;
  onError?: (error: Error) => void;
}

export function ShapePanel({ nodeId, onEdit, onError }: ShapePanelProps) {
  const getShapeAPI = useShapeAPIGetter();
  
  // State management
  const [entity, setEntity] = useState<ShapeEntity | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [batchProgress, setBatchProgress] = useState<ProgressInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load entity data
  const loadEntity = useCallback(async () => {
    try {
      const api = await getShapeAPI();
      const entityData = await api.getEntity(nodeId);
      setEntity(entityData || null);
      
      if (entityData) {
        const status = await api.getProcessingStatus(nodeId);
        setProcessingStatus(status);
        
        if (entityData.batchSessionId) {
          const progress = await api.getBatchProgress(entityData.batchSessionId as EntityId);
          setBatchProgress(progress);
        }
      }
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
    await loadEntity();
    setRefreshing(false);
  }, [loadEntity]);

  // Initial load
  useEffect(() => {
    loadEntity();
  }, [loadEntity]);

  // Batch processing actions
  const handleStartProcessing = useCallback(async () => {
    if (!entity) return;
    
    try {
      const api = await getShapeAPI();
      // Note: startBatchProcessing expects a workingCopyId (EntityId), not nodeId
      // For now, we cast the nodeId, but this should be refactored to use proper WorkingCopy
      await api.startBatchProcessing(nodeId as unknown as EntityId, entity.processingConfig, entity.urlMetadata);
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
      await api.pauseBatchProcessing(entity.batchSessionId as EntityId);
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
      await api.cancelBatchProcessing(entity.batchSessionId as EntityId);
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
    return (
      <Alert severity="error">
        Shape entity not found for node: {nodeId}
      </Alert>
    );
  }

  const checkboxState = parseCheckboxState(entity.checkboxState);
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
          
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={onEdit}
          >
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
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Data Source
              </Typography>
              <Typography variant="body1">
                {entity.dataSourceName}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Processing Status
              </Typography>
              <Chip 
                label={processingStatus?.status || 'unknown'}
                color={
                  processingStatus?.status === 'completed' ? 'success' :
                  processingStatus?.status === 'processing' ? 'primary' :
                  processingStatus?.status === 'failed' ? 'error' : 'default'
                }
                size="small"
              />
            </Grid>
            
            <Grid item xs={12}>
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
                  <Typography variant="body2">
                    {batchProgress.percentage.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={batchProgress.percentage} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  {batchProgress.completed} of {batchProgress.total} completed
                  {batchProgress.failed > 0 && `, ${batchProgress.failed} failed`}
                </Typography>
              </Box>
            )}
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">
                  Features
                </Typography>
                <Typography variant="body1">
                  {processingStatus.totalFeatures?.toLocaleString() || '0'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">
                  Vector Tiles
                </Typography>
                <Typography variant="body1">
                  {processingStatus.totalVectorTiles?.toLocaleString() || '0'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={4}>
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
              {!isProcessing && entity.selectedCountries.length > 0 && (
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
          <Typography variant="subtitle1">
            Configuration Details
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Selected Countries
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5} mt={1}>
                {entity.selectedCountries.map((country) => (
                  <Chip key={country} label={country} size="small" />
                ))}
                {entity.selectedCountries.length === 0 && (
                  <Typography variant="body2" color="text.disabled">
                    No countries selected
                  </Typography>
                )}
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Admin Levels
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5} mt={1}>
                {entity.adminLevels.map((level) => (
                  <Chip key={level} label={`Level ${level}`} size="small" />
                ))}
                {entity.adminLevels.length === 0 && (
                  <Typography variant="body2" color="text.disabled">
                    No admin levels selected
                  </Typography>
                )}
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Processing Configuration
              </Typography>
              <Box component="pre" sx={{ 
                fontSize: '0.75rem',
                backgroundColor: 'grey.50',
                p: 1,
                borderRadius: 1,
                overflow: 'auto'
              }}>
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
            <Typography variant="subtitle1">
              Data Sources ({entity.urlMetadata.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {entity.urlMetadata.slice(0, 5).map((metadata, index) => (
                <Box key={index} sx={{ mb: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
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