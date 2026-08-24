/**
 * Location Map Preview Component
 */

import { DialogSafeMenu } from '@hierarchidb/ui-dialog';
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
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Fab,
  MenuItem,
  MenuList,
  Paper,
  Slider,
  Snackbar,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import type { LocationType } from '~/common/entities/LocationEntity';
import { LocationMapPreviewMarkers } from './LocationMapPreviewMarkers.js';
import type { LocationMapPreviewProps, PreviewLocationPoint } from './locationMapPreviewTypes.js';
import { useLocationMapPreview } from './useLocationMapPreview.js';

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

export const LocationMapPreview: React.FC<LocationMapPreviewProps> = ({
  nodeId,
  locations = SAMPLE_LOCATIONS,
}) => {
  const {
    t,
    formatTemplate,
    typeSettings,
    mapRef,
    displayMode,
    visibleTypes,
    zoom,
    center,
    selectedLocation,
    showSettings,
    searchQuery,
    settingsAnchor,
    hoverOpen,
    hoverMessage,
    heatmapIntensity,
    heatmapRadius,
    clusterRadius,
    maxZoom,
    statistics,
    markers,
    handleDisplayModeChange,
    handleTypeToggle,
    handleMapMouseMove,
    handleMapMouseLeave,
    handleZoomChange,
    handleMoveToCurrentLocation,
    handleFitToData,
    closeHover,
    setSearchQuery,
    setShowSettings,
    setSettingsAnchor,
    setHeatmapIntensity,
    setHeatmapRadius,
    setClusterRadius,
    setMaxZoom,
    setSelectedLocation,
  } = useLocationMapPreview({ nodeId, locations });

  const SelectedLocationIcon = selectedLocation
    ? typeSettings[selectedLocation.type]?.Icon
    : undefined;

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
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  Points
                </Typography>
              </ToggleButton>
              <ToggleButton value="clusters">
                <GroupWork fontSize="small" />
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  Clusters
                </Typography>
              </ToggleButton>
              <ToggleButton value="heatmap">
                <Whatshot fontSize="small" />
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  Heatmap
                </Typography>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/*
           */}
          <TextField
            size="small"
            fullWidth
            placeholder={String(t('mapPreview.searchPlaceholder', 'Search locations...'))}
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
                  t('mapPreview.visiblePointsLabel', 'Visible: {visible} / {total}'),
                  {
                    visible: statistics.visiblePoints.toLocaleString(),
                    total: statistics.totalPoints.toLocaleString(),
                  }
                )}
                size="small"
                color="primary"
              />
              {displayMode === 'clusters' && statistics.clusters > 0 && (
                <Chip
                  label={formatTemplate(t('mapPreview.clustersLabel', 'Clusters: {count}'), {
                    count: statistics.clusters,
                  })}
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
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <span>
                      <config.Icon fontSize="small" />
                    </span>
                    <span>
                      {config.name} ({count})
                    </span>
                  </Box>
                }
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
      <Box
        ref={mapRef}
        sx={{ flex: 1, position: 'relative', bgcolor: 'grey.100', borderRadius: 1 }}
        onMouseMove={handleMapMouseMove}
        onMouseLeave={handleMapMouseLeave}
      >
        <div
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
              {t('mapPreview.title', 'Map Preview')}
            </Typography>
            <Typography variant="body2" gutterBottom>
              {formatTemplate(t('mapPreview.displayModeLabel', 'Display: {mode}'), {
                mode: displayMode,
              })}
            </Typography>
            <Typography variant="body2" gutterBottom>
              {formatTemplate(t('mapPreview.visibleCountLabel', 'Visible: {visible}/{total}'), {
                count: statistics.visiblePoints.toLocaleString(),
              })}
            </Typography>
            <Typography variant="body2">
              {formatTemplate(t('mapPreview.centerLabel', 'Center: {lat}, {lng}'), {
                lat: center[1].toFixed(3),
                lng: center[0].toFixed(3),
              })}
            </Typography>
          </Box>
        </div>

        {displayMode === 'points' && markers.length > 0 ? (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          >
            <LocationMapPreviewMarkers markers={markers} />
          </Box>
        ) : null}

        {/*
         */}
        <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          <Box display="flex" flexDirection="column" gap={1}>
            <Tooltip title={t('mapPreview.tooltips.zoomIn', 'Zoom in')}>
              <Fab size="small" onClick={() => handleZoomChange(zoom + 1)} disabled={zoom >= 20}>
                <ZoomIn />
              </Fab>
            </Tooltip>

            <Tooltip title={t('mapPreview.tooltips.zoomOut', 'Zoom out')}>
              <Fab size="small" onClick={() => handleZoomChange(zoom - 1)} disabled={zoom <= 1}>
                <ZoomOut />
              </Fab>
            </Tooltip>

            <Tooltip title={t('mapPreview.tooltips.fitToData', 'Fit to data')}>
              <Fab size="small" onClick={handleFitToData}>
                <CenterFocusStrong />
              </Fab>
            </Tooltip>

            <Tooltip title={t('mapPreview.tooltips.currentLocation', 'Current location')}>
              <Fab size="small" onClick={handleMoveToCurrentLocation}>
                <MyLocation />
              </Fab>
            </Tooltip>

            <Tooltip title={t('mapPreview.tooltips.settings', 'Settings')}>
              <Fab size="small" onClick={(e) => setSettingsAnchor(e.currentTarget)}>
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

      <Snackbar
        open={hoverOpen && Boolean(hoverMessage)}
        onClose={closeHover}
        message={hoverMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/*
       */}
      <DialogSafeMenu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
      >
        <MenuList>
          <MenuItem onClick={() => setShowSettings(true)}>
            <Layers sx={{ mr: 1 }} />
            {t('mapPreview.menuSettings', 'Settings')}
          </MenuItem>
          <MenuItem onClick={() => console.log('Export view')}>
            <Info sx={{ mr: 1 }} />
            {t('mapPreview.menuAnalytics', 'Analytics')}
          </MenuItem>
        </MenuList>
      </DialogSafeMenu>

      {/*
       */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('mapPreview.dialogTitle', 'Map Preview Settings')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/*
             */}
            {displayMode === 'heatmap' && (
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('mapPreview.heatmapSettings', 'Heatmap Settings')}
                </Typography>
                <Box mb={2}>
                  <Typography gutterBottom>
                    {formatTemplate(t('mapPreview.heatmapIntensityLabel', 'Intensity: {value}'), {
                      value: heatmapIntensity,
                    })}
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
                    {formatTemplate(t('mapPreview.heatmapRadiusLabel', 'Radius: {value}'), {
                      value: heatmapRadius,
                    })}
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
                  {t('mapPreview.clusterSettings', 'Cluster Settings')}
                </Typography>
                <Box mb={2}>
                  <Typography gutterBottom>
                    {formatTemplate(t('mapPreview.clusterRadiusLabel', 'Cluster radius: {value}'), {
                      value: clusterRadius,
                    })}
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
                    {formatTemplate(t('mapPreview.maxZoomLabel', 'Max zoom: {value}'), {
                      value: maxZoom,
                    })}
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
          <Button onClick={() => setShowSettings(false)}>{t('mapPreview.close', 'Close')}</Button>
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
            {SelectedLocationIcon ? <SelectedLocationIcon fontSize="small" /> : null}{' '}
            {selectedLocation.name}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('mapPreview.details.englishName', 'English name')}
                </Typography>
                <Typography variant="body1">{selectedLocation.nameEn || 'N/A'}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('mapPreview.details.countryCode', 'Country code')}
                </Typography>
                <Typography variant="body1">{selectedLocation.countryCode}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('mapPreview.details.latitude', 'Latitude')}
                </Typography>
                <Typography variant="body1">
                  {selectedLocation.coordinates[1].toFixed(6)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('mapPreview.details.longitude', 'Longitude')}
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
              {t('mapPreview.close', 'Close')}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};
