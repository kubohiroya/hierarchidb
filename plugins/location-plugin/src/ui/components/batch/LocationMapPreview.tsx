/**
  * Location Map Preview Component
   */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Fab,
  Menu,
  MenuItem,
  MenuList,
  Paper,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  CenterFocusStrong,
  GroupWork,
  Info,
  Layers,
  LocationOn,
  MyLocation,
  Search,
  Settings,
  Whatshot,
  ZoomIn,
  ZoomOut,
} from '@mui/icons-material';
import type { LocationType, NodeId } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';

export interface PreviewLocationPoint {
  id: string;
  name: string;
  nameEn?: string;
  type: LocationType;
  countryCode: string;
  coordinates: [number, number]; // [longitude, latitude]
  properties: Record<string, unknown>;
}

export type DisplayMode = 'points' | 'clusters' | 'heatmap';

export interface MapStatistics {
  totalPoints: number;
  visiblePoints: number;
  clusters: number;
  density: number;
  viewport: {
    bounds: [[number, number], [number, number]]; // [[west, south], [east, north]]
    zoom: number;
    center: [number, number];
  };
  distribution: {
    byType: Record<LocationType, number>;
    byCountry: Record<string, number>;
  };
}

export interface LocationMapPreviewProps {
  nodeId: NodeId;
  locations: PreviewLocationPoint[];
  onLocationSelect?: (location: PreviewLocationPoint) => void;
}

//  props
const SAMPLE_LOCATIONS: PreviewLocationPoint[] = [
  {
    id: '1',
    name: 'Narita International Airport',
    nameEn: 'Narita International Airport',
    type: 'airport' as LocationType,
    countryCode: 'JPN',
    coordinates: [140.3862, 35.7653],
    properties: { capacity: 30000000 },
  },
  {
    id: '2',
    name: 'Tokyo Station',
    nameEn: 'Tokyo Station',
    type: 'railway_station' as LocationType,
    countryCode: 'JPN',
    coordinates: [139.7673, 35.6812],
    properties: { elevation: 6 },
  },
  {
    id: '3',
    name: 'Port of Yokohama',
    nameEn: 'Port of Yokohama',
    type: 'port' as LocationType,
    countryCode: 'JPN',
    coordinates: [139.6425, 35.4437],
    properties: { capacity: 45000000 },
  },
  {
    id: '4',
    name: 'Shinjuku Ward Centroid',
    nameEn: 'Shinjuku Ward Centroid',
    type: 'area_centroid' as LocationType,
    countryCode: 'JPN',
    coordinates: [139.7036, 35.6938],
    properties: { adminLevel: 3 },
  },
];

const TYPE_SETTINGS_BASE: Partial<Record<LocationType, {
  color: string;
  icon: string;
  defaultVisible: boolean;
}>> = {
  area_centroid: { color: '#6A5ACD', icon: '🎯', defaultVisible: true },
  airport: { color: '#2196F3', icon: '✈️', defaultVisible: true },
  port: { color: '#FF9800', icon: '🚢', defaultVisible: true },
  railway_station: { color: '#4CAF50', icon: '🚉', defaultVisible: true },
  interchange: { color: '#FFA000', icon: '🛣️', defaultVisible: true },
};

