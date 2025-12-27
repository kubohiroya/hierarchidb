/**
 * @file modelessDialogContent.tsx
 * @description Content blocks for modeless map dialog windows.
 */

import type { ResourceGeoJsonLayer, ResourceVectorLayer } from '@hierarchidb/ui-plugin-shell/ui-map';
import { Box, Divider, List, ListItem, ListItemText, Paper, Stack, ToggleButton, Typography } from '@mui/material';
import type React from 'react';

export type MapInfoSummary = {
  name?: string | null;
  description?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  tags?: string[] | null;
  path?: string | null;
};

const formatTimestamp = (value?: number | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const formatText = (value?: string | null) => (value && value.trim().length > 0 ? value : '—');

export const MapInfoContent: React.FC<{ formattedZxy: string; info: MapInfoSummary }> = ({ formattedZxy, info }) => (
  <Stack spacing={1}>
    <Box>
      <Typography variant="overline" color="text.secondary">Name</Typography>
      <Typography variant="body2">{formatText(info.name)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Description</Typography>
      <Typography variant="body2">{formatText(info.description)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Created At</Typography>
      <Typography variant="body2">{formatTimestamp(info.createdAt)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Updated At</Typography>
      <Typography variant="body2">{formatTimestamp(info.updatedAt)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Tags</Typography>
      <Typography variant="body2">
        {(info.tags && info.tags.length > 0) ? info.tags.join(', ') : '—'}
      </Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Path</Typography>
      <Typography variant="body2">{formatText(info.path)}</Typography>
    </Box>
    <Divider />
    <Stack spacing={0.5}>
      <Typography variant="body2">URL Format: <code>?zxy=zoom,lng,lat</code></Typography>
      <Typography variant="body2">Current: <code>?zxy={formattedZxy}</code></Typography>
    </Stack>
  </Stack>
);

export type MapToggleOption = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

export type MapToggleSelection = Record<string, boolean>;

export const MapToggleCard: React.FC<{
  title: string;
  helperText?: string;
  options: MapToggleOption[];
  selection: MapToggleSelection;
  onToggle: (id: string) => void;
}> = ({ title, helperText, options, selection, onToggle }) => (
  <Paper variant="outlined" sx={{ p: 1.5 }}>
    <Stack spacing={1}>
      <Box>
        <Typography variant="subtitle2">{title}</Typography>
        {helperText ? (
          <Typography variant="caption" color="text.secondary">
            {helperText}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 1 }}>
        {options.map((option) => (
          <ToggleButton
            key={option.id}
            value={option.id}
            selected={Boolean(selection[option.id])}
            onChange={() => onToggle(option.id)}
            color="primary"
            sx={{
              borderRadius: 1.5,
              textTransform: 'none',
              px: 1,
              py: 0.75,
            }}
            aria-label={option.label}
          >
            <Stack spacing={0.5} alignItems="center">
              {option.icon}
              <Typography variant="caption">{option.label}</Typography>
            </Stack>
          </ToggleButton>
        ))}
      </Box>
    </Stack>
  </Paper>
);

export const MapLayerContent: React.FC<{
  basemapStyles: Array<{ nodeId: string; absolutePath?: string }>;
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers: ResourceGeoJsonLayer[];
}> = ({ basemapStyles, vectorLayers, geoJsonLayers }) => (
  <Stack spacing={2}>
    <Box>
      <Typography variant="subtitle2">Basemaps</Typography>
      {basemapStyles.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No basemap styles.</Typography>
      ) : (
        <List dense>
          {basemapStyles.map((style) => (
            <ListItem key={style.nodeId} disablePadding>
              <ListItemText primary={style.absolutePath ?? style.nodeId} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
    <Divider />
    <Box>
      <Typography variant="subtitle2">Vector Layers</Typography>
      {vectorLayers.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No vector layers.</Typography>
      ) : (
        <List dense>
          {vectorLayers.map((layer) => (
            <ListItem key={layer.nodeId} disablePadding>
              <ListItemText primary={layer.absolutePath ?? layer.nodeId} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
    <Divider />
    <Box>
      <Typography variant="subtitle2">GeoJSON Layers</Typography>
      {geoJsonLayers.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No GeoJSON layers.</Typography>
      ) : (
        <List dense>
          {geoJsonLayers.map((layer) => (
            <ListItem key={layer.layerId} disablePadding>
              <ListItemText primary={layer.absolutePath ?? layer.layerId} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  </Stack>
);
