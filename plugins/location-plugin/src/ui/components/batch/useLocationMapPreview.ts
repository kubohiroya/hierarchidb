import type { LocationNearestPointResponse } from '@hierarchidb/location-api';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { Place } from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocationType, NodeId } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { LOCATION_TYPE_STYLES } from '../steps/locationTypes.js';
import type { LocationMapPreviewMarkerEntry } from './LocationMapPreviewElements.js';
import type {
  DisplayMode,
  MapStatistics,
  PreviewLocationPoint,
} from './locationMapPreviewTypes.js';

const ICON_DENSITY_THRESHOLD = 0.001;
const HOVER_DISTANCE_PX = 16;

type TypeStyle = {
  color: string;
  Icon: SvgIconComponent;
  AltIcon?: SvgIconComponent;
  defaultVisible: boolean;
};

type LocationTypeStyle = {
  color: string;
  icon: SvgIconComponent;
  altIcon?: SvgIconComponent;
};

const TYPE_SETTINGS_BASE: Partial<Record<LocationType, TypeStyle>> = Object.fromEntries(
  (Object.entries(LOCATION_TYPE_STYLES) as Array<[LocationType, LocationTypeStyle]>).map(
    ([key, value]) => {
      const Icon = value.icon;
      const AltIcon = value.altIcon;
      return [
        key,
        {
          color: value.color,
          Icon,
          AltIcon,
          defaultVisible: true,
        },
      ];
    }
  )
) as Partial<Record<LocationType, TypeStyle>>;

const resolveMarkerSize = (zoom: number) => Math.max(3, Math.min(14, Math.round(3 + zoom / 1.6)));
const resolveIconSize = (zoom: number) => Math.max(10, Math.min(26, Math.round(10 + zoom * 0.8)));

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const resolveMetersPerPixel = (
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  mapSize: { width: number; height: number },
  longitude: number,
  latitude: number
): number | null => {
  if (mapSize.width <= 0 || mapSize.height <= 0) return null;
  const lonStep = (bounds.maxLon - bounds.minLon) / mapSize.width;
  const latStep = (bounds.maxLat - bounds.minLat) / mapSize.height;
  const lonMeters = haversineMeters(latitude, longitude, latitude, longitude + lonStep);
  const latMeters = haversineMeters(latitude, longitude, latitude + latStep, longitude);
  const metersPerPixel = (Math.abs(lonMeters) + Math.abs(latMeters)) / 2;
  return Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? metersPerPixel : null;
};

type UseLocationMapPreviewArgs = {
  nodeId: NodeId;
  locations: PreviewLocationPoint[];
};

type UseLocationMapPreviewResult = {
  translations: ReturnType<typeof useTranslation>['translations'];
  mapPreviewTranslations: ReturnType<typeof useTranslation>['translations']['mapPreview'];
  formatTemplate: (template: string, values: Record<string, string | number>) => string;
  typeSettings: Record<LocationType, TypeStyle & { name: string }>;
  mapRef: React.RefObject<HTMLDivElement>;
  displayMode: DisplayMode;
  visibleTypes: LocationType[];
  zoom: number;
  center: [number, number];
  selectedLocation: PreviewLocationPoint | null;
  showSettings: boolean;
  searchQuery: string;
  settingsAnchor: HTMLElement | null;
  hoverOpen: boolean;
  hoverMessage: string;
  heatmapIntensity: number;
  heatmapRadius: number;
  clusterRadius: number;
  maxZoom: number;
  statistics: MapStatistics;
  markers: LocationMapPreviewMarkerEntry[];
  handleDisplayModeChange: (_: React.MouseEvent<HTMLElement>, newMode: DisplayMode | null) => void;
  handleTypeToggle: (type: LocationType) => void;
  handleMapMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleMapMouseLeave: () => void;
  handleZoomChange: (newZoom: number) => void;
  handleMoveToCurrentLocation: () => void;
  handleFitToData: () => void;
  closeHover: () => void;
  setSearchQuery: (value: string) => void;
  setShowSettings: (value: boolean) => void;
  setSettingsAnchor: (value: HTMLElement | null) => void;
  setHeatmapIntensity: (value: number) => void;
  setHeatmapRadius: (value: number) => void;
  setClusterRadius: (value: number) => void;
  setMaxZoom: (value: number) => void;
  setSelectedLocation: (value: PreviewLocationPoint | null) => void;
};

