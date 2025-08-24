import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Stack,
  IconButton,
  Button,
  Box,
  Paper,
  Tabs,
  Tab,
  Fab,
  Badge,
} from '@mui/material';
import {
  Close as CloseIcon,
  Stop as StopIcon,
  ErrorOutline as ErrorOutlineIcon,
  Timeline as TimelineIcon,
  Map as MapIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { BatchMonitorDialogProps, BatchStatus } from '~/types';
// import { mockShapeService } from '~/services/MockShapeService';
import { BatchProgressSplitView } from './batch/BatchProgressSplitView';
import { MapPreview } from './batch/MapPreview';
import { ErrorConsoleDialog } from './batch/ErrorConsoleDialog';
import { BatchStatusChip } from './batch/BatchStatusChip';
import { useBatchWorkerConsole } from '~/hooks/useBatchWorkerConsole';
import { useErrorConsole } from '~/hooks/useErrorConsole';

export const BatchProcessingMonitorDialog: React.FC<BatchMonitorDialogProps> = ({
  open,
  onClose,
  nodeId,
  config,
  urlMetadata,
  onBatchCompleted,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedTab, setSelectedTab] = useState(0);
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('preparing');
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  
  // Error console management
  const { errors, addError, clearErrors, errorCount, hasErrors } = useErrorConsole();
  
  // Batch worker console hook (mock implementation)
  const {
    downloadTasks,
    simplify1Tasks,
    simplify2Tasks,
    vectorTileTasks,
    canStart,
    hasStarted,
    hasFinished,
    handleStart,
    handleCancelTask,
    handleResumeTask,
    handleStopAll,
  } = useBatchWorkerConsole({
    id: nodeId,
    config,
    urlMetadata,
    onError: addError,
  });

  // Auto-start batch processing
  useEffect(() => {
    if (canStart && !hasStarted) {
      handleStart().catch((error) => {
        addError(`Failed to start batch processing: ${error.message}`);
        setBatchStatus('error');
      });
    }
  }, [canStart, hasStarted, handleStart, addError]);

  // Update batch status based on task progress
  useEffect(() => {
    if (!hasStarted) {
      setBatchStatus('preparing');
    } else if (hasFinished) {
      setBatchStatus('completed');
    } else if (downloadTasks.length > 0) {
      if (simplify1Tasks.some(t => t.stage === 'process')) {
        setBatchStatus('processing');
      } else if (vectorTileTasks.some(t => t.stage === 'process')) {
        setBatchStatus('generating');
      } else {
        setBatchStatus('downloading');
      }
    }
  }, [hasStarted, hasFinished, downloadTasks, simplify1Tasks, vectorTileTasks]);

  // Handle batch completion
  useEffect(() => {
    if (hasFinished && onBatchCompleted) {
      enqueueSnackbar('All batch processes completed successfully!', { 
        variant: 'success',
        autoHideDuration: 5000 
      });
      // Delay to allow user to see completion status
      setTimeout(() => {
        onBatchCompleted();
      }, 2000);
    }
  }, [hasFinished, onBatchCompleted, enqueueSnackbar]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (hasStarted && !hasFinished) {
      setShowCloseConfirmation(true);
    } else {
      onClose();
    }
  }, [hasStarted, hasFinished, onClose]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const allTasks = [...downloadTasks, ...simplify1Tasks, ...simplify2Tasks, ...vectorTileTasks];
    if (allTasks.length === 0) return 0;
    
    const completedTasks = allTasks.filter(t => t.stage === 'success').length;
    return Math.round((completedTasks / allTasks.length) * 100);
  }, [downloadTasks, simplify1Tasks, simplify2Tasks, vectorTileTasks]);

  return (
    <>
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="xl"
        fullScreen
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h5">Batch Processing Monitor</Typography>
            <BatchStatusChip status={batchStatus} />
            <Typography variant="body2" color="text.secondary">
              {overallProgress}% Complete
            </Typography>
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <Button 
              variant="outlined" 
              onClick={handleStopAll}
              disabled={!hasStarted || hasFinished}
              color="error"
              startIcon={<StopIcon />}
            >
              Stop All
            </Button>
            <IconButton onClick={handleClose} disabled={hasStarted && !hasFinished}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0, height: '100%' }}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Tab Navigation */}
            <Paper sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)} variant="fullWidth">
                <Tab icon={<TimelineIcon />} label="Progress" iconPosition="start" />
                <Tab 
                  icon={<MapIcon />} 
                  label="Map Preview" 
                  iconPosition="start"
                  disabled={!hasStarted || downloadTasks.length === 0}
                />
              </Tabs>
            </Paper>
            
            {/* Tab Content */}
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {selectedTab === 0 && (
                <BatchProgressSplitView
                  config={config}
                  downloadTasks={downloadTasks}
                  simplify1Tasks={simplify1Tasks}
                  simplify2Tasks={simplify2Tasks}
                  vectorTileTasks={vectorTileTasks}
                  onCancelTask={handleCancelTask}
                  onResumeTask={handleResumeTask}
                />
              )}
              
              {selectedTab === 1 && (
                <Box sx={{ height: '100%', p: 2 }}>
                  <MapPreview
                    nodeId={nodeId}
                    downloadTasks={downloadTasks}
                    vectorTileTasks={vectorTileTasks}
                    hasStarted={hasStarted}
                  />
                </Box>
              )}
            </Box>
            
            {/* Error Display Floating Button */}
            {hasErrors && (
              <Fab
                color="error"
                sx={{ position: 'absolute', bottom: 16, right: 16 }}
                onClick={() => setErrorDialogOpen(true)}
              >
                <Badge badgeContent={errorCount} color="error">
                  <ErrorOutlineIcon />
                </Badge>
              </Fab>
            )}
          </Box>
        </DialogContent>
      </Dialog>
      
      {/* Error Console Dialog */}
      <ErrorConsoleDialog 
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        errors={errors}
        onClearErrors={clearErrors}
      />
      
      {/* Close Confirmation Dialog */}
      <Dialog open={showCloseConfirmation} onClose={() => setShowCloseConfirmation(false)}>
        <DialogContent>
          <Typography>
            Batch processing is still running. Are you sure you want to close?
            The process will continue in the background.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }} justifyContent="flex-end">
            <Button onClick={() => setShowCloseConfirmation(false)}>
              Continue Monitoring
            </Button>
            <Button 
              variant="contained" 
              color="warning"
              onClick={() => {
                setShowCloseConfirmation(false);
                onClose();
              }}
            >
              Close Anyway
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
};