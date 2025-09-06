import React, { useEffect, useCallback, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { EntityId } from '@hierarchidb/common-type';
import { useShapeAPIGetter } from '../hooks/useShapeAPI';
import { useShapeProgress } from '../hooks/useShapeProgress';
import { BatchProgressEvent, ProgressInfo } from '../../shared';
import { TabularPreview } from '@hierarchidb/ui-core/src';
import { getEphemeralShapeDB } from '../../services/database/EphemeralShapeDB';

export interface BatchProcessingDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  workingCopyId: EntityId;
  onComplete?: (result: 'success' | 'cancelled' | 'error') => void;
  onError?: (error: Error) => void;
}

const BATCH_STAGES = [
  { key: 'download', label: 'Download', description: 'Downloading GeoJSON files' },
  { key: 'simplify1', label: 'Simplify 1', description: 'Initial feature simplification' },
  { key: 'simplify2', label: 'Simplify 2', description: 'Advanced topology optimization' },
  { key: 'vectorTiles', label: 'Vector Tiles', description: 'Generating MVT tiles' },
];

export function BatchProcessingDialog({
  open,
  onClose,
  sessionId,
  workingCopyId,
  onComplete,
  onError,
}: BatchProcessingDialogProps) {
  const getShapeAPI = useShapeAPIGetter();
  
  const [isPaused, setIsPaused] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [completionTimer, setCompletionTimer] = useState<NodeJS.Timeout | null>(null);
  const [tab, setTab] = useState(0);
  const [tableId, setTableId] = useState<string | null>(null);

  // Real-time progress subscription
  const {
    progress,
    status,
    error: progressError,
    isSubscribed,
  } = useShapeProgress(sessionId, {
    autoSubscribe: true,
    pollingInterval: 1000,
  });

  // Get current stage index
  const currentStageIndex = BATCH_STAGES.findIndex(
    stage => stage.key === status?.stage
  );

  const isProcessing = status?.status === 'processing';
  const isCompleted = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  const isCancelled = status?.status === 'cancelled';

  // Auto-close on completion
  useEffect(() => {
    if (isCompleted && !completionTimer) {
      const timer = setTimeout(() => {
        onComplete?.('success');
        onClose();
      }, 2000); // Auto-close after 2 seconds
      
      setCompletionTimer(timer);
    }

    return () => {
      if (completionTimer) {
        clearTimeout(completionTimer);
      }
    };
  }, [isCompleted, completionTimer, onComplete, onClose]);

  // Handle errors
  useEffect(() => {
    if (progressError || isFailed) {
      const error = progressError || new Error(status?.error || 'Processing failed');
      onError?.(error);
    }
  }, [progressError, isFailed, status?.error, onError]);

  // Control handlers
  const handlePause = useCallback(async () => {
    try {
      const api = await getShapeAPI();
      await api.pauseBatchProcessing(workingCopyId);
      setIsPaused(true);
    } catch (error) {
      console.error('Failed to pause processing:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to pause'));
    }
  }, [getShapeAPI, workingCopyId, onError]);

  const handleResume = useCallback(async () => {
    try {
      const api = await getShapeAPI();
      await api.resumeBatchProcessing(workingCopyId);
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to resume processing:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to resume'));
    }
  }, [getShapeAPI, workingCopyId, onError]);

  const handleCancel = useCallback(async () => {
    try {
      const api = await getShapeAPI();
      await api.cancelBatchProcessing(workingCopyId);
      onComplete?.('cancelled');
      onClose();
    } catch (error) {
      console.error('Failed to cancel processing:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to cancel'));
    }
  }, [getShapeAPI, workingCopyId, onComplete, onClose, onError]);

  const handleClose = useCallback(() => {
    if (isProcessing && !isPaused) {
      // Confirm before closing active processing
      const confirmed = window.confirm(
        'Processing is still active. Do you want to pause and close?'
      );
      if (confirmed) {
        handlePause().then(() => onClose());
      }
    } else {
      onClose();
    }
  }, [isProcessing, isPaused, handlePause, onClose]);

  // Load tableId for preview
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getEphemeralShapeDB();
        // @ts-ignore
        const sess = await (db.table('sessions') as any).get(sessionId);
        if (!cancelled) setTableId(sess?.tableId || null);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const renderProgressSection = () => {
    if (!progress) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="body1">
            {status?.stage ? BATCH_STAGES.find(s => s.key === status.stage)?.label : 'Processing'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {progress.percentage.toFixed(1)}%
          </Typography>
        </Box>
        
        <LinearProgress 
          variant="determinate" 
          value={progress.percentage} 
          sx={{ height: 8, borderRadius: 4 }}
        />
        
        <Box display="flex" justifyContent="space-between" mt={1}>
          <Typography variant="caption" color="text.secondary">
            {progress.completed} of {progress.total} completed
            {progress.failed > 0 && `, ${progress.failed} failed`}
          </Typography>
          
          <Typography variant="caption" color="text.secondary">
            {isSubscribed ? '🔔 Live' : '📡 Polling'}
          </Typography>
        </Box>
      </Box>
    );
  };

  const renderStageProgress = () => {
    return (
      <Box sx={{ mb: 3 }}>
        <Stepper activeStep={currentStageIndex} alternativeLabel>
          {BATCH_STAGES.map((stage, index) => (
            <Step key={stage.key} completed={index < currentStageIndex}>
              <StepLabel
                error={isFailed && index === currentStageIndex}
                StepIconComponent={
                  isFailed && index === currentStageIndex
                    ? () => <ErrorIcon color="error" />
                    : index < currentStageIndex
                      ? () => <CheckCircleIcon color="success" />
                      : undefined
                }
              >
                {stage.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
    );
  };

  const renderStatusSection = () => {
    const getStatusColor = () => {
      if (isCompleted) return 'success';
      if (isFailed) return 'error';
      if (isCancelled) return 'warning';
      if (isPaused) return 'warning';
      if (isProcessing) return 'primary';
      return 'default';
    };

    const getStatusText = () => {
      if (isCompleted) return 'Completed';
      if (isFailed) return 'Failed';
      if (isCancelled) return 'Cancelled';
      if (isPaused) return 'Paused';
      if (isProcessing) return 'Processing';
      return 'Preparing';
    };

    return (
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Chip 
          label={getStatusText()}
          color={getStatusColor() as any}
          variant={isProcessing ? 'filled' : 'outlined'}
        />
        
        {isProcessing && (
          <CircularProgress size={20} />
        )}
        
        {progress && (
          <Typography variant="body2" color="text.secondary">
            Session: {sessionId.slice(-8)}
          </Typography>
        )}
      </Box>
    );
  };

  const renderControlButtons = () => {
    return (
      <Box display="flex" gap={1}>
        {isProcessing && !isPaused && (
          <Button
            startIcon={<PauseIcon />}
            onClick={handlePause}
            color="warning"
            variant="outlined"
          >
            Pause
          </Button>
        )}
        
        {isPaused && (
          <Button
            startIcon={<PlayIcon />}
            onClick={handleResume}
            color="primary"
            variant="contained"
          >
            Resume
          </Button>
        )}
        
        {(isProcessing || isPaused) && (
          <Button
            startIcon={<StopIcon />}
            onClick={handleCancel}
            color="error"
            variant="outlined"
          >
            Cancel
          </Button>
        )}
        
        <Button onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide Details' : 'Show Details'}
        </Button>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isProcessing && !isPaused}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Batch Processing</Typography>
          <IconButton
            onClick={handleClose}
            disabled={isProcessing && !isPaused}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Progress" />
          <Tab label="Data Table" />
        </Tabs>
      </Box>

      <DialogContent>
        {tab === 0 && (
          <>
            {renderStatusSection()}
        
            {(isFailed || progressError) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {status?.error || progressError?.message || 'An error occurred during processing'}
              </Alert>
            )}

            {isCompleted && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Processing completed successfully! Dialog will close automatically.
              </Alert>
            )}

            {renderStageProgress()}
            {renderProgressSection()}

            {showDetails && progress && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Processing Details
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Total Tasks"
                      secondary={progress.total}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Completed"
                      secondary={progress.completed}
                    />
                  </ListItem>
                  {progress.failed > 0 && (
                    <ListItem>
                      <ListItemIcon>
                        <ErrorIcon color="error" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Failed"
                        secondary={progress.failed}
                      />
                    </ListItem>
                  )}
                  <ListItem>
                    <ListItemText 
                      primary="Current Stage"
                      secondary={status?.stage || 'Unknown'}
                    />
                  </ListItem>
                </List>
              </Box>
            )}
          </>
        )}
        {tab === 1 && (
          <Box sx={{ minHeight: 360 }}>
            <TabularPreview pluginId="shape" tableId={tableId || undefined} />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {renderControlButtons()}
      </DialogActions>
    </Dialog>
  );
}
