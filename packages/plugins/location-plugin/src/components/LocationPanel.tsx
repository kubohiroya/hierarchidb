/**
  * Location Panel Component
   */

import React, { useState } from 'react';
import { Box, Chip, IconButton, List, ListItem, ListItemText, Paper, Tooltip, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { Edit, LocationOn, Refresh } from '@mui/icons-material';
import type { LocationEntity, NodeId } from '../types/index.js';

export interface LocationPanelProps {
  nodeId: NodeId;
  onEdit?: () => void;
}

export const LocationPanel: React.FC<LocationPanelProps> = ({ nodeId, onEdit }) => {
  const [entity] = useState<LocationEntity>({
    id: nodeId,
    nodeId,
    name: 'サンプル地点情報',
    description: 'これはサンプルの地点情報です',
    dataSourceName: 'openstreetmap',
    licenseAgreement: true,
    processingConfig: {
      concurrentDownloads: 2,
      enableLocationFiltering: false,
      enableClustering: false,
      enableGeocoding: false,
    },
    processingStatus: 'idle',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  });

  return (
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
        <Grid container spacing={3}>
          {/* Basic Info */}
          <Grid size={12}>
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
                    secondary={entity?.createdAt ? new Date(entity.createdAt).toLocaleString('ja-JP'):'-'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="更新日時"
                    secondary={entity?.updatedAt ? new Date(entity?.updatedAt).toLocaleString('ja-JP'): '-'}
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>

          {/* Processing Config */}
          <Grid size={12}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                処理設定
              </Typography>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">
                    並行ダウンロード数
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig?.concurrentDownloads}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">
                    フィルタリング
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig?.enableLocationFiltering ? '有効' : '無効'}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">
                    クラスタリング
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig?.enableClustering ? '有効' : '無効'}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">
                    ジオコーディング
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig?.enableGeocoding ? '有効' : '無効'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
