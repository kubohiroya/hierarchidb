/**
 * Shape View Panel Component
 * Displays Shape node information and provides management controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  LinearProgress,
  Alert,
  Grid,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Storage as StorageIcon,
  Map as MapIcon,
} from '@mui/icons-material';
import { NodeId } from '@hierarchidb/common-core';
import type { ShapeEntity } from '~/types';
import type { BatchStatus } from '~/services/types';

interface ShapeViewPanelProps {
  nodeId: NodeId;
  entity: ShapeEntity;
  onEdit: () => void;
  onRefresh: () => void;
}

export const ShapeViewPanel: React.FC<ShapeViewPanelProps> = ({
  nodeId,
  entity,
  onEdit,
  onRefresh,
}) => {
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch batch status
  const fetchBatchStatus = useCallback(async () => {
    if (!entity.batchSessionId) {
      setBatchStatus(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // In a real implementation, this would call the worker API
      // For now, we'll simulate the response
      const mockStatus: BatchStatus = {
        session: {
          sessionId: entity.batchSessionId,
          nodeId: entity.nodeId,
          status: entity.processingStatus as any,
          config: entity.processingConfig as any,
          startedAt: Date.now() - 60000,
          updatedAt: Date.now(),
          progress: {
            total: 100,
            completed: 45,
            failed: 2,
            skipped: 0,
            percentage: 45,
            currentStage: 'download',
            currentTask: 'Downloading administrative boundaries',
          },
          stages: {
            download: {
              status: 'running',
              progress: 0.6,
              tasksTotal: 20,
              tasksCompleted: 12,
              tasksFailed: 1,
              message: 'Downloading country data',
            },
            simplify1: {
              status: 'waiting',
              progress: 0,
              tasksTotal: 20,
              tasksCompleted: 0,
              tasksFailed: 0,
            },
            simplify2: {
              status: 'waiting',
              progress: 0,
              tasksTotal: 10,
              tasksCompleted: 0,
              tasksFailed: 0,
            },
            vectortile: {
              status: 'waiting',
              progress: 0,
              tasksTotal: 50,
              tasksCompleted: 0,
              tasksFailed: 0,
            },
          },
        },
        currentTasks: [],
        queuedTasks: 8,
        errors: [],
        warnings: [],
        estimatedTimeRemaining: 180000,
      };
      
      setBatchStatus(mockStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch batch status');
    } finally {
      setIsLoading(false);
    }
  }, [entity.batchSessionId, entity.nodeId, entity.processingStatus, entity.processingConfig]);

  // Auto-refresh batch status
  useEffect(() => {
    fetchBatchStatus();
    
    let interval: NodeJS.Timeout | null = null;
    if (entity.batchSessionId && entity.processingStatus === 'processing') {
      interval = setInterval(fetchBatchStatus, 5000); // Refresh every 5 seconds
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchBatchStatus, entity.batchSessionId, entity.processingStatus]);

  // Handle batch control actions
  const handleBatchAction = async (action: 'start' | 'pause' | 'resume' | 'cancel') => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real implementation, this would call the worker API
      console.log(`${action} batch processing for session:`, entity.batchSessionId);
      
      // Simulate action delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh status after action
      await fetchBatchStatus();
      onRefresh(); // Refresh parent component
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} batch processing`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'primary';
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'paused': return 'warning';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          {entity.name}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit Configuration">
            <IconButton onClick={onEdit} size="small">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh Data">
            <IconButton onClick={onRefresh} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Basic Information */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Configuration
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Data Source
              </Typography>
              <Typography variant="body1">
                {entity.dataSourceName.toUpperCase()}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Status
              </Typography>
              <Chip
                label={entity.processingStatus}
                color={getStatusColor(entity.processingStatus)}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Countries Selected
              </Typography>
              <Typography variant="body1">
                {entity.selectedCountries.length || 'None'}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Admin Levels
              </Typography>
              <Typography variant="body1">
                {entity.adminLevels.join(', ') || 'None'}
              </Typography>
            </Grid>
          </Grid>

          {entity.description && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">
                {entity.description}
              </Typography>
            </>
          )}
        </CardContent>
      </Card>

      {/* Batch Processing Status */}
      {batchStatus && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Batch Processing
              </Typography>
              
              <Stack direction="row" spacing={1}>
                {batchStatus.session.status === 'running' && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PauseIcon />}
                    onClick={() => handleBatchAction('pause')}
                    disabled={isLoading}
                  >
                    Pause
                  </Button>
                )}
                
                {batchStatus.session.status === 'paused' && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PlayIcon />}
                    onClick={() => handleBatchAction('resume')}
                    disabled={isLoading}
                  >
                    Resume
                  </Button>
                )}
                
                {(batchStatus.session.status === 'running' || batchStatus.session.status === 'paused') && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={() => handleBatchAction('cancel')}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                )}
              </Stack>
            </Box>

            {/* Overall Progress */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">
                  Overall Progress ({batchStatus.session.progress.completed}/{batchStatus.session.progress.total})
                </Typography>
                <Typography variant="body2">
                  {Math.round(batchStatus.session.progress.percentage)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={batchStatus.session.progress.percentage}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            {/* Current Task */}
            {batchStatus.session.progress.currentTask && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current: {batchStatus.session.progress.currentTask}
              </Typography>
            )}

            {/* Stage Progress */}
            <Grid container spacing={2}>
              {Object.entries(batchStatus.session.stages).map(([stage, stageStatus]) => (
                <Grid item xs={12} sm={6} key={stage}>
                  <Box sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                        {stage}
                      </Typography>
                      <Chip
                        label={stageStatus.status}
                        color={getStatusColor(stageStatus.status)}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={stageStatus.progress * 100}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {stageStatus.tasksCompleted}/{stageStatus.tasksTotal} tasks
                      {stageStatus.tasksFailed > 0 && ` (${stageStatus.tasksFailed} failed)`}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Timing Information */}
            {batchStatus.estimatedTimeRemaining && (
              <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption">
                  Estimated time remaining: {formatDuration(batchStatus.estimatedTimeRemaining)}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!entity.batchSessionId && entity.selectedCountries.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <MapIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Actions
            </Typography>
            
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={() => handleBatchAction('start')}
              disabled={isLoading}
              size="large"
            >
              Start Batch Processing
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};