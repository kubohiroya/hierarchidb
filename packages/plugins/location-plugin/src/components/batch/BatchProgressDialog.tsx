/**
  * Batch Progress Dialog
   */

import React, { useEffect, useState } from 'react';
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
import { LocationVectorTileService } from '../../services/tiles/LocationVectorTileService.js';
import { CrossViewSnackbar, TabularPreview } from '@hierarchidb/ui-core';
import { getEphemeralLocationDB } from '../../services/database/EphemeralLocationDB.js';
import { useLocationProgress } from '../../hooks/useLocationProgress.js';

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
  const [tabValue, setTabValue] = useState(0);
  const [tableId, setTableId] = useState<string | null>(null);
  const datasetId = React.useMemo(() => (tableId ? `location:${tableId}` : null), [tableId]);
  const vectorTileService = React.useMemo(() => new LocationVectorTileService(), []);
  const { progress: locationProgress } = useLocationProgress(vectorTileService, sessionId, { autoSubscribe: true });
  const showAuthRequired = locationProgress?.stage === 'auth-required';
  const [progress, setProgress] = useState<ProgressInfo>({
    percentage: 0,
    phase: 'download',
    currentTask: '初期化中...',
    timeElapsed: '00:00:00',
    timeRemaining: '計算中...',
    estimatedCompletion: '--:--',
    itemsPerSecond: 0,
    bytesPerSecond: 0,
  });

  const stages: StageInfo[] = [
    { name: 'ダウンロード', status: 'running', progress: 25, itemsProcessed: 123, totalItems: 500, errors: 0 },
    { name: 'フィルタリング', status: 'waiting', progress: 0, itemsProcessed: 0, totalItems: 400, errors: 0 },
    { name: 'クラスタリング', status: 'waiting', progress: 0, itemsProcessed: 0, totalItems: 350, errors: 0 },
    { name: 'インデックス作成', status: 'waiting', progress: 0, itemsProcessed: 0, totalItems: 350, errors: 0 },
  ];

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
    { timestamp: new Date(), level: 'info', source: 'Downloader', message: '日本の空港データダウンロード開始' },
    { timestamp: new Date(), level: 'info', source: 'Downloader', message: '韓国の鉄道駅データダウンロード開始' },
    {
      timestamp: new Date(),
      level: 'warning',
      source: 'Downloader',
      message: '中国の港データでタイムアウト発生、リトライ中',
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
      } catch (error) {
        if (import.meta.env?.DEV) {
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

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
          <Typography variant="h6">バッチ処理進捗</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={progress.phase}
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
              経過時間: {progress.timeElapsed}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              残り時間: {progress.timeRemaining}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab icon={<Timeline />} label="進捗状況" />
          <Tab icon={<Assessment />} label="ログ" />
          <Tab icon={<Map />} label="マッププレビュー" />
          <Tab icon={<TableView />} label="データテーブル" />
        </Tabs>
      </Box>

      <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
        {datasetId && <CrossViewSnackbar datasetId={datasetId} />}
        {showAuthRequired ? (
          <Alert severity="warning" sx={{ m: 2 }}>
            🔐 認証が必要です — {locationProgress?.currentTask || 'Authentication required to continue'}
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
                      処理済み
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {stages.reduce((sum, stage) => sum + stage.itemsProcessed, 0).toLocaleString()}
                    </Typography>
                    <Typography color="textSecondary">
                      / {stages.reduce((sum, stage) => sum + stage.totalItems, 0).toLocaleString()} 地点
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      スループット
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {progress.itemsPerSecond.toFixed(1)}
                    </Typography>
                    <Typography color="textSecondary">
                      地点/秒 ({formatBytes(progress.bytesPerSecond)}/s)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      エラー
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {stages.reduce((sum, stage) => sum + stage.errors, 0)}
                    </Typography>
                    <Typography color="textSecondary">
                      件
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/*
*/}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>
                  処理ステージ
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
                            {stage.itemsProcessed.toLocaleString()} / {stage.totalItems.toLocaleString()} 完了
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
                              エラー: {stage.errors} 件
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
                  アクティブタスク
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
              マッププレビューは後続の実装で追加されます
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
          閉じる
        </Button>
      </DialogActions>

      {/*
*/}
      <SpeedDial
        ariaLabel="バッチ処理操作"
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        direction="up"
      >
        <SpeedDialAction
          icon={isPaused ? <PlayArrow /> : <Pause />}
          tooltipTitle={isPaused ? '再開' : '一時停止'}
          onClick={isPaused ? handleResume : handlePause}
        />
        <SpeedDialAction
          icon={<Stop />}
          tooltipTitle="キャンセル"
          onClick={handleCancel}
        />
        <SpeedDialAction
          icon={<Download />}
          tooltipTitle="ログエクスポート"
          onClick={() => console.log('Export logs')}
        />
      </SpeedDial>
    </Dialog>
  );
};
