/**
 * Location Panel Component
 * 地点情報ノードの詳細表示パネル
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Grid2,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  LocationOn,
  Edit,
  Refresh,
  Map as MapIcon
} from '@mui/icons-material';
import type { NodeId } from '../types';
import type { LocationEntity } from '../types';
import { LocationVectorTileService } from '../services/tiles/LocationVectorTileService';
import type { LocationPointInput, LocationTileSettings } from '../services/tiles/LocationVectorTileService';
import { BatchProgressDialog } from './batch/BatchProgressDialog';

export interface LocationPanelProps {
  nodeId: NodeId;
  onEdit?: () => void;
}

export const LocationPanel: React.FC<LocationPanelProps> = ({ nodeId, onEdit }) => {
  const batchEnabled = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LOCATION_BATCH_V1 === '1') ||
                       (typeof process !== 'undefined' && (process as any).env?.LOCATION_BATCH_V1 === '1');
  const [entity] = useState<LocationEntity>({
    id: nodeId as any,
    nodeId,
    name: 'サンプル地点情報',
    description: 'これはサンプルの地点情報です',
    dataSourceName: 'openstreetmap',
    licenseAgreement: true,
    processingConfig: {
      concurrentDownloads: 2,
      enableLocationFiltering: false,
      enableClustering: false,
      enableGeocoding: false
    },
    processingStatus: 'idle',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
  });

  // Batch session wiring (demo fast-path)
  const [progressOpen, setProgressOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const service = useMemo(() => new LocationVectorTileService(), []);

  const handleStartBatch = async () => {
    const points: LocationPointInput[] = [
      { lon: 139.767, lat: 35.681 },
      { lon: 139.700, lat: 35.689 },
      { lon: 139.730, lat: 35.710 },
    ];
    const settings: LocationTileSettings = { zoomMinGenerate: 5, zoomMaxGenerate: 6 };
    const { sessionId } = await service.startSession(nodeId, points, settings);
    setSessionId(sessionId);
    setProgressOpen(true);
  };

  return (
    <>
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <LocationOn color="primary" />
            <Typography variant="h6">{entity.name}</Typography>
            <Chip
              label={entity.processingStatus || 'idle'}
              size="small"
              color={
                entity.processingStatus === 'completed' ? 'success' :
                entity.processingStatus === 'processing' ? 'primary' :
                entity.processingStatus === 'failed' ? 'error' : 'default'
              }
            />
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="更新">
              <IconButton size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
            {batchEnabled && (
              <Tooltip title="ポイント→MVT バッチ（デモ）">
                <IconButton size="small" color="primary" onClick={handleStartBatch}>
                  <MapIcon />
                </IconButton>
              </Tooltip>
            )}
            {onEdit && (
              <Tooltip title="編集">
                <IconButton size="small" onClick={onEdit}>
                  <Edit />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        
        {entity.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {entity.description}
          </Typography>
        )}
      </Paper>
      
      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Grid2 container spacing={3}>
          {/* Basic Info */}
          <Grid2 size={12}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                基本情報
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="データソース"
                    secondary={entity.dataSourceName}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="ライセンス同意"
                    secondary={entity.licenseAgreement ? '同意済み' : '未同意'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="作成日時"
                    secondary={new Date(entity.createdAt).toLocaleString('ja-JP')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="更新日時"
                    secondary={new Date(entity.updatedAt).toLocaleString('ja-JP')}
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid2>
          
          {/* Processing Config */}
          <Grid2 size={12}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                処理設定
              </Typography>
              <Grid2 container spacing={2}>
                <Grid2 size={6}>
                  <Typography variant="body2" color="text.secondary">
                    並行ダウンロード数
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig.concurrentDownloads}
                  </Typography>
                </Grid2>
                <Grid2 size={6}>
                  <Typography variant="body2" color="text.secondary">
                    フィルタリング
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig.enableLocationFiltering ? '有効' : '無効'}
                  </Typography>
                </Grid2>
                <Grid2 size={6}>
                  <Typography variant="body2" color="text.secondary">
                    クラスタリング
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig.enableClustering ? '有効' : '無効'}
                  </Typography>
                </Grid2>
                <Grid2 size={6}>
                  <Typography variant="body2" color="text.secondary">
                    ジオコーディング
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig.enableGeocoding ? '有効' : '無効'}
                  </Typography>
                </Grid2>
              </Grid2>
            </Paper>
          </Grid2>
        </Grid2>
      </Box>
    </Box>
    {progressOpen && sessionId && (
      <BatchProgressDialog
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        nodeId={nodeId}
        sessionId={sessionId}
        service={service}
      />
    )}
    </>
  );
};
