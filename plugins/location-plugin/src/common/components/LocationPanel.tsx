/**
  * Location Panel Component
   */

import type React from 'react';
import { useMemo } from 'react';
import { Chip, Grid, IconButton, List, ListItem, ListItemText, Paper, Tooltip, Typography } from '@mui/material';
import { Edit, LocationOn, Refresh } from '@mui/icons-material';
import type { LocationEntity, NodeId } from '~/common/types/index';
import { useTranslation } from '@hierarchidb/ui-i18n';

export interface LocationPanelProps {
  nodeId: NodeId;
  onEdit?: () => void;
}

export const LocationPanel: React.FC<LocationPanelProps> = ({ nodeId, onEdit }) => {
  const { t } = useTranslation('location-plugin');

  const entity = useMemo<LocationEntity>(() => ({
    id: nodeId,
    nodeId,
    dataSource: 'openstreetmap',
    licenseAgreement: true,
    selectedArrayByCountries: {},
    concurrentDownloads: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  }), [nodeId]);

  return (
    <Grid container direction="column" wrap="nowrap" sx={{ height: '100%' }}>
      <Paper elevation={0} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Grid container columns={{ xs: 12 }} wrap="nowrap" columnSpacing={2} alignItems="center">
          <Grid size={{ xs: 9 }}>
            <Grid container columns={{ xs: 12 }} wrap="nowrap" columnSpacing={1} alignItems="center">
              <Grid size="auto">
                <LocationOn color="primary" />
              </Grid>
              <Grid size="auto">
                <Typography variant="h6" noWrap>{t('panel.sampleName', 'Sample Location Dataset')}</Typography>
              </Grid>
              <Grid size="auto">
                <Chip label="dataset" size="small" />
              </Grid>
            </Grid>
          </Grid>
          <Grid size="auto">
            <Grid container columns={{ xs: 12 }} wrap="nowrap" columnSpacing={1} alignItems="center" justifyContent="flex-end">
              <Grid size="auto">
                <Tooltip title={t('panel.refresh', 'Refresh')}>
                  <IconButton size="small">
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Grid>
              {onEdit && (
                <Grid size="auto">
                  <Tooltip title={t('panel.edit', 'Edit')}>
                    <IconButton size="small" onClick={onEdit}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                </Grid>
              )}
            </Grid>
          </Grid>
        </Grid>
      </Paper>

      <Grid container direction="column" wrap="nowrap" sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Grid container spacing={3} columns={{ xs: 12 }}>
          <Grid size={{ xs: 12 }}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {t('panel.basicInfo', 'Basic Information')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={t('panel.dataSource', 'Data source')}
                    secondary={entity.dataSource}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('panel.licenseAgreement', 'License agreement')}
                    secondary={entity.licenseAgreement
                      ? t('panel.licenseAgreed', 'Agreed')
                      : t('panel.licensePending', 'Pending')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('panel.createdAt', 'Created at')}
                    secondary="-"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('panel.updatedAt', 'Updated at')}
                    secondary="-"
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {t('panel.processingSettings', 'Settings')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={t('panel.concurrentDownloads', 'Concurrent downloads')}
                    secondary={entity.concurrentDownloads}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Selection entries"
                    secondary={Object.values(entity.selectedArrayByCountries ?? {})
                      .flat()
                      .filter(Boolean)
                      .length}
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
