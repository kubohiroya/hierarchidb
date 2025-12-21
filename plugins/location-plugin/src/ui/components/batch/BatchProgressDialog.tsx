/**
  * Batch Progress Dialog
   */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { NodeId } from '../../../common/types/index.js';
import { useLocationProgress } from '../../../common/hooks/useLocationProgress.js';
import { isDevEnvironment } from '../../../common/utils/env.js';
import { useTranslation, formatBytes as formatBytesIntl, formatNumber } from '../../../common/i18n/index.js';
import { getEphemeralLocationDB } from '../../../services/index.js';
import { CrossViewSnackbar, DataGridPreview } from '@hierarchidb/ui-grid';

interface ProgressInfo {
  percentage: number;
  phase: string;
  phaseLabel: string;
  currentTask: string;
  timeElapsed: string;
  timeRemaining: string;
  estimatedCompletion: string;
  itemsPerSecond: number;
  bytesPerSecond: number;
  completed: number;
  total: number;
  failed: number;
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

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

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

interface ThroughputMeta {
  itemsPerSecond?: number;
  bytesPerSecond?: number;
}

const extractThroughputMeta = (meta: unknown): ThroughputMeta => {
  if (!isRecord(meta)) return {};
  const itemsPerSecond = typeof (meta as Record<string, unknown>).itemsPerSecond === 'number'
    ? (meta as Record<string, number>).itemsPerSecond
    : undefined;
  const bytesPerSecond = typeof (meta as Record<string, unknown>).bytesPerSecond === 'number'
    ? (meta as Record<string, number>).bytesPerSecond
    : undefined;
  return { itemsPerSecond, bytesPerSecond };
};

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
  const [tabValue, setTabValue] = useState(0);
  const [tableId, setTableId] = useState<string | null>(null);
  const datasetId = React.useMemo(() => (tableId ? `location:${tableId}` : null), [tableId]);
  const { translations, locale } = useTranslation();
  const {
    progress: locationProgress,
    unifiedProgress,
  } = useLocationProgress(sessionId, { autoSubscribe: true });
  const showAuthRequired = locationProgress?.stage === 'auth-required';
  const phaseLabel = useCallback((phase: string) => {
    const phases = translations.batch?.phases;
    if (isRecord(phases)) {
      const record = phases as Record<string, unknown>;
      const label = record[phase];
      if (typeof label === 'string') return label;
    }
    return phase;
  }, [translations.batch?.phases]);

  const derivedProgress: ProgressInfo = useMemo(() => {
    const payload = unifiedProgress?.payload;
    const total = typeof payload?.total === 'number' ? payload.total : locationProgress?.total ?? 0;
    const completed = typeof payload?.completed === 'number' ? payload.completed : locationProgress?.completed ?? 0;
    const failed = typeof payload?.failed === 'number' ? payload.failed : locationProgress?.failed ?? 0;
    const percentageRaw = unifiedProgress?.percentage ?? locationProgress?.percentage ?? 0;
    const phase = (unifiedProgress?.phase ?? locationProgress?.stage ?? 'running').toLowerCase();
    const phaseText = phaseLabel(phase);
    const currentTask = unifiedProgress?.currentTask
      ?? payload?.currentTask
      ?? locationProgress?.currentTask
      ?? phaseText;
    const { itemsPerSecond = 0, bytesPerSecond = 0 } = extractThroughputMeta(payload?.meta);

    return {
      percentage: Math.max(0, Math.min(100, Math.round(percentageRaw))),
      phase,
      phaseLabel: phaseText,
      currentTask,
      timeElapsed: '--:--:--',
      timeRemaining: '--:--:--',
      estimatedCompletion: '--:--',
      itemsPerSecond,
      bytesPerSecond,
      completed,
      total,
      failed,
    } satisfies ProgressInfo;
  }, [unifiedProgress, locationProgress, phaseLabel]);

