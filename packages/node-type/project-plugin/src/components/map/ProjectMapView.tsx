import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Map } from 'maplibre-gl';
import { MaplibreExportControl, PageOrientation, Format, Size } from '@watergis/maplibre-gl-export';
import { Deck } from '@deck.gl/core';
import { MapboxOverlay } from '@deck.gl/mapbox';
import {
  GeoJsonLayer,
  ScatterplotLayer,
  PathLayer,
  PolygonLayer,
  HeatmapLayer,
  HexagonLayer,
  ArcLayer,
  IconLayer,
  TextLayer,
  TripsLayer,
  H3HexagonLayer,
  GridLayer,
  ContourLayer
} from '@deck.gl/layers';
import { DataFilterExtension } from '@deck.gl/extensions';
import * as turf from '@turf/turf';
import { scaleLinear, scaleOrdinal, scaleQuantile } from 'd3-scale';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Typography,
  Stack,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Divider,
  Chip,
  Button,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Layers as LayersIcon,
  Map as MapIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  MyLocation as MyLocationIcon,
  Fullscreen as FullscreenIcon,
  ThreeDRotation as ThreeDIcon,
  Timeline as TimelineIcon,
  Analytics as AnalyticsIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Settings as SettingsIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as SkipNextIcon,
  SkipPrevious as SkipPreviousIcon
} from '@mui/icons-material';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@watergis/maplibre-gl-export/dist/maplibre-gl-export.css';
import type { ProjectEntity, ProjectLayer, SpatialAnalysis } from '~/types/project-types';

interface ProjectMapViewProps {
  project: ProjectEntity;
  onLayerUpdate?: (layerId: string, updates: Partial<ProjectLayer>) => void;
  onAnalysisRun?: (analysisId: string) => Promise<void>;
}

interface DeckLayer {
  id: string;
  type: string;
  data: any[];
  visible: boolean;
  opacity: number;
  pickable: boolean;
  layer: any; // Deck.gl layer instance
}

