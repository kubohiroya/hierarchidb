/**
 * BaseMap Preview Component - shows preview of configured basemap
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack
} from '@mui/material';
import { CreateBaseMapData } from '../../shared';

export interface BaseMapPreviewProps {
  data: CreateBaseMapData;
  onDataChange: (updates: Partial<CreateBaseMapData>) => void;
}

/**
 * Preview component showing the configured basemap settings
 */
export const BaseMapPreview: React.FC<BaseMapPreviewProps> = ({
  data
}) => {
  const formatCoordinate = (value: number, decimals: number = 6): string => {
    return value.toFixed(decimals);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        BaseMap Preview
      </Typography>

      <Grid container spacing={3}>
        {/* Basic Information Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Basic Information
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Name
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {data.name || 'Unnamed Map'}
                </Typography>
              </Box>

              {data.description && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {data.description}
                  </Typography>
                </Box>
              )}

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Map Style
                </Typography>
                <Chip 
                  label={data.mapStyle} 
                  color="primary" 
                  variant="outlined"
                  sx={{ textTransform: 'capitalize' }}
                />
              </Box>

              {data.tags && data.tags.length > 0 && (
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Tags
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {data.tags.map((tag, index) => (
                      <Chip key={index} label={tag} size="small" />
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Map Configuration Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Map Configuration
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Center (Lng, Lat)
                  </Typography>
                  <Typography variant="body1" fontFamily="monospace">
                    {formatCoordinate(data.center[0])}, {formatCoordinate(data.center[1])}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Zoom Level
                  </Typography>
                  <Typography variant="body1">
                    {data.zoom}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Bearing
                  </Typography>
                  <Typography variant="body1">
                    {data.bearing || 0}°
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Pitch
                  </Typography>
                  <Typography variant="body1">
                    {data.pitch || 0}°
                  </Typography>
                </Grid>
              </Grid>

              {data.mapStyle === 'custom' && data.styleUrl && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Custom Style URL
                  </Typography>
                  <Typography 
                    variant="body2" 
                    fontFamily="monospace"
                    sx={{ 
                      wordBreak: 'break-all',
                      bgcolor: 'grey.100',
                      p: 1,
                      borderRadius: 1
                    }}
                  >
                    {data.styleUrl}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Display Options Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Display Options
              </Typography>
              
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">3D Buildings</Typography>
                  <Chip 
                    label={data.displayOptions?.show3dBuildings ? 'ON' : 'OFF'} 
                    size="small"
                    color={data.displayOptions?.show3dBuildings ? 'success' : 'default'}
                  />
                </Box>
                
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Traffic</Typography>
                  <Chip 
                    label={data.displayOptions?.showTraffic ? 'ON' : 'OFF'} 
                    size="small"
                    color={data.displayOptions?.showTraffic ? 'success' : 'default'}
                  />
                </Box>
                
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Transit</Typography>
                  <Chip 
                    label={data.displayOptions?.showTransit ? 'ON' : 'OFF'} 
                    size="small"
                    color={data.displayOptions?.showTransit ? 'success' : 'default'}
                  />
                </Box>
                
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Terrain</Typography>
                  <Chip 
                    label={data.displayOptions?.showTerrain ? 'ON' : 'OFF'} 
                    size="small"
                    color={data.displayOptions?.showTerrain ? 'success' : 'default'}
                  />
                </Box>
                
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Labels</Typography>
                  <Chip 
                    label={data.displayOptions?.showLabels !== false ? 'ON' : 'OFF'} 
                    size="small"
                    color={data.displayOptions?.showLabels !== false ? 'success' : 'default'}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Additional Information Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Additional Information
              </Typography>
              
              {data.apiKey && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    API Key
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {'•'.repeat(8)}...{data.apiKey.slice(-4)}
                  </Typography>
                </Box>
              )}

              {data.attribution && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Attribution
                  </Typography>
                  <Typography variant="body2">
                    {data.attribution}
                  </Typography>
                </Box>
              )}

              {data.bounds && (
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Bounds
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    N: {formatCoordinate(data.bounds.north, 4)}<br/>
                    S: {formatCoordinate(data.bounds.south, 4)}<br/>
                    E: {formatCoordinate(data.bounds.east, 4)}<br/>
                    W: {formatCoordinate(data.bounds.west, 4)}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Map Preview Placeholder */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Map Preview
              </Typography>
              
              <Box
                sx={{
                  height: 300,
                  bgcolor: 'grey.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'grey.400'
                }}
              >
                <Stack alignItems="center" spacing={1}>
                  <Typography variant="h6" color="textSecondary">
                    🗺️
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Map preview will be shown here
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {data.mapStyle.toUpperCase()} • Zoom {data.zoom} • {formatCoordinate(data.center[0], 2)}, {formatCoordinate(data.center[1], 2)}
                  </Typography>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};