  const stageDefinitions = useMemo(() => ([
    { id: 'download', label: translations.batch?.stages?.download ?? 'Download' },
    { id: 'filter', label: translations.batch?.stages?.filtering ?? 'Filtering' },
    { id: 'cluster', label: translations.batch?.stages?.clustering ?? 'Clustering' },
    { id: 'index', label: translations.batch?.stages?.indexing ?? 'Indexing' },
  ]), [translations.batch?.stages]);

  const stages: StageInfo[] = useMemo(() => {
    const normalizedStage = (unifiedProgress?.stage ?? locationProgress?.stage ?? '').toLowerCase();
    const currentIndex = stageDefinitions.findIndex((stage) => normalizedStage.includes(stage.id));
    return stageDefinitions.map((stage, index) => {
      let status: StageInfo['status'];
      if (currentIndex === -1) {
        status = index === 0 ? 'running' : 'waiting';
      } else if (index < currentIndex) {
        status = 'completed';
      } else if (index === currentIndex) {
        status = derivedProgress.phase === 'failed' ? 'failed' : 'running';
      } else {
        status = 'waiting';
      }

      const stageProgress = index < currentIndex
        ? 100
        : index === currentIndex
          ? derivedProgress.percentage
          : 0;

      return {
        name: stage.label,
        status,
        progress: stageProgress,
        itemsProcessed: derivedProgress.completed,
        totalItems: derivedProgress.total,
        errors: index === currentIndex ? derivedProgress.failed : 0,
      } satisfies StageInfo;
    });
  }, [stageDefinitions, unifiedProgress, locationProgress, derivedProgress]);

  const activeTasks = useMemo<ActiveTask[]>(() => [], []);

  const logs: LogEntry[] = useMemo(() => {
    if (!locationProgress?.currentTask && !locationProgress?.message) {
      return [];
    }

    return [{
      timestamp: new Date(locationProgress?.timestamp ?? Date.now()),
      level: 'info',
      source: 'BatchWorker',
      message: locationProgress?.currentTask ?? locationProgress?.message ?? translations.batch?.logsDefault ?? 'Running',
    }];
  }, [locationProgress?.currentTask, locationProgress?.message, locationProgress?.timestamp, translations.batch?.logsDefault]);

  const [isPaused, setIsPaused] = useState(false);

