/**
 * @file modelessDialogContent.tsx
 * @description Content blocks for modeless map dialog windows.
 */

import type { ResourceGeoJsonLayer, ResourceVectorLayer } from '@hierarchidb/ui-plugin-shell/ui-map';
import { Box, Divider, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import type React from 'react';

export const MapInfoContent: React.FC<{ formattedZxy: string }> = ({ formattedZxy }) => (
  <Stack spacing={1}>
    <Typography variant="body2">URL Format: <code>?zxy=zoom,lng,lat</code></Typography>
    <Typography variant="body2">Current: <code>?zxy={formattedZxy}</code></Typography>
  </Stack>
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
