/**
  * Location Panel Component
   */

import type React from 'react';
import { useMemo } from 'react';
import { Box, Chip, IconButton, List, ListItem, ListItemText, Paper, Tooltip, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { Edit, LocationOn, Refresh } from '@mui/icons-material';
import type { LocationEntity, NodeId } from '../types/index.js';
import { useTranslation } from '../i18n/index.js';

export interface LocationPanelProps {
  nodeId: NodeId;
  onEdit?: () => void;
}

export const LocationPanel: React.FC<LocationPanelProps> = ({ nodeId, onEdit }) => {
  const { translations, locale } = useTranslation();

  const entity = useMemo<LocationEntity>(() => ({
    id: nodeId,
    nodeId,
    name: translations.panel.sampleName,
    description: translations.panel.sampleDescription,
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
  }), [nodeId, translations]);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    const formatterLocale = locale === 'ja' ? 'ja-JP' : 'en-US';
    return new Date(timestamp).toLocaleString(formatterLocale);
  };

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
            <Tooltip title={translations.panel.refresh}>
              <IconButton size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
            {onEdit && (
              <Tooltip title={translations.panel.edit}>
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
          <Grid size={{ xs: 12 }}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {translations.panel.basicInfo}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={translations.panel.dataSource}
                    secondary={entity.dataSourceName}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={translations.panel.licenseAgreement}
                    secondary={entity.licenseAgreement
                      ? translations.panel.licenseAgreed
                      : translations.panel.licensePending}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={translations.panel.createdAt}
                    secondary={formatDate(entity.createdAt)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={translations.panel.updatedAt}
                    secondary={formatDate(entity.updatedAt)}
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>

          {/* Processing Config */}
          <Grid size={{ xs: 12 }}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {translations.panel.processingSettings}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {translations.panel.concurrentDownloads}
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig?.concurrentDownloads}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {translations.panel.filtering}
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig?.enableLocationFiltering
                      ? translations.common.enabled
                      : translations.common.disabled}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {translations.panel.clustering}
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig?.enableClustering
                      ? translations.common.enabled
                      : translations.common.disabled}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {translations.panel.geocoding}
                  </Typography>
                  <Typography variant="body1">
                    {entity.processingConfig?.enableGeocoding
                      ? translations.common.enabled
                      : translations.common.disabled}
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