  const formatTemplate = useCallback(
    (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`)),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getEphemeralLocationDB();
        const session = (await db.sessions?.get(sessionId)) ?? null;
        if (!cancelled) setTableId(session?.tableId ?? null);
      } catch (error) {
        if (isDevEnvironment) {
          console.warn('[BatchProgressDialog] failed to load session metadata', error);
        }
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
          <Typography variant="h6">{translations.batch?.dialogTitle ?? 'Batch Processing Progress'}</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip label={derivedProgress.phaseLabel} color="primary" size="small" />
            <IconButton size="small" onClick={onClose} aria-label={translations.common?.close ?? 'Close'}>
              <Close />
            </IconButton>
          </Box>
        </Box>

        <Box mt={2}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">{derivedProgress.currentTask}</Typography>
            <Typography variant="body2">{derivedProgress.percentage}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={derivedProgress.percentage}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Box display="flex" justifyContent="space-between" mt={1}>
            <Typography variant="caption" color="text.secondary">
              {translations.batch?.elapsed ?? 'Elapsed'}: {derivedProgress.timeElapsed}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {translations.batch?.remaining ?? 'Remaining'}: {derivedProgress.timeRemaining}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab icon={<Timeline />} label={translations.batch?.progressTitle ?? 'Progress'} />
          <Tab icon={<Assessment />} label={translations.batch?.logsTitle ?? 'Logs'} />
          <Tab icon={<Map />} label={translations.batch?.mapPreviewTitle ?? 'Map Preview'} />
          <Tab icon={<TableView />} label={translations.batch?.dataTableTitle ?? 'Data Table'} />
        </Tabs>
      </Box>

      <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
        {datasetId && <CrossViewSnackbar datasetId={datasetId} />}
        {showAuthRequired ? (
          <Alert severity="warning" sx={{ m: 2 }}>
            {`🔐 ${formatTemplate(translations.batch?.authRequired ?? 'Authentication required — {message}', {
              message: locationProgress?.currentTask ?? translations.batch?.authFallback ?? 'Authentication required to continue',
            })}`}
          </Alert>
        ) : null}
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
                      {translations.batch?.processedLabel ?? 'Processed'}
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {formatNumber(derivedProgress.completed, locale)}
                    </Typography>
                    <Typography color="textSecondary">
                      {formatTemplate(translations.batch?.processedTotal ?? '/ {total} items', {
                        total: formatNumber(derivedProgress.total, locale),
                      })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      {translations.batch?.throughputLabel ?? 'Throughput'}
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {derivedProgress.itemsPerSecond.toFixed(1)}
                    </Typography>
                    <Typography color="textSecondary">
                      {formatTemplate(translations.batch?.throughputUnit ?? 'points/s ({rate}/s)', {
                        rate: formatBytesIntl(derivedProgress.bytesPerSecond, locale),
                      })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      {translations.batch?.errorsLabel ?? 'Errors'}
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {formatNumber(derivedProgress.failed, locale)}
                    </Typography>
                    <Typography color="textSecondary">
                      {translations.batch?.errorsUnit ?? 'items'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/*
*/}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>
                  {translations.batch?.stageListTitle ?? 'Processing Stages'}
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
                            {formatTemplate(translations.batch?.stageProgress ?? '{completed} / {total} completed', {
                              completed: formatNumber(stage.itemsProcessed, locale),
                              total: formatNumber(stage.totalItems, locale),
                            })}
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
                              {formatTemplate(translations.batch?.stageErrors ?? 'Errors: {count}', {
                                count: formatNumber(stage.errors, locale),
                              })}
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
                  {translations.batch?.tasksTitle ?? 'Active Tasks'}
                </Typography>
                <List>
                  {activeTasks.length === 0 ? (
                    <ListItem>
                      <ListItemText
                        primary={translations.batch?.tasksEmpty ?? 'No active tasks at the moment'}
                        secondary={translations.batch?.tasksEmptyHint ?? 'Tasks will appear here while the batch is running'}
                      />
                    </ListItem>
                  ) : activeTasks.map(task => (
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
              {logs.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary={translations.batch?.logsEmpty ?? 'No log entries yet'}
                  />
                </ListItem>
              ) : logs.map((log, index) => (
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
                    secondary={`${log.timestamp.toLocaleTimeString(locale === 'ja' ? 'ja-JP' : 'en-US')} - ${log.source}`}
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
              {translations.batch?.mapPlaceholder ?? 'Map preview will be added in a future implementation'}
            </Alert>
          </Box>
        </TabPanel>

        {/*
 Tab 4:
*/}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ flex: 1, minHeight: 360 }}>
            <DataGridPreview pluginId="location" tableId={tableId || undefined} />
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {translations.batch?.close ?? 'Close'}
        </Button>
      </DialogActions>

      {/*
*/}
      <SpeedDial
        ariaLabel={translations.batch?.ariaLabel ?? 'Batch processing actions'}
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        direction="up"
      >
        <SpeedDialAction
          icon={isPaused ? <PlayArrow /> : <Pause />}
          tooltipTitle={isPaused
            ? translations.batch?.resumeTooltip ?? 'Resume'
            : translations.batch?.pauseTooltip ?? 'Pause'}
          onClick={isPaused ? handleResume : handlePause}
        />
        <SpeedDialAction
          icon={<Stop />}
          tooltipTitle={translations.batch?.cancelTooltip ?? 'Cancel'}
          onClick={handleCancel}
        />
        <SpeedDialAction
          icon={<Download />}
          tooltipTitle={translations.batch?.exportTooltip ?? 'Export logs'}
          onClick={() => console.log('Export logs')}
        />
      </SpeedDial>
    </Dialog>
  );
};
