/**
 * @file BaseMapPanel.tsx
 * @description BaseMap panel component for viewing configured basemap
 * Used in the main application to display basemap entities
 */

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CameraAlt,
  Edit,
  ExpandLess,
  ExpandMore,
  Fullscreen,
  Info,
  Layers,
  Map as MapIcon,
  Refresh,
  Settings,
} from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/common-type';
import { BaseMapDisplay } from './BaseMapDisplay';
import { useBaseMapEntity } from '../hooks/useBaseMapEntity';
import type { MapViewState } from '@hierarchidb/ui-map';

export interface BaseMapPanelProps {
  /** Node ID of the BaseMap entity */
  nodeId: NodeId;
  /** Panel height */
  height?: string | number;
  /** Show panel header */
  showHeader?: boolean;
  /** Show configuration details */
  showDetails?: boolean;
  /** Callback when edit is clicked */
  onEdit?: () => void;
  /** Callback when refresh is clicked */
  onRefresh?: () => void;
  /** Callback when fullscreen is clicked */
  onFullscreen?: () => void;
}

/**
 * BaseMap Panel Component
 * Main panel for displaying a configured basemap with controls
 */
export const BaseMapPanel: React.FC<BaseMapPanelProps> = ({
                                                            nodeId,
                                                            height = '500px',
                                                            showHeader = true,
                                                            showDetails = true,
                                                            onEdit,
                                                            onRefresh,
                                                            onFullscreen,
                                                          }) => {
  const { entity, loading, error, refetch } = useBaseMapEntity(nodeId);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [currentViewState, setCurrentViewState] = useState<MapViewState | null>(null);

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const handleViewStateChange = (viewState: MapViewState) => {
    setCurrentViewState(viewState);
  };

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load BaseMap: {error.message}
        </Alert>
      </Paper>
    );
  }

  if (!entity && !loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="info">
          No BaseMap configuration found
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ height: showDetails ? 'auto' : height, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      {showHeader && (
        <>
          <Box sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <MapIcon color="primary" />
                <Typography variant="h6">
                  {entity?.name || 'BaseMap'}
                </Typography>
                {entity?.mapStyle && (
                  <Typography variant="body2" color="text.secondary">
                    ({entity.mapStyle.style})
                  </Typography>
                )}
              </Stack>

              <Stack direction="row" spacing={1}>
                {onEdit && (
                  <Tooltip title="Edit BaseMap">
                    <IconButton size="small" onClick={onEdit}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={handleRefresh}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
                {onFullscreen && (
                  <Tooltip title="Fullscreen">
                    <IconButton size="small" onClick={onFullscreen}>
                      <Fullscreen />
                    </IconButton>
                  </Tooltip>
                )}
                {showDetails && (
                  <Tooltip title={detailsExpanded ? 'Hide details' : 'Show details'}>
                    <IconButton
                      size="small"
                      onClick={() => setDetailsExpanded(!detailsExpanded)}
                    >
                      {detailsExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Stack>

            {entity?.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {entity.description}
              </Typography>
            )}
          </Box>
          <Divider />
        </>
      )}

      {/* Map Display */}
      <Box sx={{ flexGrow: 1, minHeight: height }}>
        <BaseMapDisplay
          nodeId={nodeId}
          entity={entity || undefined}
          height={height}
          onViewStateChange={handleViewStateChange}
          showLoadingIndicator={loading}
        />
      </Box>

      {/* Configuration Details */}
      {showDetails && (
        <Collapse in={detailsExpanded}>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Configuration Details
            </Typography>

            <List dense>
              {/* Style Information */}
              <ListItem>
                <ListItemIcon>
                  <Layers fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Map Style"
                  secondary={
                    entity?.mapStyle?.style === 'custom'
                      ? entity.mapStyle.customStyleUrl || 'Custom configuration'
                      : entity?.mapStyle?.style || 'Not configured'
                  }
                />
              </ListItem>

              {/* Viewport Information */}
              <ListItem>
                <ListItemIcon>
                  <CameraAlt fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Viewport"
                  secondary={
                    entity?.viewport
                      ? `Center: [${entity.viewport.center[0].toFixed(4)}, ${entity.viewport.center[1].toFixed(4)}], Zoom: ${entity.viewport.zoom.toFixed(1)}`
                      : 'Not configured'
                  }
                />
              </ListItem>

              {/* Current View (if different from configured) */}
              {currentViewState && (
                <ListItem>
                  <ListItemIcon>
                    <Info fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Current View"
                    secondary={`[${currentViewState.longitude.toFixed(4)}, ${currentViewState.latitude.toFixed(4)}], Zoom: ${currentViewState.zoom.toFixed(1)}`}
                  />
                </ListItem>
              )}

              {/* Display Options */}
              {entity?.displayOptions && (
                <ListItem>
                  <ListItemIcon>
                    <Settings fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Display Options"
                    secondary={
                      [
                        entity.displayOptions.show3dBuildings && '3D Buildings',
                        entity.displayOptions.showTraffic && 'Traffic',
                        entity.displayOptions.showTransit && 'Transit',
                        entity.displayOptions.showTerrain && 'Terrain',
                        entity.displayOptions.showLabels !== false && 'Labels',
                      ].filter(Boolean).join(', ') || 'Default'
                    }
                  />
                </ListItem>
              )}

              {/* Tags (from entity) */}
              {Array.isArray(entity?.tags) && entity!.tags!.length > 0 && (
                <ListItem>
                  <ListItemIcon>
                    <Info fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Tags"
                    secondary={`${entity!.tags!.length} tags`}
                  />
                </ListItem>
              )}
            </List>
          </Box>
        </Collapse>
      )}
    </Paper>
  );
};

export default BaseMapPanel;
