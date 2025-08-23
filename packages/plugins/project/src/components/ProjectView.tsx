/**
 * @file ProjectView.tsx
 * @description Main view component for displaying project maps with integrated resources
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Fab,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,

  Switch,
  Divider,
  Chip,
  Alert,
} from '@mui/material';
import {
  Layers as LayersIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Settings as SettingsIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
// import { MapLibreMap, type MapViewState } from '@hierarchidb/ui-map';
import type { NodeId } from '@hierarchidb/00-core';
import type { ProjectEntity, LayerConfiguration, LayerType } from '../types';

// MapLibre ViewState type
interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

/*
// MapLibre Style type  
interface MapStyle {
  version: 8;
  name: string;
  sources: Record<string, {
    type: 'raster' | 'vector' | 'geojson';
    tiles?: string[];
    tileSize?: number;
    attribution?: string;
    data?: object;
  }>;
  layers: Array<{
    id: string;
    type: string;
    source: string;
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  }>;
}
 */
/**
 * Props for ProjectView component
 */
export interface ProjectViewProps {
  /** Project node ID */
  nodeId: NodeId;
  
  /** Project entity data */
  project: ProjectEntity;
  
  /** Whether the map should be in fullscreen mode */
  fullscreen?: boolean;
  
  /** Callback when fullscreen mode changes */
  onFullscreenChange?: (fullscreen: boolean) => void;
  
  /** Callback when project is shared */
  onShare?: () => void;
  
  /** Callback when project is exported */
  onExport?: () => void;
}

/**
 * Layer control item for managing individual layer visibility and properties
 */
interface LayerControlItemProps {
  resourceId: string;
  config: LayerConfiguration;
  onConfigChange: (resourceId: string, config: LayerConfiguration) => void;
}

const LayerControlItem: React.FC<LayerControlItemProps> = ({
  resourceId,
  config,
  onConfigChange,
}: LayerControlItemProps) => {
  const handleVisibilityChange = (visible: boolean) => {
    onConfigChange(resourceId, { ...config, isVisible: visible });
  };

  // Commented out to fix unused variable warning - can be re-enabled when opacity slider is added
  // const handleOpacityChange = (_event: Event, value: number | number[]) => {
  //   const opacity = Array.isArray(value) ? value[0] : value;
  //   onConfigChange(resourceId, { ...config, opacity: (opacity ?? 0) / 100 });
  // };

  return (
    <ListItem>
      <ListItemIcon>
        <IconButton
          size="small"
          onClick={() => handleVisibilityChange(!config.isVisible)}
        >
          {config.isVisible ? (
            <VisibilityIcon fontSize="small" />
          ) : (
            <VisibilityOffIcon fontSize="small" />
          )}
        </IconButton>
      </ListItemIcon>
      
      <ListItemText
        primary={config.layerId}
        secondary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label={config.layerType}
              variant="outlined"
              disabled={!config.isVisible}
            />
          </Box>
        }
      />
      secondaryAction={
        <Switch
          edge="end"
          checked={config.isVisible !== false}
          onChange={(e) => handleVisibilityChange((e.target as HTMLInputElement).checked)}
        />
      }
    </ListItem>
  );
};

/**
 * Main ProjectView component
 */
