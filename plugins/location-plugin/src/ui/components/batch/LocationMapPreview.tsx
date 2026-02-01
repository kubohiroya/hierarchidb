/**
  * Location Map Preview Component
   */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
  Snackbar,
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
  Place,
  MyLocation,
  Search,
  Settings,
  Whatshot,
  ZoomIn,
  ZoomOut,
} from '@mui/icons-material';
import type { LocationType, NodeId } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { LOCATION_TYPE_STYLES } from '../steps/locationTypes.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import type { LocationNearestPointResponse } from '@hierarchidb/location-api';

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

type TypeStyle = {
  color: string;
  icon: ReactNode;
  altIcon?: ReactNode;
  defaultVisible: boolean;
};

const TYPE_SETTINGS_BASE: Partial<Record<LocationType, TypeStyle>> = Object.fromEntries(
  (Object.entries(LOCATION_TYPE_STYLES) as Array<[LocationType, typeof LOCATION_TYPE_STYLES[LocationType]]>)
    .map(([key, value]) => {
      const Icon = value.icon;
      const AltIcon = value.altIcon;
      return [
        key,
        {
          color: value.color,
          icon: <Icon fontSize="small" />,
          altIcon: AltIcon ? <AltIcon fontSize="small" /> : undefined,
          defaultVisible: true,
        },
      ];
    }),
) as Partial<Record<LocationType, TypeStyle>>;

const ICON_DENSITY_THRESHOLD = 0.001;
const resolveMarkerSize = (zoom: number) => Math.max(3, Math.min(14, Math.round(3 + zoom / 1.6)));
const resolveIconSize = (zoom: number) => Math.max(10, Math.min(26, Math.round(10 + zoom * 0.8)));
const HOVER_DISTANCE_PX = 16;

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const resolveMetersPerPixel = (
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  mapSize: { width: number; height: number },
  longitude: number,
  latitude: number,
): number | null => {
  if (mapSize.width <= 0 || mapSize.height <= 0) return null;
  const lonStep = (bounds.maxLon - bounds.minLon) / mapSize.width;
  const latStep = (bounds.maxLat - bounds.minLat) / mapSize.height;
  const lonMeters = haversineMeters(latitude, longitude, latitude, longitude + lonStep);
  const latMeters = haversineMeters(latitude, longitude, latitude + latStep, longitude);
  const metersPerPixel = (Math.abs(lonMeters) + Math.abs(latMeters)) / 2;
  return Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? metersPerPixel : null;
};