export const LocationMapPreview: React.FC<LocationMapPreviewProps> = ({
  locations = SAMPLE_LOCATIONS,
}) => {
  const { translations } = useTranslation();
  const mapPreviewTranslations = translations.mapPreview ?? {};
  const formatTemplate = useCallback((template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((acc, [key, value]) => acc?.replace(new RegExp(`{${key}}`, 'g'), String(value)), template),
  []);
  const typeSettings = useMemo(() => Object.fromEntries(
    (Object.entries(TYPE_SETTINGS_BASE) as Array<[LocationType, NonNullable<(typeof TYPE_SETTINGS_BASE)[LocationType]>]>)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => [key, { ...value, name: translations.locationTypes?.[key] ?? key }]),
  ) as Record<LocationType, NonNullable<(typeof TYPE_SETTINGS_BASE)[LocationType]> & { name: string }> , [translations.locationTypes ?? {}]);
  const mapRef = useRef<HTMLDivElement>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('points');
  const [visibleTypes, setVisibleTypes] = useState<LocationType[]>(
    Object.keys(TYPE_SETTINGS_BASE).filter((type) =>
      TYPE_SETTINGS_BASE[type as LocationType]?.defaultVisible,
    ) as LocationType[],
  );
  const [zoom, setZoom] = useState(10);
  const [center, setCenter] = useState<[number, number]>([139.7, 35.7]); // Tokyo
  const [selectedLocation, setSelectedLocation] = useState<PreviewLocationPoint | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

  const [heatmapIntensity, setHeatmapIntensity] = useState(1.0);
  const [heatmapRadius, setHeatmapRadius] = useState(20);

  const [clusterRadius, setClusterRadius] = useState(50);
  const [maxZoom, setMaxZoom] = useState(15);

  const filteredLocations = useMemo(() => {
    return locations.filter(location => {
      if (!visibleTypes.includes(location.type)) {
        return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = location.name.toLowerCase().includes(query) ||
          location.nameEn?.toLowerCase().includes(query);
        const matchesCountry = location.countryCode.toLowerCase().includes(query);
        const matchesType = (typeSettings[location.type]?.name ?? location.type).toLowerCase().includes(query);

        if (!matchesName && !matchesCountry && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }, [locations, visibleTypes, searchQuery, typeSettings]);

  const statistics: MapStatistics = useMemo(() => {
    const byType: Record<string, number> = {};
    const byCountry: Record<string, number> = {};

    filteredLocations.forEach(location => {
      byType[location.type] = (byType[location.type] || 0) + 1;
      byCountry[location.countryCode] = (byCountry[location.countryCode] || 0) + 1;
    });

    return {
      totalPoints: locations.length,
      visiblePoints: filteredLocations.length,
      clusters: displayMode === 'clusters' ? Math.ceil(filteredLocations.length / 10) : 0,
      density: filteredLocations.length / 100, viewport: {
        bounds: [[-180, -90], [180, 90]],
        zoom,
        center,
      },
      distribution: {
        byType: byType as Record<LocationType, number>,
        byCountry,
      },
    };
  }, [filteredLocations, locations.length, displayMode, zoom, center]);

  const handleDisplayModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: DisplayMode | null,
  ) => {
    if (newMode !== null) {
      setDisplayMode(newMode);
    }
  };

  const handleTypeToggle = (type: LocationType) => {
    setVisibleTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type],
    );
  };


  const handleZoomChange = (newZoom: number) => {
    setZoom(Math.max(1, Math.min(20, newZoom)));
  };

  const handleMoveToCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition((position) => {
      setCenter([position.coords.longitude, position.coords.latitude]);
      setZoom(15);
    });
  };

  const handleFitToData = () => {
    if (filteredLocations.length === 0) return;

    const lngs = filteredLocations.map(l => l.coordinates[0]);
    const lats = filteredLocations.map(l => l.coordinates[1]);

    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

    setCenter([centerLng, centerLat]);
    setZoom(8);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/*
*/}
      <Paper elevation={1} sx={{ p: 2, mb: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(3, minmax(0, 1fr))',
            },
            alignItems: 'center',
          }}
        >
          {/*
*/}
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <ToggleButtonGroup
              value={displayMode}
              exclusive
              onChange={handleDisplayModeChange}
              size="small"
            >
              <ToggleButton value="points">
                <LocationOn fontSize="small" />
                <Typography variant="caption" sx={{ ml: 0.5 }}>Points</Typography>
              </ToggleButton>
              <ToggleButton value="clusters">
                <GroupWork fontSize="small" />
                <Typography variant="caption" sx={{ ml: 0.5 }}>Clusters</Typography>
              </ToggleButton>
              <ToggleButton value="heatmap">
                <Whatshot fontSize="small" />
                <Typography variant="caption" sx={{ ml: 0.5 }}>Heatmap</Typography>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/*
*/}
          <TextField
            size="small"
            fullWidth
            placeholder={mapPreviewTranslations.searchPlaceholder ?? 'Search locations...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />,
            }}
            sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
          />

          {/*
*/}
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip
                label={formatTemplate(
                  mapPreviewTranslations.visiblePointsLabel ?? 'Visible: {visible} / {total}',
                  {
                    visible: statistics.visiblePoints.toLocaleString(),
                    total: statistics.totalPoints.toLocaleString(),
                  },
                )}
                size="small"
                color="primary"
              />
              {displayMode === 'clusters' && statistics.clusters > 0 && (
                <Chip
                  label={formatTemplate(
                    mapPreviewTranslations.clustersLabel ?? 'Clusters: {count}',
                    {
                      count: statistics.clusters,
                    },
                  )}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        </Box>

        {/*
*/}
        <Box mt={2} display="flex" gap={1} flexWrap="wrap">
          {Object.entries(typeSettings).map(([type, config]) => {
            const count = statistics.distribution.byType[type as LocationType] || 0;
            const isVisible = visibleTypes.includes(type as LocationType);

            return (
              <Chip
                key={type}
                label={`${config.icon} ${config.name} (${count})`}
                variant={isVisible ? 'filled' : 'outlined'}
                color={isVisible ? 'primary' : 'default'}
                onClick={() => handleTypeToggle(type as LocationType)}
                sx={{
                  backgroundColor: isVisible ? config.color : 'transparent',
                  '&:hover': {
                    backgroundColor: isVisible ? config.color : 'action.hover',
                  },
                }}
              />
            );
          })}
        </Box>
      </Paper>

      {/*
*/}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: 'grey.100', borderRadius: 1 }}>
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary',
          }}
        >
          {/*
 MapLibre GL
*/}
          <Box textAlign="center">
            <Typography variant="h6" gutterBottom>
              {translations.mapPreview.title}
            </Typography>
            <Typography variant="body2" gutterBottom>
              {formatTemplate(translations.mapPreview.displayModeLabel, { mode: displayMode })}
            </Typography>
            <Typography variant="body2" gutterBottom>
              {formatTemplate(translations.mapPreview.visibleCountLabel, {
                count: statistics.visiblePoints.toLocaleString(),
              })}
            </Typography>
            <Typography variant="body2">
              {formatTemplate(translations.mapPreview.centerLabel, {
                lat: center[1].toFixed(3),
                lng: center[0].toFixed(3),
              })}
            </Typography>
          </Box>
        </div>

        {/*
*/}
        <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          <Box display="flex" flexDirection="column" gap={1}>
            <Tooltip title={translations.mapPreview.tooltips?.zoomIn}>
              <Fab
                size="small"
                onClick={() => handleZoomChange(zoom + 1)}
                disabled={zoom >= 20}
              >
                <ZoomIn />
              </Fab>
            </Tooltip>

            <Tooltip title={translations.mapPreview.tooltips?.zoomOut}>
              <Fab
                size="small"
                onClick={() => handleZoomChange(zoom - 1)}
                disabled={zoom <= 1}
              >
                <ZoomOut />
              </Fab>
            </Tooltip>

            <Tooltip title={translations.mapPreview.tooltips?.fitToData}>
              <Fab size="small" onClick={handleFitToData}>
                <CenterFocusStrong />
              </Fab>
            </Tooltip>

            <Tooltip title={translations.mapPreview.tooltips?.currentLocation}>
              <Fab size="small" onClick={handleMoveToCurrentLocation}>
                <MyLocation />
              </Fab>
            </Tooltip>

            <Tooltip title={translations.mapPreview.tooltips?.settings}>
              <Fab
                size="small"
                onClick={(e) => setSettingsAnchor(e.currentTarget)}
              >
                <Settings />
              </Fab>
            </Tooltip>
          </Box>
        </Box>

        {/*
*/}
        <Box sx={{ position: 'absolute', bottom: 16, left: 16 }}>
          <Chip
            label={`Zoom: ${zoom}`}
            size="small"
            variant="outlined"
            sx={{ bgcolor: 'background.paper' }}
          />
        </Box>
      </Box>

      {/*
*/}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
      >
        <MenuList>
          <MenuItem onClick={() => setShowSettings(true)}>
            <Layers sx={{ mr: 1 }} />
            {translations.mapPreview.menuSettings}
          </MenuItem>
          <MenuItem onClick={() => console.log('Export view')}>
            <Info sx={{ mr: 1 }} />
            {translations.mapPreview.menuAnalytics}
          </MenuItem>
        </MenuList>
      </Menu>

      {/*
*/}
      <Dialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{translations.mapPreview.dialogTitle}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/*
*/}
            {displayMode === 'heatmap' && (
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  {translations.mapPreview.heatmapSettings}
                </Typography>
                <Box mb={2}>
                  <Typography gutterBottom>
                    {formatTemplate(translations.mapPreview.heatmapIntensityLabel, { value: heatmapIntensity })}
                  </Typography>
                  <Slider
                    value={heatmapIntensity}
                    onChange={(_, value) => setHeatmapIntensity(value as number)}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    marks={[
                      { value: 0.5, label: '0.5' },
                      { value: 1.0, label: '1.0' },
                      { value: 1.5, label: '1.5' },
                    ]}
                  />
                </Box>
                <Box mb={2}>
                  <Typography gutterBottom>
                    {formatTemplate(translations.mapPreview.heatmapRadiusLabel, { value: heatmapRadius })}
                  </Typography>
                  <Slider
                    value={heatmapRadius}
                    onChange={(_, value) => setHeatmapRadius(value as number)}
                    min={10}
                    max={50}
                    step={5}
                    marks={[
                      { value: 20, label: '20px' },
                      { value: 30, label: '30px' },
                      { value: 40, label: '40px' },
                    ]}
                  />
                </Box>
              </Box>
            )}

            {/*
*/}
            {displayMode === 'clusters' && (
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  {translations.mapPreview.clusterSettings}
                </Typography>
                <Box mb={2}>
                  <Typography gutterBottom>
                    {formatTemplate(translations.mapPreview.clusterRadiusLabel, { value: clusterRadius })}
                  </Typography>
                  <Slider
                    value={clusterRadius}
                    onChange={(_, value) => setClusterRadius(value as number)}
                    min={20}
                    max={100}
                    step={10}
                    marks={[
                      { value: 30, label: '30px' },
                      { value: 50, label: '50px' },
                      { value: 80, label: '80px' },
                    ]}
                  />
                </Box>
                <Box mb={2}>
                  <Typography gutterBottom>
                    {formatTemplate(translations.mapPreview.maxZoomLabel, { value: maxZoom })}
                  </Typography>
                  <Slider
                    value={maxZoom}
                    onChange={(_, value) => setMaxZoom(value as number)}
                    min={10}
                    max={20}
                    step={1}
                    marks={[
                      { value: 12, label: '12' },
                      { value: 15, label: '15' },
                      { value: 18, label: '18' },
                    ]}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogContent>
          <Button onClick={() => setShowSettings(false)}>
            {translations.mapPreview.close}
          </Button>
        </DialogContent>
      </Dialog>

      {/*
*/}
      {selectedLocation && (
        <Dialog
          open={!!selectedLocation}
          onClose={() => setSelectedLocation(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {typeSettings[selectedLocation.type]?.icon} {selectedLocation.name}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {translations.mapPreview.details.englishName}
                </Typography>
                <Typography variant="body1">
                  {selectedLocation.nameEn || 'N/A'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {translations.mapPreview.details.countryCode}
                </Typography>
                <Typography variant="body1">
                  {selectedLocation.countryCode}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {translations.mapPreview.details.latitude}
                </Typography>
                <Typography variant="body1">
                  {selectedLocation.coordinates[1].toFixed(6)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {translations.mapPreview.details.longitude}
                </Typography>
                <Typography variant="body1">
                  {selectedLocation.coordinates[0].toFixed(6)}
                </Typography>
              </Grid>
              {Object.entries(selectedLocation.properties).map(([key, value]) => (
                <Grid key={key} size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {key}
                  </Typography>
                  <Typography variant="body1">
                    {typeof value === 'number' ? value.toLocaleString() : String(value)}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </DialogContent>
        <DialogContent>
          <Button onClick={() => setSelectedLocation(null)}>
            {translations.mapPreview.close}
          </Button>
        </DialogContent>
      </Dialog>
      )}
    </Box>
  );
};
