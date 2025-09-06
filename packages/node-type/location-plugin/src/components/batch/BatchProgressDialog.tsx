/**
 * Batch Progress Dialog
 * バッチ処理進捗確認ダイアログ
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Tabs,
  Tab,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Card,
  CardContent,
  Grid2,
  Alert,
  IconButton,
  CircularProgress,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Slider,
  TextField,
} from '@mui/material';
import {
  Close,
  Pause,
  PlayArrow,
  Stop,
  Download,
  CheckCircle,
  Error,
  Warning,
  HourglassEmpty,
  Timeline,
  Map,
  TableView,
  Assessment,

} from '@mui/icons-material';
import type { NodeId } from '../../types';
import { useLocationProgress } from '../../hooks/useLocationProgress';
import { LocationVectorTileService } from '../../services/tiles/LocationVectorTileService';
import { MapWithVectorTiles } from '@hierarchidb/ui-map';

// 進捗情報の型定義
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
  service?: LocationVectorTileService;
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
  nodeId,
  sessionId,
  service: providedService,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const service = useMemo(() => providedService ?? new LocationVectorTileService(), [providedService]);
  const { progress } = useLocationProgress(service, open ? sessionId : null);
  const initial = useMemo(() => service.getInitialSummary(sessionId), [service, sessionId]);
  const [computedBbox, setComputedBbox] = useState<[number, number, number, number] | null>(null);
  const [zoomSummary, setZoomSummary] = useState<Array<{ z: number; tiles: number }>>([]);

  // Map layer styling controls
  const [styleMode, setStyleMode] = useState<'auto' | 'simple'>('auto');
  const [radiusScale, setRadiusScale] = useState(1);
  const [layerMinZoom, setLayerMinZoom] = useState<number | undefined>(undefined);
  const [layerMaxZoom, setLayerMaxZoom] = useState<number | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const mapRef = useRef<any | null>(null);

  // Derive UI progress from service progress
  const uiProgress: ProgressInfo = {
    percentage: Math.min(100, Math.max(0, progress?.percentage ?? 0)),
    phase: ((): ProgressInfo['phase'] => {
      switch (progress?.stage) {
        case 'import': return 'download';
        case 'normalize': return 'filter';
        case 'tilegen': return 'index';
        case 'completed': return 'complete';
        default: return 'download';
      }
    })(),
    currentTask: progress?.currentTask ?? '初期化中...',
    timeElapsed: '—',
    timeRemaining: '—',
    estimatedCompletion: '—',
    itemsPerSecond: 0,
    bytesPerSecond: 0,
  };
  
  const stages: StageInfo[] = [
    { name: 'インポート', status: progress?.stage === 'import' ? 'running' : 'waiting', progress: progress?.stage === 'import' ? Math.round(uiProgress.percentage) : 0, itemsProcessed: progress?.completed ?? 0, totalItems: progress?.total ?? 0, errors: progress?.failed ?? 0 },
    { name: '正規化', status: progress?.stage === 'normalize' ? 'running' : 'waiting', progress: progress?.stage === 'normalize' ? Math.round(uiProgress.percentage) : 0, itemsProcessed: progress?.completed ?? 0, totalItems: progress?.total ?? 0, errors: progress?.failed ?? 0 },
    { name: 'タイル生成', status: progress?.stage === 'tilegen' ? 'running' : 'waiting', progress: progress?.stage === 'tilegen' ? Math.round(uiProgress.percentage) : 0, itemsProcessed: progress?.completed ?? 0, totalItems: progress?.total ?? 0, errors: progress?.failed ?? 0 },
    { name: '完了', status: progress?.stage === 'completed' ? 'completed' : 'waiting', progress: progress?.stage === 'completed' ? 100 : 0, itemsProcessed: progress?.completed ?? 0, totalItems: progress?.total ?? 0, errors: progress?.failed ?? 0 }
  ];
  
  const activeTasks: ActiveTask[] = [];
  
  const logs: LogEntry[] = [];

  // Fetch computed summary (bbox + per-zoom tile counts)
  const refreshSummaries = useCallback(async (): Promise<void> => {
    const s = await service.getSessionSummary(sessionId);
    if (s.exists && s.bbox) setComputedBbox(s.bbox);
    const coords = await service.listTileCoords(sessionId);
    const counts: Record<number, number> = {} as Record<number, number>;
    for (const c of coords) counts[c.z] = (counts[c.z] ?? 0) + 1;
    const rows: Array<{ z: number; tiles: number }> = Object.entries(counts)
      .map(([z, n]) => ({ z: Number(z), tiles: n as number }))
      .sort((a, b) => a.z - b.z);
    setZoomSummary(rows);
  }, [service, sessionId]);

  useEffect(() => {
    if (!open) return;
    refreshSummaries().catch(()=>{});
  }, [open, refreshSummaries, reloadToken, progress?.stage]);

  // Auto-refresh tiles until completed
  useEffect(() => {
    if (!open) return;
    if (progress?.stage === 'completed') return;
    const id = setInterval(() => setReloadToken(t => t + 1), 2500);
    return () => clearInterval(id);
  }, [open, progress?.stage]);
  
  const [isPaused, setIsPaused] = useState(false);

  
  // real-time progress is provided via useLocationProgress
  
  // No time estimation in this minimal wiring
  
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handlePause = () => {
    setIsPaused(true);
    try { (service as any).manager?.pause?.(sessionId); } catch {}
  };
  
  const handleResume = () => {
    setIsPaused(false);
    try { (service as any).manager?.resume?.(sessionId); } catch {}
  };
  
  const handleCancel = () => {
    try { (service as any).manager?.cancel?.(sessionId); } catch {}
  };
  
  const getStageIcon = (status: StageInfo['status']) => {
    switch (status) {
      case 'waiting': return <HourglassEmpty color="disabled" />;
      case 'running': return <CircularProgress size={20} />;
      case 'completed': return <CheckCircle color="success" />;
      case 'failed': return <Error color="error" />;
    }
  };
  
  // No throughput display in minimal wiring
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', display: 'flex', flexDirection: 'column' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">バッチ処理進捗</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip 
              label={uiProgress.phase} 
              color="primary" 
              size="small"
            />
            <IconButton size="small" onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </Box>
        
        {/* 全体進捗バー */}
        <Box mt={2}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">{uiProgress.currentTask}</Typography>
            <Typography variant="body2">{Math.round(uiProgress.percentage)}%</Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={uiProgress.percentage}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Box display="flex" justifyContent="space-between" mt={1}>
            <Typography variant="caption" color="text.secondary">
              経過時間: {uiProgress.timeElapsed}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              残り時間: {uiProgress.timeRemaining}
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
        {/* Tab 1: 進捗状況 */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Grid2 container spacing={3}>
              {/* 統計カード */}
              <Grid2 size={{ xs: 12, md: 4 }}>
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
              </Grid2>
              
              <Grid2 size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      スループット
                    </Typography>
                    <Typography variant="h4" color="success.main">—</Typography>
                    <Typography color="textSecondary">地点/秒</Typography>
                  </CardContent>
                </Card>
              </Grid2>
              
              <Grid2 size={{ xs: 12, md: 4 }}>
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
              </Grid2>
              
              {/* ステージ進捗 */}
              <Grid2 size={{ xs: 12, md: 6 }}>
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
              </Grid2>
              
              {/* アクティブタスク */}
              <Grid2 size={{ xs: 12, md: 6 }}>
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
              </Grid2>
            </Grid2>
          </Box>
        </TabPanel>
        
        {/* Tab 2: ログ */}
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
        
        {/* Tab 3: マッププレビュー */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ flex: 1, minHeight: 360, p: 2, display: 'flex', gap: 2 }}>
            <Box sx={{ width: 300, flexShrink: 0 }}>
              <Typography variant="subtitle2" gutterBottom>表示設定</Typography>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">スタイルモード</Typography>
                <Box display="flex" gap={1} mt={1}>
                  <Button size="small" variant={styleMode==='auto'?'contained':'outlined'} onClick={() => setStyleMode('auto')}>Auto</Button>
                  <Button size="small" variant={styleMode==='simple'?'contained':'outlined'} onClick={() => setStyleMode('simple')}>Simple</Button>
                </Box>
              </Box>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">半径スケール</Typography>
                <Slider size="small" min={0.5} max={3} step={0.1} value={radiusScale} onChange={(_,v)=>setRadiusScale(v as number)} />
              </Box>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">ズーム範囲</Typography>
                <Box display="flex" gap={1} alignItems="center">
                  <TextField size="small" label="min" type="number" value={layerMinZoom ?? ''} onChange={e=>setLayerMinZoom(e.target.value===''?undefined:Number(e.target.value))} sx={{ width: 90 }} />
                  <TextField size="small" label="max" type="number" value={layerMaxZoom ?? ''} onChange={e=>setLayerMaxZoom(e.target.value===''?undefined:Number(e.target.value))} sx={{ width: 90 }} />
                </Box>
                {initial?.zoomMin !== undefined && (
                  <Typography variant="caption" color="text.secondary">生成範囲: z{initial.zoomMin}–{initial.zoomMax}</Typography>
                )}
              </Box>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">タイル取得</Typography>
                <Box display="flex" gap={1} mt={1}>
                  <Button size="small" onClick={() => setReloadToken(t=>t+1)}>Refresh tiles</Button>
                  <Chip size="small" label={`fail ${failedCount}`} color={failedCount>0?'warning':'default'} />
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">サマリ</Typography>
                <Typography variant="body2">ポイント数: {initial?.totalPoints ?? '—'}</Typography>
                <Typography variant="body2">bbox: {initial ? `${initial.bbox.map(v=>v.toFixed(3)).join(', ')}` : '—'}</Typography>
                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">ズーム別タイル数</Typography>
                  <List dense sx={{ maxHeight: 120, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    {zoomSummary.length === 0 && <ListItem><ListItemText primary="(生成中 or なし)" /></ListItem>}
                    {zoomSummary.map(row => (
                      <ListItem key={row.z}>
                        <ListItemText primary={`z${row.z}`} secondary={`${row.tiles} tiles`} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Box>
            </Box>
            <MapWithVectorTiles
              initialViewState={{ longitude: 0, latitude: 0, zoom: 2 }}
              height={420}
              dbName={'ephemeral-location-db'}
              nodeId={String(nodeId)}
              // layer settings for point layer
              layerConfig={{
                layerId: `loc-mvt-layer-${reloadToken}`,
                sourceId: `loc-mvt-source-${reloadToken}`,
                layerType: 'circle',
                sourceLayer: 'location_points',
                paint: {
                  'circle-radius': (() => {
                    if (styleMode==='simple') return 4 * radiusScale;
                    const pts = initial?.totalPoints ?? 1;
                    const [minLon,minLat,maxLon,maxLat] = initial?.bbox ?? [-180,-90,180,90];
                    const area = Math.max(1e-6, (maxLon-minLon)*(maxLat-minLat));
                    const density = Math.min(5, pts/area); // very rough density proxy
                    return Math.max(2, Math.min(12, density * 0.8 * radiusScale));
                  })(),
                  'circle-opacity': styleMode==='simple' ? 0.9 : 0.6,
                  'circle-color': '#1976d2',
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 1,
                },
                minzoom: layerMinZoom,
                maxzoom: layerMaxZoom,
              }}
              onLoad={(m) => {
                mapRef.current = m;
                const bbox = computedBbox ?? initial?.bbox ?? null;
                if (bbox) try {
                  m.fitBounds([[bbox[0], bbox[1]],[bbox[2], bbox[3]]], { padding: 24 });
                } catch {}
              }}
              tileDataProvider={async (z: number, x: number, y: number) => {
                const bytes = await service.getVectorTile(sessionId, nodeId as any, z, x, y);
                const ok = !!bytes && (bytes as Uint8Array).byteLength > 0;
                if (!ok) setFailedCount(c=>c+1);
                return ok ? (bytes as Uint8Array).buffer : null;
              }}
            />
          </Box>
        </TabPanel>
        
        {/* Tab 4: データテーブル */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Alert severity="info">
              データテーブルは後続の実装で追加されます
            </Alert>
          </Box>
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          閉じる
        </Button>
      </DialogActions>
      
      {/* フローティングアクションボタン */}
      <SpeedDial
        ariaLabel="バッチ処理操作"
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        direction="up"
      >
        <SpeedDialAction
          icon={isPaused ? <PlayArrow /> : <Pause />}
          tooltipTitle={isPaused ? "再開" : "一時停止"}
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
