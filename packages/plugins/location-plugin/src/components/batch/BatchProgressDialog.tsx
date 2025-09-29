/**
  * Batch Progress Dialog
   */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Assessment,
  CheckCircle,
  Close,
  Download,
  Error,
  HourglassEmpty,
  Map,
  Pause,
  PlayArrow,
  Stop,
  TableView,
  Timeline,
  Warning,
} from '@mui/icons-material';
import type { NodeId } from '../../types/index.js';
import { CrossViewSnackbar, TabularPreview } from '@hierarchidb/ui-core';
import { getEphemeralLocationDB } from '../../services/database/EphemeralLocationDB.js';
import { useLocationProgress } from '../../hooks/useLocationProgress.js';
import { useTranslation } from '../../i18n/index.js';

interface ProgressInfo {
  percentage: number;
  phase: 'download' | 'filter' | 'cluster' | 'index' | 'complete';
  currentTask: string;
  timeElapsed: string;
  timeRemaining: string;
  estimatedCompletion: string;
  itemsPerSecond: number;
  bytesPerSecond: number;
}

interface StageInfo {
  name: string;
  status: 'waiting' | 'running' | 'completed' | 'failed';
  progress: number;
  itemsProcessed: number;
  totalItems: number;
  errors: number;
}

interface ActiveTask {
  id: string;
  worker: number;
  type: 'download' | 'process';
  target: string;
  status: 'running' | 'retrying' | 'failed';
  progress: number;
  speed: string;
  eta: string;
}

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  source: string;
  message: string;
  details?: any;
}

export interface BatchProgressDialogProps {
  open: boolean;
  onClose: () => void;
  nodeId: NodeId;
  sessionId: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ height: '100%', display: value === index ? 'flex' : 'none', flexDirection: 'column' }}
    >
      {value === index && children}
    </Box>
  );
};

