/**
 * @file Step4Preview.tsx
 * @description Preview step for BaseMap creation
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Map as MapIcon,
  LocationOn,
  ZoomIn,
  Explore,
  ThreeDRotation,
  Settings,
} from '@mui/icons-material';
import BaseMapView from '../BaseMapView';
import type { NodeId, EntityId } from '@hierarchidb/common-core';
import type { BaseMapEntity } from '../../types';

export interface Step4PreviewProps {
  name: string;
  description?: string;
  mapStyle: BaseMapEntity['mapStyle'];
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  displayOptions?: BaseMapEntity['displayOptions'];
  styleUrl?: string;
  apiKey?: string;
}

export const Step4Preview: React.FC<Step4PreviewProps> = ({
  name,
  description,
  mapStyle,
  center,
  zoom,
  bearing,
  pitch,
  displayOptions,
  styleUrl,
  apiKey,
}) => {
  const formatCoordinate = (coord: number, type: 'lat' | 'lng') => {
    const abs = Math.abs(coord);
    const direction = type === 'lat' 
      ? (coord >= 0 ? 'N' : 'S')
      : (coord >= 0 ? 'E' : 'W');
    return `${abs.toFixed(6)}° ${direction}`;
  };

  const getStyleDisplayName = (style: BaseMapEntity['mapStyle']) => {
    const names = {
      streets: 'Streets',
      satellite: 'Satellite',
      hybrid: 'Hybrid',
      terrain: 'Terrain',
      custom: 'Custom Style',
    };
    return names[style];
  };

  const enabledOptions = Object.entries(displayOptions || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => {
      const labels = {
        show3dBuildings: '3D Buildings',
        showTraffic: 'Traffic',
        showTransit: 'Transit',
        showTerrain: 'Terrain',
        showLabels: 'Labels',
      };
      return labels[key as keyof typeof labels] || key;
    });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Preview Configuration
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review your base map configuration before creating.
      </Typography>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MapIcon color="primary" />
              Basic Information
            </Typography>
            <Typography variant="h6" gutterBottom>{name}</Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Map Style */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Settings color="primary" />
              Map Style
            </Typography>
            <Typography variant="body1" gutterBottom>
              {getStyleDisplayName(mapStyle)}
            </Typography>
            {mapStyle === 'custom' && styleUrl && (
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                URL: {styleUrl}
              </Typography>
            )}
            {apiKey && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                API Key: {'•'.repeat(20)}
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* View Settings */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOn color="primary" />
              View Settings
            </Typography>
            <List dense>
              <ListItem disablePadding>
                <ListItemIcon><LocationOn fontSize="small" /></ListItemIcon>
                <ListItemText 
                  primary="Center" 
                  secondary={`${formatCoordinate(center[1], 'lat')}, ${formatCoordinate(center[0], 'lng')}`}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon><ZoomIn fontSize="small" /></ListItemIcon>
                <ListItemText primary="Zoom" secondary={zoom.toFixed(1)} />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon><Explore fontSize="small" /></ListItemIcon>
                <ListItemText primary="Bearing" secondary={`${bearing}°`} />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon><ThreeDRotation fontSize="small" /></ListItemIcon>
                <ListItemText primary="Pitch" secondary={`${pitch}°`} />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Display Options */}
        {enabledOptions.length > 0 && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Display Options
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {enabledOptions.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Interactive Map Preview */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Map Preview
            </Typography>
            <Box sx={{ height: 300, borderRadius: 1, overflow: 'hidden' }}>
              <BaseMapView
                nodeId={'preview' as NodeId}
                entity={{
                  id: 'preview' as EntityId,
                  nodeId: 'preview' as NodeId,
                  name,
                  description,
                  mapStyle,
                  center,
                  zoom,
                  bearing,
                  pitch,
                  displayOptions,
                  styleUrl,
                  apiKey,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  version: 1,
                }}
                height={300}
                interactive={true}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};