export const LocationMapPreview: React.FC<LocationMapPreviewProps> = ({
  nodeId,
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
  ) as Record<LocationType, NonNullable<(typeof TYPE_SETTINGS_BASE)[LocationType]> & { name: string }>, [translations.locationTypes]);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
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
  const [hoverInfo, setHoverInfo] = useState<LocationNearestPointResponse | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [hoverPointId, setHoverPointId] = useState<string | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const hoverRequestIdRef = useRef(0);
  const lastHoverRef = useRef<{ longitude: number; latitude: number; zoom: number } | null>(null);
  const workerBridgeRef = useRef(getWorkerBridge());

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

  const bounds = useMemo(() => {
    if (filteredLocations.length === 0) return null;
    const lngs = filteredLocations.map((loc) => loc.coordinates[0]);
    const lats = filteredLocations.map((loc) => loc.coordinates[1]);
    let minLon = Math.min(...lngs);
    let maxLon = Math.max(...lngs);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    if (minLon === maxLon) {
      minLon -= 0.5;
      maxLon += 0.5;
    }
    if (minLat === maxLat) {
      minLat -= 0.5;
      maxLat += 0.5;
    }
    return { minLon, maxLon, minLat, maxLat };
  }, [filteredLocations]);

  const hoverBounds = useMemo(() => {
    if (bounds) return bounds;
    return { minLon: -180, maxLon: 180, minLat: -85, maxLat: 85 };
  }, [bounds]);

  const useIconMarkers = useMemo(() => {
    if (displayMode !== 'points') return false;
    const area = mapSize.width * mapSize.height;
    if (area <= 0) return true;
    return (filteredLocations.length / area) <= ICON_DENSITY_THRESHOLD;
  }, [displayMode, filteredLocations.length, mapSize.height, mapSize.width]);

  const resolvePointIcon = useCallback((point: PreviewLocationPoint) => {
    const base = typeSettings[point.type];
    if (!base) return <Place fontSize="small" />;
    if (point.type === 'area_centroid' && base.altIcon) {
      return point.properties?.admin1 ? base.altIcon : base.icon;
    }
    return base.icon;
  }, [typeSettings]);

  const markers = useMemo(() => {
    if (!bounds || displayMode !== 'points' || mapSize.width === 0 || mapSize.height === 0) return null;
    const size = resolveMarkerSize(zoom);
    const iconSize = resolveIconSize(zoom);
    const { minLon, maxLon, minLat, maxLat } = bounds;
    const scaleX = mapSize.width / (maxLon - minLon);
    const scaleY = mapSize.height / (maxLat - minLat);
    return filteredLocations.map((point) => {
      const [lon, lat] = point.coordinates;
      const x = (lon - minLon) * scaleX;
      const y = (maxLat - lat) * scaleY;
      const style = typeSettings[point.type];
      const color = style?.color ?? '#607D8B';
      const title = `${point.name} (${point.type})`;
      const isHovered = hoverPointId != null && point.id === hoverPointId;
      const emphasisScale = isHovered ? 1.8 : 1;
      if (!useIconMarkers) {
        return (
          <Box
            key={point.id}
            title={title}
            sx={{
              position: 'absolute',
              left: x - (size * emphasisScale) / 2,
              top: y - (size * emphasisScale) / 2,
              width: size * emphasisScale,
              height: size * emphasisScale,
              bgcolor: color,
              borderRadius: 0,
              opacity: 0.85,
              boxShadow: isHovered ? `0 0 12px ${color}` : 'none',
              zIndex: isHovered ? 2 : 1,
            }}
          />
        );
      }
      return (
        <Box
          key={point.id}
          title={title}
          sx={{
            position: 'absolute',
            left: x - (iconSize * emphasisScale) / 2,
            top: y - (iconSize * emphasisScale) / 2,
            color,
            opacity: 0.95,
            filter: isHovered ? `drop-shadow(0 0 6px ${color})` : 'none',
            zIndex: isHovered ? 2 : 1,
            '& svg': { fontSize: iconSize * emphasisScale },
          }}
        >
          {resolvePointIcon(point)}
        </Box>
      );
    });
  }, [bounds, displayMode, filteredLocations, hoverPointId, mapSize.height, mapSize.width, resolvePointIcon, typeSettings, useIconMarkers, zoom]);

  useEffect(() => {
    if (!mapRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setMapSize({ width, height });
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

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

  const scheduleHoverLookup = useCallback((longitude: number, latitude: number) => {
    if (!nodeId || String(nodeId) === 'preview' || mapSize.width === 0 || mapSize.height === 0) return;
    const zoomLevel = Math.max(0, Math.min(24, Math.round(zoom)));
    const last = lastHoverRef.current;
    if (last) {
      const lonDelta = Math.abs(last.longitude - longitude);
      const latDelta = Math.abs(last.latitude - latitude);
      if (last.zoom === zoomLevel && lonDelta < 0.0001 && latDelta < 0.0001) {
        return;
      }
    }
    lastHoverRef.current = { longitude, latitude, zoom: zoomLevel };
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      const requestId = ++hoverRequestIdRef.current;
      void (async () => {
        try {
          const api = await workerBridgeRef.current.getLocationQueryAPI();
          const metersPerPixel = resolveMetersPerPixel(hoverBounds, mapSize, longitude, latitude);
          if (!metersPerPixel) {
            setHoverInfo(null);
            setHoverOpen(false);
            setHoverPointId(null);
            return;
          }
          const result = await api.findNearestLocationPoint({
            nodeId,
            longitude,
            latitude,
            zoom: zoomLevel,
            maxDistanceMeters: metersPerPixel * HOVER_DISTANCE_PX,
          });
          if (hoverRequestIdRef.current !== requestId) return;
          setHoverInfo(result);
          const nearest = result.matches[0]?.point;
          setHoverOpen(Boolean(nearest));
          setHoverPointId(nearest?.id ?? null);
        } catch (error) {
          if (hoverRequestIdRef.current === requestId) {
            setHoverInfo(null);
            setHoverOpen(false);
            setHoverPointId(null);
          }
          console.warn('[LocationMapPreview] hover lookup failed', error);
        }
      })();
    }, 120);
  }, [hoverBounds, mapSize, nodeId, zoom]);

  const handleMapMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    const longitude = hoverBounds.minLon + (x / rect.width) * (hoverBounds.maxLon - hoverBounds.minLon);
    const latitude = hoverBounds.maxLat - (y / rect.height) * (hoverBounds.maxLat - hoverBounds.minLat);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    scheduleHoverLookup(longitude, latitude);
  }, [hoverBounds, scheduleHoverLookup]);

  const handleMapMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverOpen(false);
    setHoverPointId(null);
  }, []);

  const hoverMessage = useMemo(() => {
    const nearest = hoverInfo?.matches[0]?.point;
    if (!nearest) return '';
    const typeLabel = nearest.type && typeSettings[nearest.type as LocationType]?.name
      ? typeSettings[nearest.type as LocationType].name
      : nearest.type ?? 'unknown';
    const countryLabel = nearest.admin0 ?? '';
    const regionLabel = nearest.region ?? '';
    const latText = Number.isFinite(nearest.latitude) ? nearest.latitude.toFixed(5) : String(nearest.latitude);
    const lonText = Number.isFinite(nearest.longitude) ? nearest.longitude.toFixed(5) : String(nearest.longitude);
    const parts = [
      typeLabel,
      nearest.name ?? 'Unknown',
      countryLabel,
      regionLabel,
      `(${latText}, ${lonText})`,
    ].filter(Boolean);
    return parts.join(' / ');
  }, [hoverInfo, typeSettings]);

  useEffect(() => () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
  }, []);


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
                label={(
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <span>{config.icon}</span>
                    <span>{config.name} ({count})</span>
                  </Box>
                )}
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

        {displayMode === 'points' && markers ? (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          >
            {markers}
          </Box>
        ) : null}

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

      <Snackbar
        open={hoverOpen && Boolean(hoverMessage)}
        onClose={() => setHoverOpen(false)}
        message={hoverMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

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