export const ProjectView: React.FC<ProjectViewProps> = ({
  project,
  fullscreen = false,
  onFullscreenChange,
  onShare,
  onExport,
}) => {
  // Layer panel state
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  
  // Map view state
  const [viewState] = useState<ViewState>({
    longitude: project.mapConfig.center[0],
    latitude: project.mapConfig.center[1],
    zoom: project.mapConfig.zoom,
    bearing: project.mapConfig.bearing,
    pitch: project.mapConfig.pitch,
  });

  // Layer configurations state
  const [layerConfigs, setLayerConfigs] = useState<Record<string, LayerConfiguration>>(
    project.layerConfigurations || {}
  );

  // Generate map style based on project resources and configurations (temporarily unused)
  /*
  const mapStyle = useMemo(() => {
    const style = {
      version: 8,
      name: project.name || 'Project Map',
      sources: {} as Record<string, any>,
      layers: [] as any[],
    };

    // Add base map layer
    style.sources['osm'] = {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    };

    style.layers.push({
      id: 'osm',
      type: 'raster',
      source: 'osm',
    });

    // Add project resource layers
    (project as any).initialReferences?.forEach((resourceId: any, index: number) => {
      const config = layerConfigs[resourceId];
      
      if (config?.isVisible === false) return;

      // Mock resource layer - in real implementation, this would load actual data
      const layerId = `resource-${resourceId}`;
      
      style.sources[layerId] = {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [], // Would be populated with actual resource data
        },
      };

      style.layers.push({
        id: layerId,
        type: 'circle',
        source: layerId,
        paint: {
          'circle-radius': 6,
          'circle-color': `hsl(${(index * 60) % 360}, 70%, 50%)`,
          'circle-opacity': config?.opacity ?? 1,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
        minzoom: config?.visibilityRules?.minZoom || 0,
        maxzoom: config?.visibilityRules?.maxZoom || 22,
      });
    });

    return style;
  }, [project, layerConfigs]);
  */

  // Handle layer configuration changes
  const handleLayerConfigChange = useCallback((resourceId: string, config: LayerConfiguration) => {
    setLayerConfigs(prev => ({
      ...prev,
      [resourceId]: config,
    }));
  }, []);

  // Handle view state changes (temporarily unused)
  // const handleViewStateChange = useCallback((newViewState: any) => {
  //   setViewState(newViewState);
  // }, []);

  // Toggle fullscreen mode
  const handleFullscreenToggle = () => {
    const newFullscreen = !fullscreen;
    onFullscreenChange?.(newFullscreen);
  };

  return (
    <Box 
      sx={{ 
        position: 'relative',
        height: fullscreen ? '100vh' : '600px',
        width: '100%',
      }}
    >
      {/* Map Container */}
      <Box sx={{ height: '100%', width: '100%' }}>
        {/* Temporarily disabled until ui-map package is properly configured */}
        <Box 
          sx={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            color: 'text.secondary'
          }}
        >
          <Typography variant="h6">
            Map View (Coming Soon)
          </Typography>
        </Box>
      </Box>

      {/* Map Controls */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Tooltip title="Toggle Layers Panel">
          <Fab
            size="small"
            color="primary"
            onClick={() => setLayerPanelOpen(!layerPanelOpen)}
          >
            <LayersIcon />
          </Fab>
        </Tooltip>

        <Tooltip title={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
          <Fab
            size="small"
            color="default"
            onClick={handleFullscreenToggle}
          >
            <FullscreenIcon />
          </Fab>
        </Tooltip>

        {onShare && (
          <Tooltip title="Share Project">
            <Fab
              size="small"
              color="default"
              onClick={onShare}
            >
              <ShareIcon />
            </Fab>
          </Tooltip>
        )}

        {onExport && (
          <Tooltip title="Export Project">
            <Fab
              size="small"
              color="default"
              onClick={onExport}
            >
              <DownloadIcon />
            </Fab>
          </Tooltip>
        )}
      </Box>

      {/* Project Info Overlay */}
      {!fullscreen && (
        <Card
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            maxWidth: 300,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <CardContent sx={{ pb: '16px !important' }}>
            <Typography variant="h6" gutterBottom>
              {project.name}
            </Typography>
            {project.description && (
              <Typography variant="body2" color="text.secondary" paragraph>
                {project.description}
              </Typography>
            )}
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip 
                label={`${(project as any).initialReferences?.length || 0} Resources`} 
                size="small" 
              />
              <Chip 
                label={`Zoom ${viewState.zoom.toFixed(1)}`} 
                size="small" 
              />
              <Chip 
                label={`${viewState.latitude.toFixed(4)}, ${viewState.longitude.toFixed(4)}`} 
                size="small" 
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Layers Panel */}
      <Drawer
        anchor="left"
        open={layerPanelOpen}
        onClose={() => setLayerPanelOpen(false)}
        variant="temporary"
        sx={{
          '& .MuiDrawer-paper': {
            width: 360,
            maxWidth: '90vw',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <LayersIcon />
            <Typography variant="h6">
              Layers
            </Typography>
          </Box>

          {((project as any).initialReferences?.length || 0) === 0 ? (
            <Alert severity="info">
              No resource layers available. Add resources to your project to see them here.
            </Alert>
          ) : (
            <List>
              {((project as any).initialReferences || []).map((resourceId: any, index: number) => {
                const config: LayerConfiguration = layerConfigs[resourceId] || {
                  layerId: `layer-${resourceId}-${index}`,
                  layerType: 'raster' as LayerType,
                  isVisible: true,
                  opacity: 1,
                  layerOrder: index,
                  visibilityRules: { minZoom: 0, maxZoom: 22 },
                  styleConfig: {
                    source: {
                      type: 'raster',
                      url: '',
                      attribution: '',
                    },
                  },
                  interactionConfig: {
                    clickable: true,
                    hoverable: true,
                    popupTemplate: '',
                    tooltipTemplate: '',
                  },
                };

                return (
                  <React.Fragment key={resourceId}>
                    <LayerControlItem
                      resourceId={resourceId}
                      config={config}
                      onConfigChange={handleLayerConfigChange}
                    />
                    {index < (((project as any).initialReferences?.length || 0) - 1) && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>
            Map Settings
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="View State"
                secondary={`Lat: ${viewState.latitude.toFixed(4)}, Lng: ${viewState.longitude.toFixed(4)}, Zoom: ${viewState.zoom.toFixed(1)}`}
              />
            </ListItem>
          </List>
        </Box>
      </Drawer>
    </Box>
  );
};

export default ProjectView;