export const useLocationMapPreview = (
  args: UseLocationMapPreviewArgs
): UseLocationMapPreviewResult => {
  const { nodeId, locations } = args;
  const { translations } = useTranslation();
  const mapPreviewTranslations = translations.mapPreview;
  const formatTemplate = useCallback(
    (template: string, values: Record<string, string | number>) =>
      Object.entries(values).reduce(
        (acc, [key, value]) => acc?.replace(new RegExp(`{${key}}`, 'g'), String(value)),
        template
      ),
    []
  );
  const typeSettings = useMemo(
    () =>
      Object.fromEntries(
        (
          Object.entries(TYPE_SETTINGS_BASE) as Array<
            [LocationType, NonNullable<(typeof TYPE_SETTINGS_BASE)[LocationType]>]
          >
        )
          .filter(([, value]) => Boolean(value))
          .map(([key, value]) => [key, { ...value, name: translations.locationTypes?.[key] ?? key }])
      ) as Record<LocationType, TypeStyle & { name: string }>,
    [translations.locationTypes]
  );
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [displayMode, setDisplayMode] = useState<DisplayMode>('points');
  const [visibleTypes, setVisibleTypes] = useState<LocationType[]>(
    Object.keys(TYPE_SETTINGS_BASE).filter((type) =>
      TYPE_SETTINGS_BASE[type as LocationType]?.defaultVisible
    ) as LocationType[]
  );
  const [zoom, setZoom] = useState(10);
  const [center, setCenter] = useState<[number, number]>([139.7, 35.7]);
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
    return locations.filter((location) => {
      if (!visibleTypes.includes(location.type)) {
        return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName =
          location.name.toLowerCase().includes(query) ||
          location.nameEn?.toLowerCase().includes(query);
        const matchesCountry = location.countryCode.toLowerCase().includes(query);
        const matchesType = (typeSettings[location.type]?.name ?? location.type)
          .toLowerCase()
          .includes(query);

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

    filteredLocations.forEach((location) => {
      byType[location.type] = (byType[location.type] || 0) + 1;
      byCountry[location.countryCode] = (byCountry[location.countryCode] || 0) + 1;
    });

    return {
      totalPoints: locations.length,
      visiblePoints: filteredLocations.length,
      clusters: displayMode === 'clusters' ? Math.ceil(filteredLocations.length / 10) : 0,
      density: filteredLocations.length / 100,
      viewport: {
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
    return filteredLocations.length / area <= ICON_DENSITY_THRESHOLD;
  }, [displayMode, filteredLocations.length, mapSize.height, mapSize.width]);

  const resolvePointIcon = useCallback(
    (point: PreviewLocationPoint): SvgIconComponent => {
      const base = typeSettings[point.type];
      if (!base) return Place;
      if (point.type === 'area_centroid' && base.AltIcon) {
        return point.properties?.admin1 ? base.AltIcon : base.Icon;
      }
      return base.Icon;
    },
    [typeSettings]
  );

  const markers = useMemo<LocationMapPreviewMarkerEntry[]>(() => {
    if (!bounds || displayMode !== 'points' || mapSize.width === 0 || mapSize.height === 0) {
      return [];
    }
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
        const markerSize = size * emphasisScale;
        return {
          id: point.id,
          title,
          left: x - markerSize / 2,
          top: y - markerSize / 2,
          size: markerSize,
          color,
          isHovered,
          useIcon: false,
        };
      }
      const icon = resolvePointIcon(point);
      const scaledIconSize = iconSize * emphasisScale;
      return {
        id: point.id,
        title,
        left: x - scaledIconSize / 2,
        top: y - scaledIconSize / 2,
        size: scaledIconSize,
        iconSize: scaledIconSize,
        color,
        isHovered,
        useIcon: true,
        Icon: icon,
      };
    });
  }, [
    bounds,
    displayMode,
    filteredLocations,
    hoverPointId,
    mapSize.height,
    mapSize.width,
    resolvePointIcon,
    typeSettings,
    useIconMarkers,
    zoom,
  ]);

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

  const handleDisplayModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMode: DisplayMode | null) => {
      if (newMode !== null) {
        setDisplayMode(newMode);
      }
    },
    []
  );

  const handleTypeToggle = useCallback((type: LocationType) => {
    setVisibleTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }, []);

  const scheduleHoverLookup = useCallback(
    (longitude: number, latitude: number) => {
      if (!nodeId || String(nodeId) === 'preview' || mapSize.width === 0 || mapSize.height === 0)
        return;
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
    },
    [hoverBounds, mapSize, nodeId, zoom]
  );

  const handleMapMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      const longitude = hoverBounds.minLon + (x / rect.width) * (hoverBounds.maxLon - hoverBounds.minLon);
      const latitude = hoverBounds.maxLat - (y / rect.height) * (hoverBounds.maxLat - hoverBounds.minLat);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
      scheduleHoverLookup(longitude, latitude);
    },
    [hoverBounds, scheduleHoverLookup]
  );

  const handleMapMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverOpen(false);
    setHoverPointId(null);
  }, []);

  const closeHover = useCallback(() => {
    setHoverOpen(false);
  }, []);

  const hoverMessage = useMemo(() => {
    const nearest = hoverInfo?.matches[0]?.point;
    if (!nearest) return '';
    const typeLabel =
      nearest.type && typeSettings[nearest.type as LocationType]?.name
        ? typeSettings[nearest.type as LocationType].name
        : nearest.type ?? 'unknown';
    const countryLabel = nearest.admin0 ?? '';
    const regionLabel = nearest.region ?? '';
    const latText = Number.isFinite(nearest.latitude)
      ? nearest.latitude.toFixed(5)
      : String(nearest.latitude);
    const lonText = Number.isFinite(nearest.longitude)
      ? nearest.longitude.toFixed(5)
      : String(nearest.longitude);
    const parts = [
      typeLabel,
      nearest.name ?? 'Unknown',
      countryLabel,
      regionLabel,
      `(${latText}, ${lonText})`,
    ].filter(Boolean);
    return parts.join(' / ');
  }, [hoverInfo, typeSettings]);

  useEffect(
    () =>
      () => {
        if (hoverTimerRef.current) {
          window.clearTimeout(hoverTimerRef.current);
        }
      },
    []
  );

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(Math.max(1, Math.min(20, newZoom)));
  }, []);

  const handleMoveToCurrentLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      setCenter([position.coords.longitude, position.coords.latitude]);
      setZoom(15);
    });
  }, []);

  const handleFitToData = useCallback(() => {
    if (filteredLocations.length === 0) return;

    const lngs = filteredLocations.map((location) => location.coordinates[0]);
    const lats = filteredLocations.map((location) => location.coordinates[1]);

    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

    setCenter([centerLng, centerLat]);
    setZoom(8);
  }, [filteredLocations]);

  return {
    translations,
    mapPreviewTranslations,
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
  };
};
