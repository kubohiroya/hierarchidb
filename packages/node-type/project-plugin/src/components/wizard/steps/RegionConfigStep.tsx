import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  FormControlLabel,
  Slider,
  Paper,
  Button,
  Stack,
} from '@mui/material';
import {
  CropFree as BboxIcon,
  Pentagon as PolygonIcon,
  AccountBalance as AdminIcon,
  MyLocation as CustomIcon,
  Map as MapIcon,
  Terrain as TerrainIcon,
  Satellite as SatelliteIcon,
} from '@mui/icons-material';
import { MapLibreMap, type MapLibreMapInstance, type MapViewState } from '@hierarchidb/ui-map';
import type { ProjectEntity, ProjectRegion, BoundingBox } from '~/types/project-types';

interface RegionConfigStepProps {
  data: Partial<ProjectEntity>;
  onComplete: (data: Partial<ProjectEntity>) => void;
}

export const RegionConfigStep: React.FC<RegionConfigStepProps> = ({
  data,
  onComplete: _onComplete,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMapInstance | null>(null);

  const [formData, setFormData] = useState<ProjectRegion>({
    coverage: data.coverage || {
      type: 'bbox',
      bbox: {
        minLon: 139.0,
        minLat: 35.0,
        maxLon: 140.0,
        maxLat: 36.0,
      },
    },
    mapConfig: data.mapConfig || {
      defaultView: {
        center: [139.6917, 35.6895],
        zoom: 10,
        bearing: 0,
        pitch: 0,
      },
      baseMap: 'streets',
      enable3D: false,
      terrainExaggeration: 1.5,
    },
    coordinateSystem: {
      epsg: 4326,
      displayFormat: 'decimal',
    },
  });

  //const [drawMode, setDrawMode] = useState<'bbox' | 'polygon' | null>(null);
  const [adminLevels, setAdminLevels] = useState({
    country: 'JPN',
    level1: '',
    level2: '',
    level3: '',
  });

  useEffect(() => {
    // Draw existing coverage after map ready
    if (map.current && formData.coverage.type === 'bbox' && formData.coverage.bbox) {
      drawBoundingBox(formData.coverage.bbox);
    }
  }, [map.current]);

  const getMapStyle = (baseMap: string) => {
    const styles: Record<string, string> = {
      streets: 'https://demotiles.maplibre.org/style.json',
      satellite: 'https://demotiles.maplibre.org/style.json', // Replace with actual satellite style
      terrain: 'https://demotiles.maplibre.org/style.json', // Replace with actual terrain style
      light: 'https://demotiles.maplibre.org/style.json', // Replace with actual light style
      dark: 'https://demotiles.maplibre.org/style.json', // Replace with actual dark style
    };
    const url = styles[baseMap] || styles.streets;
    if (!url) {
      throw new Error(`Invalid base map: ${baseMap}`);
    }
    return url;
  };

  const drawBoundingBox = (bbox: BoundingBox) => {
    if (!map.current) return;

    // Remove existing bbox layer
    if (map.current.getLayer('bbox-layer')) {
      map.current.removeLayer('bbox-layer');
      map.current.removeSource('bbox-source');
    }

    const coordinates = [
      [bbox.minLon, bbox.minLat],
      [bbox.maxLon, bbox.minLat],
      [bbox.maxLon, bbox.maxLat],
      [bbox.minLon, bbox.maxLat],
      [bbox.minLon, bbox.minLat],
    ];

    map.current.addSource('bbox-source', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
        properties: {},
      },
    });

    map.current.addLayer({
      id: 'bbox-layer',
      type: 'fill',
      source: 'bbox-source',
      paint: {
        'fill-color': '#088',
        'fill-opacity': 0.3,
      },
    });

    map.current.addLayer({
      id: 'bbox-outline',
      type: 'line',
      source: 'bbox-source',
      paint: {
        'line-color': '#088',
        'line-width': 2,
      },
    });

    // Fit map to bbox
    map.current.fitBounds(
      [
        [bbox.minLon, bbox.minLat],
        [bbox.maxLon, bbox.maxLat],
      ],
      { padding: 50 }
    );
  };

  const handleCoverageTypeChange = (type: 'bbox' | 'polygon' | 'administrative' | 'custom') => {
    setFormData((prev) => ({
      ...prev,
      coverage: {
        ...prev.coverage,
        type,
      },
    }));
  };

  const handleBboxChange = (field: keyof BoundingBox, value: number) => {
    const newBbox = {
      ...formData.coverage.bbox,
      [field]: value,
    } as BoundingBox;

    setFormData((prev) => ({
      ...prev,
      coverage: {
        ...prev.coverage,
        bbox: newBbox,
      },
    }));

    drawBoundingBox(newBbox);
  };

  const handleMapConfigChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      mapConfig: {
        ...prev.mapConfig,
        [field]: value,
      },
    }));

    // ui-map receives mapStyle via props; handled by component rerender

    if (field === 'enable3D' && map.current) {
      if (value) {
        map.current.setPitch(45);
      } else {
        map.current.setPitch(0);
      }
    }
  };

  const handleDrawBbox = () => {
    // setDrawMode('bbox');
    // Implement interactive bbox drawing
    // This would use MapLibre GL Draw or custom implementation
  };

  /*
  const handleDrawPolygon = () => {
    setDrawMode('polygon');
    // Implement interactive polygon drawing
  };

  const handleSubmit = () => {
    onComplete({
      coverage: formData.coverage,
      mapConfig: formData.mapConfig
    });
  };

   */

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={3} sx={{ flex: 1, overflow: 'auto' }}>
        {/* Coverage Type Selection */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Coverage Area
          </Typography>
          <ToggleButtonGroup
            value={formData.coverage.type}
            exclusive
            onChange={(_, value) => value && handleCoverageTypeChange(value)}
            fullWidth
          >
            <ToggleButton value="bbox">
              <Stack alignItems="center" spacing={0.5}>
                <BboxIcon />
                <Typography variant="caption">Bounding Box</Typography>
              </Stack>
            </ToggleButton>
            <ToggleButton value="polygon">
              <Stack alignItems="center" spacing={0.5}>
                <PolygonIcon />
                <Typography variant="caption">Polygon</Typography>
              </Stack>
            </ToggleButton>
            <ToggleButton value="administrative">
              <Stack alignItems="center" spacing={0.5}>
                <AdminIcon />
                <Typography variant="caption">Administrative</Typography>
              </Stack>
            </ToggleButton>
            <ToggleButton value="custom">
              <Stack alignItems="center" spacing={0.5}>
                <CustomIcon />
                <Typography variant="caption">Custom</Typography>
              </Stack>
            </ToggleButton>
          </ToggleButtonGroup>
        </Grid>

        {/* Coverage Configuration */}
        {formData.coverage.type === 'bbox' && (
          <>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Bounding Box Coordinates
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Min Longitude"
                      type="number"
                      value={formData.coverage.bbox?.minLon || 0}
                      onChange={(e) => handleBboxChange('minLon', parseFloat(e.target.value))}
                      inputProps={{ step: 0.001 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Max Longitude"
                      type="number"
                      value={formData.coverage.bbox?.maxLon || 0}
                      onChange={(e) => handleBboxChange('maxLon', parseFloat(e.target.value))}
                      inputProps={{ step: 0.001 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Min Latitude"
                      type="number"
                      value={formData.coverage.bbox?.minLat || 0}
                      onChange={(e) => handleBboxChange('minLat', parseFloat(e.target.value))}
                      inputProps={{ step: 0.001 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Max Latitude"
                      type="number"
                      value={formData.coverage.bbox?.maxLat || 0}
                      onChange={(e) => handleBboxChange('maxLat', parseFloat(e.target.value))}
                      inputProps={{ step: 0.001 }}
                    />
                  </Grid>
                </Grid>
                <Button variant="outlined" onClick={handleDrawBbox} sx={{ mt: 2 }} fullWidth>
                  Draw on Map
                </Button>
              </Paper>
            </Grid>
          </>
        )}

        {formData.coverage.type === 'administrative' && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Administrative Boundaries
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Country (ISO 3166-1)"
                    value={adminLevels.country}
                    onChange={(e) =>
                      setAdminLevels((prev) => ({ ...prev, country: e.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Prefecture/State"
                    value={adminLevels.level1}
                    onChange={(e) =>
                      setAdminLevels((prev) => ({ ...prev, level1: e.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="City/District"
                    value={adminLevels.level2}
                    onChange={(e) =>
                      setAdminLevels((prev) => ({ ...prev, level2: e.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Town/Ward"
                    value={adminLevels.level3}
                    onChange={(e) =>
                      setAdminLevels((prev) => ({ ...prev, level3: e.target.value }))
                    }
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {formData.coverage.type === 'custom' && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Custom Area
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Center Longitude"
                    type="number"
                    value={formData.coverage.custom?.center[0] || 0}
                    inputProps={{ step: 0.001 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Center Latitude"
                    type="number"
                    value={formData.coverage.custom?.center[1] || 0}
                    inputProps={{ step: 0.001 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Radius (km)"
                    type="number"
                    value={formData.coverage.custom?.radius || 10}
                    inputProps={{ min: 1, max: 1000 }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Map Configuration */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Map Settings
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Base Map</InputLabel>
                  <Select
                    value={formData.mapConfig.baseMap}
                    onChange={(e) => handleMapConfigChange('baseMap', e.target.value)}
                    label="Base Map"
                  >
                    <MenuItem value="streets">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MapIcon fontSize="small" />
                        Streets
                      </Box>
                    </MenuItem>
                    <MenuItem value="satellite">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SatelliteIcon fontSize="small" />
                        Satellite
                      </Box>
                    </MenuItem>
                    <MenuItem value="terrain">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TerrainIcon fontSize="small" />
                        Terrain
                      </Box>
                    </MenuItem>
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.mapConfig.enable3D || false}
                      onChange={(e) => handleMapConfigChange('enable3D', e.target.checked)}
                    />
                  }
                  label="Enable 3D View"
                />
              </Grid>

              {formData.mapConfig.enable3D && (
                <Grid item xs={12}>
                  <Typography gutterBottom>
                    Terrain Exaggeration: {formData.mapConfig.terrainExaggeration}x
                  </Typography>
                  <Slider
                    value={formData.mapConfig.terrainExaggeration || 1.5}
                    onChange={(_, value) => handleMapConfigChange('terrainExaggeration', value)}
                    min={1}
                    max={5}
                    step={0.5}
                    marks
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Default View
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Zoom"
                      type="number"
                      value={formData.mapConfig.defaultView.zoom}
                      inputProps={{ min: 1, max: 20 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Bearing"
                      type="number"
                      value={formData.mapConfig.defaultView.bearing || 0}
                      inputProps={{ min: 0, max: 360 }}
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Map Preview */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="subtitle2" gutterBottom>
              Map Preview
            </Typography>
            <Box sx={{ width: '100%', height: 'calc(100% - 30px)', borderRadius: 1, overflow: 'hidden' }}>
              <MapLibreMap
                initialViewState={{
                  longitude: formData.mapConfig.defaultView.center[0],
                  latitude: formData.mapConfig.defaultView.center[1],
                  zoom: formData.mapConfig.defaultView.zoom,
                  bearing: formData.mapConfig.defaultView.bearing || 0,
                  pitch: formData.mapConfig.defaultView.pitch || 0,
                } as MapViewState}
                mapStyle={getMapStyle(formData.mapConfig.baseMap)}
                width="100%"
                height="100%"
                onLoad={(m) => { map.current = m; }}
                onViewStateChange={(vs) => {
                  setFormData((prev) => ({
                    ...prev,
                    mapConfig: { ...prev.mapConfig, defaultView: { center: [vs.longitude, vs.latitude], zoom: vs.zoom, bearing: vs.bearing || 0, pitch: vs.pitch || 0 } },
                  }));
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Coordinate System */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Coordinate System
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="EPSG Code"
                  type="number"
                  value={formData.coordinateSystem.epsg}
                  helperText="Default: 4326 (WGS84)"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Display Format</InputLabel>
                  <Select value={formData.coordinateSystem.displayFormat} label="Display Format">
                    <MenuItem value="decimal">Decimal Degrees</MenuItem>
                    <MenuItem value="dms">Degrees Minutes Seconds</MenuItem>
                    <MenuItem value="mgrs">MGRS</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