export const BatchProgressDialog: React.FC<BatchProgressDialogProps> = ({
                                                                          open,
                                                                          onClose,
                                                                          sessionId,
                                                                        }) => {
  const { translations } = useTranslation();
  const formatTemplate = useCallback((template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((acc, [key, value]) => acc.replace(new RegExp(`{${key}}`, 'g'), String(value)), template),
  []);
  const [tabValue, setTabValue] = useState(0);
  const [tableId, setTableId] = useState<string | null>(null);
  const datasetId = useMemo(() => (tableId ? `location:${tableId}` : null), [tableId]);
  const { progress: realProgress } = useLocationProgress(sessionId, { autoSubscribe: true });
  const phaseLabelMap = useMemo(() => ({
    download: translations.batch.stages.download,
    filter: translations.batch.stages.filtering,
    cluster: translations.batch.stages.clustering,
    index: translations.batch.stages.indexing,
    complete: translations.batch.progressTitle,
  }), [translations]);
  const [progress, setProgress] = useState<ProgressInfo>({
    percentage: 0,
    phase: 'download',
    currentTask: 'Initializing...',
    timeElapsed: '00:00:00',
    timeRemaining: 'Calculating...',
    estimatedCompletion: '--:--',
    itemsPerSecond: 0,
    bytesPerSecond: 0,
  });

  const stages: StageInfo[] = useMemo(() => [
    { name: translations.batch.stages.download, status: 'running', progress: 25, itemsProcessed: 123, totalItems: 500, errors: 0 },
    { name: translations.batch.stages.filtering, status: 'waiting', progress: 0, itemsProcessed: 0, totalItems: 400, errors: 0 },
    { name: translations.batch.stages.clustering, status: 'waiting', progress: 0, itemsProcessed: 0, totalItems: 350, errors: 0 },
    { name: translations.batch.stages.indexing, status: 'waiting', progress: 0, itemsProcessed: 0, totalItems: 350, errors: 0 },
  ], [translations]);

  const activeTasks: ActiveTask[] = [
    {
      id: 'task1',
      worker: 1,
      type: 'download',
      target: 'JPN_airport',
      status: 'running',
      progress: 75,
      speed: '1.2 MB/s',
      eta: '30s',
    },
    {
      id: 'task2',
      worker: 2,
      type: 'download',
      target: 'KOR_railway',
      status: 'running',
      progress: 45,
      speed: '0.8 MB/s',
      eta: '2m',
    },
    {
      id: 'task3',
      worker: 3,
      type: 'download',
      target: 'CHN_port',
      status: 'retrying',
      progress: 10,
      speed: '--',
      eta: '1m',
    },
  ];

  const logs: LogEntry[] = [
    { timestamp: new Date(), level: 'info', source: 'Downloader', message: 'Started downloading Japan airport dataset' },
    { timestamp: new Date(), level: 'info', source: 'Downloader', message: 'Started downloading South Korea railway dataset' },
    {
      timestamp: new Date(),
      level: 'warning',
      source: 'Downloader',
      message: 'Timeout detected for China port dataset, retrying',
    },
  ];

  const [isPaused, setIsPaused] = useState(false);


  //  WebSocket polling
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setProgress(prev => ({
        ...prev,
        percentage: Math.min(prev.percentage + Math.random() * 2, 100),
        timeElapsed: formatElapsedTime(Date.now() - Date.now() + Math.random() * 60000),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getEphemeralLocationDB();
        const session = (await db.sessions?.get(sessionId)) ?? null;
        if (!cancelled) setTableId(session?.tableId ?? null);
      } catch {
        // Ignore errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleCancel = () => {
    console.log('Cancelling batch process...');
  };

  const getStageIcon = (status: StageInfo['status']) => {
    switch (status) {
      case 'waiting':
        return <HourglassEmpty color="disabled" />;
      case 'running':
        return <CircularProgress size={20} />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', display: 'flex', flexDirection: 'column' },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{translations.batch.dialogTitle}</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={phaseLabelMap[progress.phase] ?? progress.phase}
              color="primary"
              size="small"
            />
            <IconButton size="small" onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </Box>

        {/*
*/}
        <Box mt={2}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">{progress.currentTask}</Typography>
            <Typography variant="body2">{Math.round(progress.percentage)}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress.percentage}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Box display="flex" justifyContent="space-between" mt={1}>
            <Typography variant="caption" color="text.secondary">
              {`${translations.batch.elapsed}: ${progress.timeElapsed}`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {`${translations.batch.remaining}: ${progress.timeRemaining}`}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab icon={<Timeline />} label={translations.batch.progressTitle} />
          <Tab icon={<Assessment />} label={translations.batch.logsTitle} />
          <Tab icon={<Map />} label={translations.batch.mapPreviewTitle} />
          <Tab icon={<TableView />} label={translations.batch.dataTableTitle} />
        </Tabs>
      </Box>

      <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
        {datasetId && <CrossViewSnackbar datasetId={datasetId} />}
        {realProgress?.stage === 'auth-required' && (
          <Alert severity="warning" sx={{ m: 2 }}>
            {formatTemplate(translations.batch.authRequired, {
              message: realProgress?.currentTask || 'Authentication required to continue',
            })}
          </Alert>
        )}
        {/*
 Tab 1:
*/}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Grid container spacing={3}>
              {/*
*/}
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      {translations.batch.processedLabel}
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {stages.reduce((sum, stage) => sum + stage.itemsProcessed, 0).toLocaleString()}
                    </Typography>
                    <Typography color="textSecondary">
                      / {stages.reduce((sum, stage) => sum + stage.totalItems, 0).toLocaleString()} {translations.common.points}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      {translations.batch.throughputLabel}
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {progress.itemsPerSecond.toFixed(1)}
                    </Typography>
                    <Typography color="textSecondary">
                      {formatTemplate(translations.batch.throughputUnit, {
                        rate: formatBytes(progress.bytesPerSecond),
                      })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      {translations.batch.errorsLabel}
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {stages.reduce((sum, stage) => sum + stage.errors, 0)}
                    </Typography>
                    <Typography color="textSecondary">
                      {translations.common.items}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/*
*/}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>
                  {translations.batch.stageListTitle}
                </Typography>
                <Stepper orientation="vertical">
                  {stages.map((stage) => (
                    <Step key={stage.name} active={stage.status === 'running'}>
                      <StepLabel
                        icon={getStageIcon(stage.status)}
                        error={stage.status === 'failed'}
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography>{stage.name}</Typography>
                          {stage.status === 'running' && (
                            <Chip label={`${stage.progress}%`} size="small" color="primary" />
                          )}
                        </Box>
                      </StepLabel>
                      <StepContent>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {stage.itemsProcessed.toLocaleString()} / {stage.totalItems.toLocaleString()} {translations.common.points}
                          </Typography>
                          {stage.status === 'running' && (
                            <LinearProgress
                              variant="determinate"
                              value={stage.progress}
                              sx={{ mt: 1, mb: 1 }}
                            />
                          )}
                          {stage.errors > 0 && (
                            <Typography variant="body2" color="error">
                              {translations.batch.errorsLabel}: {stage.errors} {translations.common.items}
                            </Typography>
                          )}
                        </Box>
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              </Grid>

              {/*
*/}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>
                  {translations.batch.tasksTitle}
                </Typography>
                <List>
                  {activeTasks.map(task => (
                    <ListItem key={task.id} divider>
                      <ListItemIcon>
                        {task.status === 'running' ? (
                          <CircularProgress size={20} />
                        ) : task.status === 'failed' ? (
                          <Error color="error" />
                        ) : (
                          <Warning color="warning" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2">
                              Worker {task.worker}: {task.target}
                            </Typography>
                            <Chip
                              label={task.status}
                              size="small"
                              color={
                                task.status === 'running' ? 'success' :
                                  task.status === 'retrying' ? 'warning' : 'error'
                              }
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <LinearProgress
                              variant="determinate"
                              value={task.progress}
                              sx={{ mb: 0.5 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {task.progress}% | {task.speed} | ETA: {task.eta}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/*
 Tab 2:
*/}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <List>
              {logs.map((log, index) => (
                <ListItem key={index} divider>
                  <ListItemIcon>
                    {log.level === 'error' ? (
                      <Error color="error" />
                    ) : log.level === 'warning' ? (
                      <Warning color="warning" />
                    ) : (
                      <CheckCircle color="success" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={log.message}
                    secondary={`${log.timestamp.toLocaleTimeString()} - ${log.source}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </TabPanel>

        {/*
 Tab 3:
*/}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Alert severity="info">
              {translations.batch.mapPlaceholder}
            </Alert>
          </Box>
        </TabPanel>

        {/*
 Tab 4:
*/}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ flex: 1, minHeight: 360 }}>
            <TabularPreview pluginId="location" tableId={tableId || undefined} />
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {translations.batch.close}
        </Button>
      </DialogActions>

      {/*
*/}
      <SpeedDial
        ariaLabel={translations.batch.ariaLabel}
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        direction="up"
      >
        <SpeedDialAction
          icon={isPaused ? <PlayArrow /> : <Pause />}
          tooltipTitle={isPaused ? translations.batch.resumeTooltip : translations.batch.pauseTooltip}
          onClick={isPaused ? handleResume : handlePause}
        />
        <SpeedDialAction
          icon={<Stop />}
          tooltipTitle={translations.batch.cancelTooltip}
          onClick={handleCancel}
        />
        <SpeedDialAction
          icon={<Download />}
          tooltipTitle={translations.batch.exportTooltip}
          onClick={() => console.log('Export logs')}
        />
      </SpeedDial>
    </Dialog>
  );
};
