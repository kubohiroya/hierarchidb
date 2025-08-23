/**
 * BaseMap Panel Component - displays basemap information in panel view
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  Map as MapIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { NodeId } from '@hierarchidb/00-core';
import { useBaseMapData } from '../hooks';

export interface BaseMapPanelProps {
  nodeId: NodeId;
  onEdit?: () => void;
  onView?: () => void;
}

/**
 * Panel component showing BaseMap information
 */
export const BaseMapPanel: React.FC<BaseMapPanelProps> = ({
  nodeId,
  onEdit,
  onView
}) => {
  const { entity, loading, error } = useBaseMapData(nodeId);

  if (loading) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="textSecondary">
          Loading BaseMap...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="error">
          Error: {error}
        </Typography>
      </Box>
    );
  }

  if (!entity) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="textSecondary">
          No BaseMap data found
        </Typography>
      </Box>
    );
  }

  const formatCoordinate = (value: number): string => {
    return value.toFixed(4);
  };

  return (
    <Box p={2}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <MapIcon color="primary" />
          <Box>
            <Typography variant="h6" component="div">
              {entity.name}
            </Typography>
            {entity.description && (
              <Typography variant="body2" color="textSecondary">
                {entity.description}
              </Typography>
            )}
          </Box>
        </Box>
        
        <Stack direction="row" spacing={1}>
          {onView && (
            <Tooltip title="View Map">
              <IconButton size="small" onClick={onView}>
                <ViewIcon />
              </IconButton>
            </Tooltip>
          )}
          {onEdit && (
            <Tooltip title="Edit BaseMap">
              <IconButton size="small" onClick={onEdit}>
                <EditIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {/* Map Style */}
      <Box mb={2}>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Map Style
        </Typography>
        <Chip 
          label={entity.mapStyle} 
          color="primary" 
          variant="outlined"
          size="small"
          sx={{ textTransform: 'capitalize' }}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Map Configuration */}
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Configuration
      </Typography>
      
      <Box mb={2}>
        <Stack spacing={1}>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2">Center:</Typography>
            <Typography variant="body2" fontFamily="monospace">
              {formatCoordinate(entity.center[0])}, {formatCoordinate(entity.center[1])}
            </Typography>
          </Box>
          
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2">Zoom:</Typography>
            <Typography variant="body2">{entity.zoom}</Typography>
          </Box>
          
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2">Bearing:</Typography>
            <Typography variant="body2">{entity.bearing}°</Typography>
          </Box>
          
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2">Pitch:</Typography>
            <Typography variant="body2">{entity.pitch}°</Typography>
          </Box>
        </Stack>
      </Box>

      {/* Display Options */}
      {entity.displayOptions && (
        <>
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Display Options
          </Typography>
          
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {entity.displayOptions.show3dBuildings && (
              <Chip label="3D Buildings" size="small" />
            )}
            {entity.displayOptions.showTraffic && (
              <Chip label="Traffic" size="small" />
            )}
            {entity.displayOptions.showTransit && (
              <Chip label="Transit" size="small" />
            )}
            {entity.displayOptions.showTerrain && (
              <Chip label="Terrain" size="small" />
            )}
            {entity.displayOptions.showLabels !== false && (
              <Chip label="Labels" size="small" />
            )}
          </Stack>
        </>
      )}

      {/* Tags */}
      {entity.tags && entity.tags.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Tags
          </Typography>
          
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {entity.tags.map((tag, index) => (
              <Chip key={index} label={tag} size="small" variant="outlined" />
            ))}
          </Stack>
        </>
      )}

      {/* Metadata */}
      <Divider sx={{ my: 2 }} />
      
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Metadata
      </Typography>
      
      <Stack spacing={0.5}>
        <Box display="flex" justifyContent="space-between">
          <Typography variant="caption" color="textSecondary">Created:</Typography>
          <Typography variant="caption">
            {new Date(entity.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
        
        <Box display="flex" justifyContent="space-between">
          <Typography variant="caption" color="textSecondary">Updated:</Typography>
          <Typography variant="caption">
            {new Date(entity.updatedAt).toLocaleDateString()}
          </Typography>
        </Box>
        
        <Box display="flex" justifyContent="space-between">
          <Typography variant="caption" color="textSecondary">Version:</Typography>
          <Typography variant="caption">v{entity.version}</Typography>
        </Box>
      </Stack>
    </Box>
  );
};