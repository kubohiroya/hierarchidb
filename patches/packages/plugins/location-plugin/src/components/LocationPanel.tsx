/**
  * Location Panel Component
   */

import type React from 'react';
import { useMemo } from 'react';
import { Chip, Grid, IconButton, List, ListItem, ListItemText, Paper, Tooltip, Typography } from '@mui/material';
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
    dataSource: 'openstreetmap',
    licenseAgreement: true,
    selectionMatrix: [],
    concurrentDownloads: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  }), [nodeId]);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    const formatterLocale = locale === 'ja' ? 'ja-JP' : 'en-US';
    return new Date(timestamp).toLocaleString(formatterLocale);
  };

  return (
    <Grid container direction="column" wrap="nowrap" sx={{ height: '100%' }}>
      <Paper elevation={0} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Grid container wrap="nowrap" columnSpacing={2} alignItems="center">
          <Grid container wrap="nowrap" columnSpacing={1} alignItems="center" xs>
            <Grid>
              <LocationOn color="primary" />
            </Grid>
            <Grid>
              <Typography variant="h6" noWrap>{translations.panel.sampleName}</Typography>
            </Grid>
            <Grid>
              <Chip label="dataset" size="small" />
            </Grid>
          </Grid>
          <Grid container wrap="nowrap" columnSpacing={1} alignItems="center" justifyContent="flex-end" xs="auto">
            <Grid>
              <Tooltip title={translations.panel.refresh}>
                <IconButton size="small">
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Grid>
            {onEdit && (
              <Grid>
                <Tooltip title={translations.panel.edit}>
                  <IconButton size="small" onClick={onEdit}>
                    <Edit />
                  </IconButton>
                </Tooltip>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Paper>

      <Grid container direction="column" wrap="nowrap" sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Grid container spacing={3}>
          <Grid xs={12}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {translations.panel.basicInfo}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={translations.panel.dataSource}
                    secondary={entity.dataSource}
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

          <Grid xs={12}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {translations.panel.processingSettings}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={translations.panel.concurrentDownloads}
                    secondary={entity.concurrentDownloads}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Selection entries"
                    secondary={entity.selectionMatrix.flat().filter(Boolean).length}
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
};
