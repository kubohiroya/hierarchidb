import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  BugReport as BugReportIcon,
  Close as CloseIcon,
  Map as MapIcon,
  Stop as StopIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { BatchMonitorDialogProps, BatchStatus } from '../shared';
// import { mockShapeService } from '~/services/MockShapeService';
import { BatchProgressSplitView } from './batch/BatchProgressSplitView.js';
import { MapPreview } from './batch/MapPreview.js';
import { ErrorConsoleDialog } from './batch/ErrorConsoleDialog.js';
import { ErrorReportPanel } from './batch/ErrorReportPanel.js';
import type { ErrorLogEntry } from '../hooks/useErrorConsole.js';
import { BatchStatusChip } from './batch/BatchStatusChip.js';
import { useBatchWorkerConsole } from '../hooks/useBatchWorkerConsole';
import { useErrorConsole } from '../hooks/useErrorConsole';

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

  // Enhanced error reporting with context
  const addErrorWithContext = useCallback(
    (
      message: string,
      level: ErrorLogEntry['level'] = 'error',
      phase: string = 'processing',
      rowNumber?: number,
      columnName?: string,
    ) => {
      addError(message, { level, phase, rowNumber, columnName });
    },
    [addError],
  );

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
    onError: (message: string) => addErrorWithContext(message, 'error', 'batch-processing'),
  });

  // Auto-start batch processing
  useEffect(() => {
    if (canStart && !hasStarted) {
      handleStart().catch((error) => {
        addErrorWithContext(
          `Failed to start batch processing: ${error.message}`,
          'critical',
          'startup',
        );
        setBatchStatus('error');
      });
    }
  }, [canStart, hasStarted, handleStart, addErrorWithContext]);

  // Generate test errors for demonstration (can be removed in production)
  useEffect(() => {
    if (hasStarted && errors.length === 0) {
      // Add some sample errors for testing
      setTimeout(() => {
        addErrorWithContext('Connection timeout to data source', 'warning', 'download');
      }, 2000);

      setTimeout(() => {
        addErrorWithContext('Invalid geometry in row 1,245', 'error', 'simplify', 1245, 'geometry');
      }, 4000);

      setTimeout(() => {
        addErrorWithContext('Memory usage approaching limit (85%)', 'warning', 'processing');
      }, 6000);

      setTimeout(() => {
        addErrorWithContext('Database connection lost', 'critical', 'storage');
      }, 8000);

      setTimeout(() => {
        addErrorWithContext(
          'Duplicate key found in administrative data',
          'error',
          'validation',
          892,
          'admin_code',
        );
      }, 10000);

      setTimeout(() => {
        addErrorWithContext('Vector tile generation completed with warnings', 'info', 'vectortile');
      }, 12000);
    }
  }, [hasStarted, errors.length, addErrorWithContext]);

  // Update batch status based on task progress
  useEffect(() => {
    if (!hasStarted) {
      setBatchStatus('preparing');
    } else if (hasFinished) {
      setBatchStatus('completed');
    } else if (downloadTasks.length > 0) {
      if (simplify1Tasks.some((t) => t.stage === 'process')) {
        setBatchStatus('processing');
      } else if (vectorTileTasks.some((t) => t.stage === 'process')) {
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
        autoHideDuration: 5000,
      });
      // Delay to allow user to see completion status
      setTimeout(() => {
        onBatchCompleted();
      }, 2000);
    }
  }, [hasFinished, onBatchCompleted, enqueueSnackbar]);

  // Handle base-dialog close
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

    const completedTasks = allTasks.filter((t) => t.stage === 'success').length;
    return Math.round((completedTasks / allTasks.length) * 100);
  }, [downloadTasks, simplify1Tasks, simplify2Tasks, vectorTileTasks]);

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="xl" fullScreen disableEscapeKeyDown>
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
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
              <Tabs
                value={selectedTab}
                onChange={(_, newValue) => setSelectedTab(newValue)}
                variant="fullWidth"
              >
                <Tab icon={<TimelineIcon />} label="Progress" iconPosition="start" />
                <Tab
                  icon={<MapIcon />}
                  label="Map Preview"
                  iconPosition="start"
                  disabled={!hasStarted || downloadTasks.length === 0}
                />
                <Tab
                  icon={
                    <Badge badgeContent={hasErrors ? errorCount : 0} color="error">
                      <BugReportIcon />
                    </Badge>
                  }
                  label="Error Report"
                  iconPosition="start"
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

              {selectedTab === 2 && (
                <ErrorReportPanel
                  errors={errors}
                  onClearErrors={clearErrors}
                  batchStatus={batchStatus}
                  taskCounts={{
                    download: downloadTasks.length,
                    simplify1: simplify1Tasks.length,
                    simplify2: simplify2Tasks.length,
                    vectorTile: vectorTileTasks.length,
                  }}
                />
              )}
            </Box>
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
            Batch processing is still running. Are you sure you want to close? The process will
            continue in the background.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }} justifyContent="flex-end">
            <Button onClick={() => setShowCloseConfirmation(false)}>Continue Monitoring</Button>
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