export const ProjectMapView: React.FC<ProjectMapViewProps> = ({
  project,
  onLayerUpdate,
  onAnalysisRun
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const deck = useRef<Deck | null>(null);
  const overlay = useRef<MapboxOverlay | null>(null);
  
  const [viewState, setViewState] = useState({
    longitude: project.mapConfig.defaultView.center[0],
    latitude: project.mapConfig.defaultView.center[1],
    zoom: project.mapConfig.defaultView.zoom,
    pitch: project.mapConfig.defaultView.pitch || 0,
    bearing: project.mapConfig.defaultView.bearing || 0
  });
  
  const [layers, setLayers] = useState<DeckLayer[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [basemapStyle, setBasemapStyle] = useState(project.mapConfig.baseMap);
  const [is3DMode, setIs3DMode] = useState(project.mapConfig.enable3D || false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new Map({
      container: mapContainer.current,
      style: getMapStyle(basemapStyle),
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      antialias: true
    });

    // Initialize Deck.gl overlay
    overlay.current = new MapboxOverlay({
      interleaved: true,
      layers: [],
      getTooltip: ({ object }) => object && {
        html: renderTooltip(object),
        style: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px'
        }
      },
      onClick: ({ object }) => {
        setSelectedFeature(object);
      }
    });

    map.current.addControl(overlay.current as any);
    
    // Add export control for printing
    const exportControl = new MaplibreExportControl({
      PageOrientation: PageOrientation.Landscape,
      Format: Format.PDF,
      DPI: 300,
      Size: Size.A4,
      Crosshair: true,
      PrintableArea: true,
      Local: 'ja',
      FileName: `project-map-${project.id}-${new Date().toISOString().slice(0, 10)}`,
      AllowedSizes: [Size.A4, Size.A3, Size.A2],
      Translate: {
        'en': {
          'PrintableArea': 'Printable Area',
          'Format': 'Format',
          'DPI': 'DPI',
          'Generate': 'Generate PDF'
        },
        'ja': {
          'PrintableArea': '印刷可能エリア',
          'Crosshair': '十字線',
          'Format': 'フォーマット',
          'DPI': '解像度',
          'Generate': 'PDF生成',
          'Size': 'サイズ',
          'PageOrientation': 'ページ向き',
          'Landscape': '横向き',
          'Portrait': '縦向き'
        }
      }
    });
    map.current.addControl(exportControl, 'top-right');
    
    // Sync map view with state
    map.current.on('move', () => {
      if (!map.current) return;
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      const pitch = map.current.getPitch();
      const bearing = map.current.getBearing();
      
      setViewState({
        longitude: center.lng,
        latitude: center.lat,
        zoom,
        pitch,
        bearing
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Create Deck.gl layers from project layers
  useEffect(() => {
    const deckLayers = project.layers.map(layer => createDeckLayer(layer));
    setLayers(deckLayers);
    
    if (overlay.current) {
      overlay.current.setProps({
        layers: deckLayers.filter(l => l.visible).map(l => l.layer)
      });
    }
  }, [project.layers]);

  // Create Deck.gl layer from project layer configuration
  const createDeckLayer = (projectLayer: ProjectLayer): DeckLayer => {
    const { source, config, style, interaction } = projectLayer;
    
    // Mock data - in real implementation, this would come from the actual data sources
    const mockData = generateMockData(source.nodeType, source.recordCount || 100);
    
    let layer: any;
    
    switch (source.nodeType) {
      case 'shape':
        layer = new PolygonLayer({
          id: projectLayer.id,
          data: mockData,
          getPolygon: d => d.geometry.coordinates,
          getFillColor: parseColor(style.polygon?.fillColor || '#3388ff'),
          getLineColor: parseColor(style.polygon?.strokeColor || '#3388ff'),
          getLineWidth: style.polygon?.strokeWidth || 2,
          lineWidthUnits: 'pixels',
          opacity: config.opacity,
          pickable: interaction.clickable || interaction.hoverable,
          autoHighlight: interaction.hoverable,
          highlightColor: [255, 200, 0, 128],
          extensions: [new DataFilterExtension({ filterSize: 1 })],
          visible: config.enabled
        });
        break;
        
      case 'location':
        if (style.type === 'simple' && style.point) {
          layer = new ScatterplotLayer({
            id: projectLayer.id,
            data: mockData,
            getPosition: d => d.geometry.coordinates,
            getRadius: style.point.size as number || 8,
            getFillColor: parseColor(style.point.color || '#3388ff'),
            getLineColor: parseColor(style.point.strokeColor || '#ffffff'),
            lineWidthMinPixels: style.point.strokeWidth || 1,
            opacity: config.opacity,
            pickable: interaction.clickable || interaction.hoverable,
            autoHighlight: interaction.hoverable,
            visible: config.enabled
          });
        } else {
          // Use IconLayer for more complex point styles
          layer = new IconLayer({
            id: projectLayer.id,
            data: mockData,
            getPosition: d => d.geometry.coordinates,
            getIcon: d => ({
              url: getIconUrl(style.point?.symbol || 'circle'),
              width: 128,
              height: 128
            }),
            getSize: style.point?.size as number || 32,
            opacity: config.opacity,
            pickable: interaction.clickable || interaction.hoverable,
            visible: config.enabled
          });
        }
        break;
        
      case 'route':
        layer = new PathLayer({
          id: projectLayer.id,
          data: mockData,
          getPath: d => d.geometry.coordinates,
          getColor: parseColor(style.line?.color || '#3388ff'),
          getWidth: style.line?.width as number || 3,
          widthUnits: 'pixels',
          opacity: config.opacity,
          pickable: interaction.clickable || interaction.hoverable,
          autoHighlight: interaction.hoverable,
          visible: config.enabled
        });
        break;
        
      default:
        // Fallback to GeoJsonLayer
        layer = new GeoJsonLayer({
          id: projectLayer.id,
          data: mockData,
          getFillColor: parseColor(style.polygon?.fillColor || '#3388ff'),
          getLineColor: parseColor(style.line?.color || '#3388ff'),
          getLineWidth: style.line?.width as number || 2,
          lineWidthUnits: 'pixels',
          opacity: config.opacity,
          pickable: interaction.clickable || interaction.hoverable,
          autoHighlight: interaction.hoverable,
          visible: config.enabled
        });
    }
    
    return {
      id: projectLayer.id,
      type: source.nodeType,
      data: mockData,
      visible: config.enabled,
      opacity: config.opacity,
      pickable: interaction.clickable || interaction.hoverable,
      layer
    };
  };

  // Create analysis result layers
  const createAnalysisLayer = (analysis: SpatialAnalysis, result: any): any => {
    switch (analysis.type) {
      case 'buffer':
        return new PolygonLayer({
          id: `${analysis.id}-result`,
          data: result.features,
          getPolygon: d => d.geometry.coordinates,
          getFillColor: [255, 200, 0, 100],
          getLineColor: [255, 150, 0],
          getLineWidth: 2,
          lineWidthUnits: 'pixels',
          pickable: true
        });
        
      case 'density':
        return new HeatmapLayer({
          id: `${analysis.id}-result`,
          data: result.points,
          getPosition: d => d.coordinates,
          getWeight: d => d.weight,
          radiusPixels: analysis.density?.radius || 30,
          intensity: 1,
          threshold: 0.05
        });
        
      case 'cluster':
        return new HexagonLayer({
          id: `${analysis.id}-result`,
          data: result.points,
          getPosition: d => d.coordinates,
          radius: 1000,
          elevationScale: 50,
          extruded: is3DMode,
          coverage: 0.8
        });
        
      default:
        return null;
    }
  };

  // Helper functions
  const getMapStyle = (style: string): string => {
    const styles: Record<string, string> = {
      streets: 'https://demotiles.maplibre.org/style.json',
      satellite: 'https://api.maptiler.com/maps/satellite/style.json?key=YOUR_KEY',
      terrain: 'https://api.maptiler.com/maps/outdoor/style.json?key=YOUR_KEY',
      light: 'https://api.maptiler.com/maps/bright/style.json?key=YOUR_KEY',
      dark: 'https://api.maptiler.com/maps/dark/style.json?key=YOUR_KEY'
    };
    return styles[style] || styles.streets;
  };

  const parseColor = (color: string | any): number[] => {
    if (typeof color === 'string') {
      // Convert hex to RGB
      const hex = color.replace('#', '');
      return [
        parseInt(hex.substr(0, 2), 16),
        parseInt(hex.substr(2, 2), 16),
        parseInt(hex.substr(4, 2), 16),
        200
      ];
    }
    return [100, 100, 100, 200];
  };

  const getIconUrl = (symbol: string): string => {
    // Return icon URLs based on symbol type
    const icons: Record<string, string> = {
      circle: '/icons/circle.png',
      square: '/icons/square.png',
      triangle: '/icons/triangle.png',
      star: '/icons/star.png'
    };
    return icons[symbol] || icons.circle;
  };

  const renderTooltip = (object: any): string => {
    if (!object || !object.properties) return '';
    
    const props = object.properties;
    const entries = Object.entries(props).slice(0, 5);
    
    return `
      <div>
        ${entries.map(([key, value]) => `
          <div><strong>${key}:</strong> ${value}</div>
        `).join('')}
      </div>
    `;
  };

  const generateMockData = (type: string, count: number): any[] => {
    // Generate mock GeoJSON features for testing
    const features = [];
    const center = project.mapConfig.defaultView.center;
    
    for (let i = 0; i < count; i++) {
      let geometry;
      
      switch (type) {
        case 'location':
          geometry = {
            type: 'Point',
            coordinates: [
              center[0] + (Math.random() - 0.5) * 0.1,
              center[1] + (Math.random() - 0.5) * 0.1
            ]
          };
          break;
          
        case 'route':
          const points = [];
          const startPoint = [
            center[0] + (Math.random() - 0.5) * 0.1,
            center[1] + (Math.random() - 0.5) * 0.1
          ];
          points.push(startPoint);
          
          for (let j = 1; j < 5; j++) {
            points.push([
              points[j - 1][0] + (Math.random() - 0.5) * 0.02,
              points[j - 1][1] + (Math.random() - 0.5) * 0.02
            ]);
          }
          
          geometry = {
            type: 'LineString',
            coordinates: points
          };
          break;
          
        case 'shape':
        default:
          const size = 0.01;
          const lng = center[0] + (Math.random() - 0.5) * 0.1;
          const lat = center[1] + (Math.random() - 0.5) * 0.1;
          
          geometry = {
            type: 'Polygon',
            coordinates: [[
              [lng - size, lat - size],
              [lng + size, lat - size],
              [lng + size, lat + size],
              [lng - size, lat + size],
              [lng - size, lat - size]
            ]]
          };
          break;
      }
      
      features.push({
        type: 'Feature',
        geometry,
        properties: {
          id: i,
          name: `Feature ${i}`,
          value: Math.random() * 100,
          category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)]
        }
      });
    }
    
    return features;
  };

  // Map controls
  const handleZoomIn = () => {
    if (map.current) {
      map.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (map.current) {
      map.current.zoomOut();
    }
  };

  const handleResetView = () => {
    if (map.current) {
      map.current.flyTo({
        center: project.mapConfig.defaultView.center,
        zoom: project.mapConfig.defaultView.zoom,
        pitch: project.mapConfig.defaultView.pitch || 0,
        bearing: project.mapConfig.defaultView.bearing || 0
      });
    }
  };

  const handle3DToggle = () => {
    setIs3DMode(!is3DMode);
    if (map.current) {
      map.current.setPitch(is3DMode ? 0 : 60);
    }
  };

  const handlePrint = () => {
    // Trigger the export control programmatically
    const printButton = document.querySelector('.maplibregl-ctrl-export button') as HTMLButtonElement;
    if (printButton) {
      printButton.click();
    }
  };

  const handleLayerToggle = (layerId: string) => {
    setLayers(prev => {
      const updated = prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, visible: !layer.visible }
          : layer
      );
      
      if (overlay.current) {
        overlay.current.setProps({
          layers: updated.filter(l => l.visible).map(l => l.layer)
        });
      }
      
      return updated;
    });
  };

  const handleLayerOpacityChange = (layerId: string, opacity: number) => {
    setLayers(prev => {
      const updated = prev.map(layer => {
        if (layer.id === layerId) {
          const updatedLayer = { ...layer, opacity };
          updatedLayer.layer = updatedLayer.layer.clone({ opacity });
          return updatedLayer;
        }
        return layer;
      });
      
      if (overlay.current) {
        overlay.current.setProps({
          layers: updated.filter(l => l.visible).map(l => l.layer)
        });
      }
      
      return updated;
    });
  };

  return (
    <Box sx={{ height: '100%', position: 'relative', display: 'flex' }}>
      {/* Map Container */}
      <Box
        ref={mapContainer}
        sx={{
          flex: 1,
          height: '100%',
          position: 'relative'
        }}
      />
      
      {/* Map Controls */}
      <Paper
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          zIndex: 1000
        }}
      >
        <Tooltip title="Zoom In" placement="left">
          <IconButton onClick={handleZoomIn} size="small">
            <ZoomInIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom Out" placement="left">
          <IconButton onClick={handleZoomOut} size="small">
            <ZoomOutIcon />
          </IconButton>
        </Tooltip>
        <Divider />
        <Tooltip title="Reset View" placement="left">
          <IconButton onClick={handleResetView} size="small">
            <MyLocationIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="3D Mode" placement="left">
          <IconButton onClick={handle3DToggle} size="small" color={is3DMode ? 'primary' : 'default'}>
            <ThreeDIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Print Map (PDF)" placement="left">
          <IconButton onClick={handlePrint} size="small">
            <PrintIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fullscreen" placement="left">
          <IconButton size="small">
            <FullscreenIcon />
          </IconButton>
        </Tooltip>
      </Paper>
      
      {/* Layer Panel Toggle */}
      <IconButton
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          bgcolor: 'background.paper',
          zIndex: 1000,
          '&:hover': { bgcolor: 'action.hover' }
        }}
        onClick={() => setLayerPanelOpen(!layerPanelOpen)}
      >
        <LayersIcon />
      </IconButton>
      
      {/* Layer Panel */}
      <Drawer
        anchor="left"
        open={layerPanelOpen}
        variant="persistent"
        sx={{
          width: 320,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 320,
            position: 'relative'
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Layers
          </Typography>
          <List>
            {layers.map((layer) => {
              const projectLayer = project.layers.find(l => l.id === layer.id);
              if (!projectLayer) return null;
              
              return (
                <ListItem key={layer.id} sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <ListItemIcon>
                      <LayersIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={projectLayer.name}
                      secondary={
                        <Stack direction="row" spacing={0.5}>
                          <Chip label={layer.type} size="small" />
                          <Chip label={`${layer.data.length} features`} size="small" />
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleLayerToggle(layer.id)}
                        size="small"
                      >
                        {layer.visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                      </IconButton>
                    </ListItemSecondaryAction>
                  </Box>
                  {layer.visible && (
                    <Box sx={{ mt: 1, px: 2 }}>
                      <Typography variant="caption" gutterBottom>
                        Opacity: {Math.round(layer.opacity * 100)}%
                      </Typography>
                      <Slider
                        size="small"
                        value={layer.opacity}
                        onChange={(_, value) => handleLayerOpacityChange(layer.id, value as number)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </Box>
                  )}
                </ListItem>
              );
            })}
          </List>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            Base Map
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={basemapStyle}
              onChange={(e) => {
                setBasemapStyle(e.target.value);
                if (map.current) {
                  map.current.setStyle(getMapStyle(e.target.value));
                }
              }}
            >
              <MenuItem value="streets">Streets</MenuItem>
              <MenuItem value="satellite">Satellite</MenuItem>
              <MenuItem value="terrain">Terrain</MenuItem>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Drawer>
      
      {/* Timeline Control */}
      {timelineVisible && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            p: 2,
            width: '80%',
            maxWidth: 600,
            zIndex: 1000
          }}
        >
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small">
                <SkipPreviousIcon />
              </IconButton>
              <IconButton onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <IconButton size="small">
                <SkipNextIcon />
              </IconButton>
              <Slider
                value={currentTime}
                onChange={(_, value) => setCurrentTime(value as number)}
                min={0}
                max={100}
                sx={{ flex: 1 }}
              />
              <Typography variant="caption">
                {new Date(currentTime * 1000).toISOString().substr(11, 8)}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}
      
      {/* Selected Feature Info */}
      {selectedFeature && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            p: 2,
            maxWidth: 300,
            zIndex: 1000
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Feature Properties
          </Typography>
          {Object.entries(selectedFeature.properties || {}).map(([key, value]) => (
            <Typography key={key} variant="body2">
              <strong>{key}:</strong> {String(value)}
            </Typography>
          ))}
          <Button
            size="small"
            onClick={() => setSelectedFeature(null)}
            sx={{ mt: 1 }}
          >
            Close
          </Button>
        </Paper>
      )}
    </Box>
  );
};