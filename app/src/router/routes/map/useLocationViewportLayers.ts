import type { NodeId } from '@hierarchidb/core-types';
import type { LocationIconId, LocationQueryAPI } from '@hierarchidb/location-api';
import type { LocationType } from '@hierarchidb/location-store';
import type {
  LayerSetEntryId,
  LayerSetId,
  LayerSetVisibility,
  MapLibreMapInstance,
  MapViewState,
  ResourceGeoJsonLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  DEFAULT_LAYER_SETS,
  LOCATION_POINTS_ENTRY_ID,
  LOCATION_SYMBOLS_ENTRY_ID,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  DirectionsBoat as DirectionsBoatIcon,
  FlightTakeoff as FlightTakeoffIcon,
  ForkRight as ForkRightIcon,
  LocationCity as LocationCityIcon,
  Public as PublicIcon,
  Train as TrainIcon,
} from '@mui/icons-material';
import { MaplibreExportControl } from '@watergis/maplibre-gl-export';
import type { Feature } from 'geojson';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LOCATION_TYPE_COLORS } from './constants.js';
import { LocationViewportIcon, type LocationViewportIconProps } from './LocationViewportIcon.js';
import { applyDirectStyleBindingPaint } from './resolveDirectStyleBindings.js';
import type { LocationLayerEntry } from './useFolderLayers.js';

const PREFETCH_MARGIN_PX = 64;

const resolveLayerSetEntryPriority = (
  layerSetId: LayerSetId,
  entryId?: LayerSetEntryId
): number => {
  const layerSet = DEFAULT_LAYER_SETS.find((set) => set.id === layerSetId);
  if (!layerSet) return 0;
  if (!entryId) return layerSet.priority * 100;
  const index = layerSet.entries.findIndex((entry) => entry.id === entryId);
  if (index < 0) return layerSet.priority * 100;
  return layerSet.priority * 100 + (layerSet.entries.length - index);
};

const LOCATION_TYPE_ICON_COMPONENTS: Record<LocationType, SvgIconComponent> = {
  area_centroid: LocationCityIcon,
  airport: FlightTakeoffIcon,
  port: DirectionsBoatIcon,
  railway_station: TrainIcon,
  interchange: ForkRightIcon,
};

const LOCATION_MVT_ICON_COMPONENTS: Record<LocationIconId, SvgIconComponent> = {
  public: PublicIcon,
  location_city: LocationCityIcon,
  flight_takeoff: FlightTakeoffIcon,
  directions_boat: DirectionsBoatIcon,
  train: TrainIcon,
  fork_right: ForkRightIcon,
};

const LOCATION_MVT_ICON_TYPES: Record<LocationIconId, LocationType | null> = {
  public: null,
  location_city: 'area_centroid',
  flight_takeoff: 'airport',
  directions_boat: 'port',
  train: 'railway_station',
  fork_right: 'interchange',
};

type UseLocationViewportLayersArgs = {
  nodeId?: string;
  locationLayers: LocationLayerEntry[];
  layerSetVisibility: LayerSetVisibility;
  enabledLocationKinds: LocationType[];
  locationTypeFilter: unknown;
  locationCirclePaint: Record<string, unknown>;
  locationIconImageExpression: unknown;
  locationIconSizeExpression: unknown;
  exportControlEnabled?: boolean;
  disabled?: boolean;
};

type UseLocationViewportLayersResult = {
  locationGeoJsonLayers: ResourceGeoJsonLayer[];
  handleMapLoad: (map: MapLibreMapInstance) => void;
  handleLocationMoveEnd: (viewState: MapViewState) => void;
};

export const useLocationViewportLayers = (
  args: UseLocationViewportLayersArgs
): UseLocationViewportLayersResult => {
  const {
    nodeId,
    locationLayers,
    layerSetVisibility,
    enabledLocationKinds,
    locationTypeFilter,
    locationCirclePaint,
    locationIconImageExpression,
    locationIconSizeExpression,
    exportControlEnabled = true,
    disabled = false,
  } = args;
  const enabled = !disabled;

  const mapInstanceRef = useRef<MapLibreMapInstance | null>(null);
  const exportControlRef = useRef<MaplibreExportControl | null>(null);
  const locationQueryPromiseRef = useRef<Promise<LocationQueryAPI> | null>(null);
  const locationQueryTimerRef = useRef<number | null>(null);
  const locationQueryRequestRef = useRef(0);
  const pendingIconLoadsRef = useRef<Set<string>>(new Set());
  const [locationGeoJsonLayers, setLocationGeoJsonLayers] = useState<ResourceGeoJsonLayer[]>([]);
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);

  const getLocationQueryAPI = useCallback(async (): Promise<LocationQueryAPI> => {
    if (locationQueryPromiseRef.current) {
      return locationQueryPromiseRef.current;
    }
    locationQueryPromiseRef.current = ensureWorkerAPI().then((api) => api.getLocationQueryAPI());
    return locationQueryPromiseRef.current;
  }, []);

  const resolveLocationTypeFromIconId = useCallback((iconId: string): LocationType | null => {
    const directType = (
      Object.entries(LOCATION_TYPE_ICON_COMPONENTS) as Array<[LocationType, SvgIconComponent]>
    ).find(([type]) => {
      if (type === 'airport') return iconId === 'flight_takeoff';
      if (type === 'port') return iconId === 'directions_boat';
      if (type === 'railway_station') return iconId === 'train';
      if (type === 'interchange') return iconId === 'fork_right';
      return iconId === 'location_city';
    })?.[0];
    if (directType) return directType;
    const prefix = 'location-icon-';
    if (!iconId.startsWith(prefix)) return null;
    const candidate = iconId.slice(prefix.length);
    if (!Object.prototype.hasOwnProperty.call(LOCATION_TYPE_ICON_COMPONENTS, candidate))
      return null;
    return candidate as LocationType;
  }, []);

  const loadLocationIconImage = useCallback(
    (
      map: MapLibreMapInstance,
      loadKey: string,
      iconIds: string[],
      Icon: SvgIconComponent,
      color: string
    ) => {
      const mapWithImages = map as MapLibreMapInstance & {
        hasImage?: (id: string) => boolean;
        addImage?: (id: string, image: HTMLImageElement, options?: { sdf?: boolean }) => void;
      };
      if (!mapWithImages.addImage) return;
      if (iconIds.every((iconId) => mapWithImages.hasImage?.(iconId))) return;
      if (pendingIconLoadsRef.current.has(loadKey)) return;

      pendingIconLoadsRef.current.add(loadKey);
      const iconProps: LocationViewportIconProps = { Icon, color };
      const svg = renderToStaticMarkup(createElement(LocationViewportIcon, iconProps));
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const image = new Image();
      image.onload = () => {
        pendingIconLoadsRef.current.delete(loadKey);
        iconIds.forEach((iconId) => {
          try {
            if (!mapWithImages.hasImage?.(iconId)) {
              mapWithImages.addImage?.(iconId, image);
            }
          } catch (error) {
            console.warn('[MapPage] Failed to register location icon image', { iconId, error });
          }
        });
      };
      image.onerror = () => {
        pendingIconLoadsRef.current.delete(loadKey);
        console.warn('[MapPage] Failed to load location icon image', { iconIds });
      };
      image.src = dataUrl;
    },
    []
  );

  const loadLocationIcon = useCallback(
    (map: MapLibreMapInstance, type: LocationType) => {
      const iconIds =
        type === 'airport'
          ? ['location-icon-airport', 'flight_takeoff']
          : type === 'port'
            ? ['location-icon-port', 'directions_boat']
            : type === 'railway_station'
              ? ['location-icon-railway_station', 'train']
              : type === 'interchange'
                ? ['location-icon-interchange', 'fork_right']
                : ['location-icon-area_centroid', 'location_city'];
      const Icon = LOCATION_TYPE_ICON_COMPONENTS[type];
      if (!Icon) return;
      loadLocationIconImage(map, `type:${type}`, iconIds, Icon, LOCATION_TYPE_COLORS[type]);
    },
    [loadLocationIconImage]
  );

  const loadLocationMvtIcon = useCallback(
    (map: MapLibreMapInstance, iconId: LocationIconId) => {
      const Icon = LOCATION_MVT_ICON_COMPONENTS[iconId];
      const type = LOCATION_MVT_ICON_TYPES[iconId];
      const color = type ? LOCATION_TYPE_COLORS[type] : LOCATION_TYPE_COLORS.area_centroid;
      loadLocationIconImage(map, `mvt:${iconId}`, [iconId], Icon, color);
    },
    [loadLocationIconImage]
  );

  const ensureLocationIcons = useCallback(
    (map: MapLibreMapInstance) => {
      (Object.keys(LOCATION_TYPE_ICON_COMPONENTS) as LocationType[]).forEach((type) => {
        loadLocationIcon(map, type);
      });
      (Object.keys(LOCATION_MVT_ICON_COMPONENTS) as LocationIconId[]).forEach((iconId) => {
        loadLocationMvtIcon(map, iconId);
      });
    },
    [loadLocationIcon, loadLocationMvtIcon]
  );

  const buildLocationLayersForNode = useCallback(
    (layer: LocationLayerEntry, features: Array<Feature>): ResourceGeoJsonLayer[] => {
      const sourceId = layer.sourceId;
      const circlePaint =
        applyDirectStyleBindingPaint('circle', locationCirclePaint, layer.directStyleBinding) ??
        locationCirclePaint;
      const base = {
        data: {
          type: 'FeatureCollection' as const,
          features,
        },
        filter: locationTypeFilter ?? undefined,
        absolutePath: layer.absolutePath,
      };
      const layers: ResourceGeoJsonLayer[] = [
        {
          layerId: `${layer.layerId}-circle`,
          sourceId,
          layerType: 'circle',
          paint: circlePaint,
          layerSetId: 'location',
          layerPriority: resolveLayerSetEntryPriority('location', LOCATION_POINTS_ENTRY_ID),
          layerLabel: layer.absolutePath ?? layer.layerId,
          ...base,
        },
        {
          layerId: `${layer.layerId}-icon`,
          sourceId,
          layerType: 'symbol',
          layout: {
            'icon-image': locationIconImageExpression,
            'icon-size': locationIconSizeExpression,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          layerSetId: 'location',
          layerPriority: resolveLayerSetEntryPriority('location', LOCATION_SYMBOLS_ENTRY_ID),
          layerLabel: layer.absolutePath ?? layer.layerId,
          ...base,
        },
      ];
      return layers;
    },
    [
      locationCirclePaint,
      locationIconImageExpression,
      locationIconSizeExpression,
      locationTypeFilter,
    ]
  );

  const fetchLocationViewportPoints = useCallback(
    async (viewState?: MapViewState) => {
      if (!enabled) {
        setLocationGeoJsonLayers([]);
        return;
      }
      if (!mapInstanceRef.current) return;
      if (disabled) {
        setLocationGeoJsonLayers([]);
        return;
      }
      if (locationLayers.length === 0) {
        setLocationGeoJsonLayers([]);
        return;
      }
      if (!layerSetVisibility.location) {
        setLocationGeoJsonLayers([]);
        return;
      }
      const map = mapInstanceRef.current;
      const bounds = map.getBounds?.();
      if (!bounds) return;
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      const canvas = map.getCanvas();
      const viewportSizePx = {
        width: canvas?.clientWidth ?? 0,
        height: canvas?.clientHeight ?? 0,
      };
      const requestId = ++locationQueryRequestRef.current;
      if (enabledLocationKinds.length === 0) {
        const emptyLayers = locationLayers.flatMap((layer) =>
          buildLocationLayersForNode(layer, [])
        );
        setLocationGeoJsonLayers(emptyLayers);
        return;
      }
      try {
        const api = await getLocationQueryAPI();
        const zoom = viewState?.zoom ?? map.getZoom();
        const layers = await Promise.all(
          locationLayers.map(async (layer) => {
            const items = await api.queryByViewport(
              layer.nodeId as NodeId,
              bbox,
              zoom,
              enabledLocationKinds,
              {
                prefetchMarginPx: PREFETCH_MARGIN_PX,
                viewportSizePx,
              }
            );
            const features: Array<Feature | null> = items.map((item) => {
              const data = item.data as
                | {
                    pointId?: string;
                    name?: string;
                    longitude?: number;
                    latitude?: number;
                    type?: string;
                    countryName?: string;
                    countryCode?: string;
                    admin1?: string;
                    admin2?: string;
                    admin1Code?: string;
                    admin2Code?: string;
                    metadata?: Record<string, string | number | null>;
                  }
                | undefined;
              const longitude = data?.longitude;
              const latitude = data?.latitude;
              if (
                typeof longitude !== 'number' ||
                !Number.isFinite(longitude) ||
                typeof latitude !== 'number' ||
                !Number.isFinite(latitude)
              ) {
                return null;
              }
              return {
                type: 'Feature' as const,
                id: String(item.id),
                geometry: {
                  type: 'Point' as const,
                  coordinates: [longitude, latitude],
                },
                properties: {
                  id: String(item.id),
                  pointId: data?.pointId ?? item.id,
                  name: data?.name,
                  type: data?.type ?? 'area_centroid',
                  countryName: data?.countryName,
                  countryCode: data?.countryCode,
                  admin1: data?.admin1,
                  admin2: data?.admin2,
                  admin1Code: data?.admin1Code,
                  admin2Code: data?.admin2Code,
                  metadata: data?.metadata ?? {},
                },
              } satisfies Feature;
            });
            const filtered = features.filter((feature): feature is Feature => feature !== null);
            return buildLocationLayersForNode(layer, filtered);
          })
        );
        if (requestId !== locationQueryRequestRef.current) return;
        setLocationGeoJsonLayers(layers.flat());
      } catch (error) {
        if (requestId === locationQueryRequestRef.current) {
          setLocationGeoJsonLayers(
            locationLayers.flatMap((layer) => buildLocationLayersForNode(layer, []))
          );
        }
        console.warn('[MapPage] Failed to query location viewport', error);
      }
    },
    [
      buildLocationLayersForNode,
      disabled,
      enabledLocationKinds,
      getLocationQueryAPI,
      layerSetVisibility.location,
      locationLayers,
    ]
  );

  const scheduleLocationQuery = useCallback(
    (viewState?: MapViewState) => {
      if (!enabled) {
        setLocationGeoJsonLayers([]);
        return;
      }
      if (locationQueryTimerRef.current) {
        window.clearTimeout(locationQueryTimerRef.current);
      }
      locationQueryTimerRef.current = window.setTimeout(() => {
        void fetchLocationViewportPoints(viewState);
      }, 150);
    },
    [enabled, fetchLocationViewportPoints]
  );

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current && exportControlRef.current) {
        mapInstanceRef.current.removeControl(exportControlRef.current);
        exportControlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    const mapWithImageEvent = mapInstance as MapLibreMapInstance & {
      on: (type: string, listener: (event: unknown) => void) => void;
      off: (type: string, listener: (event: unknown) => void) => void;
    };
    const handleStyleData = () => {
      ensureLocationIcons(mapInstance);
    };
    const handleStyleImageMissing = (event: unknown) => {
      const iconId = (event as { id?: unknown }).id;
      if (typeof iconId !== 'string') return;
      const type = resolveLocationTypeFromIconId(iconId);
      if (!type) return;
      loadLocationIcon(mapInstance, type);
    };
    mapWithImageEvent.on('styledata', handleStyleData);
    mapWithImageEvent.on('styleimagemissing', handleStyleImageMissing);
    return () => {
      mapWithImageEvent.off('styledata', handleStyleData);
      mapWithImageEvent.off('styleimagemissing', handleStyleImageMissing);
    };
  }, [ensureLocationIcons, loadLocationIcon, mapInstance, resolveLocationTypeFromIconId]);

  useEffect(() => {
    if (disabled || !layerSetVisibility.location) {
      setLocationGeoJsonLayers([]);
      return () => {
        if (locationQueryTimerRef.current) {
          window.clearTimeout(locationQueryTimerRef.current);
          locationQueryTimerRef.current = null;
        }
      };
    }
    if (locationLayers.length > 0) {
      setLocationGeoJsonLayers(
        locationLayers.flatMap((layer) => buildLocationLayersForNode(layer, []))
      );
    } else {
      setLocationGeoJsonLayers([]);
    }
    scheduleLocationQuery();
    return () => {
      if (locationQueryTimerRef.current) {
        window.clearTimeout(locationQueryTimerRef.current);
        locationQueryTimerRef.current = null;
      }
    };
  }, [
    buildLocationLayersForNode,
    disabled,
    layerSetVisibility.location,
    locationLayers,
    scheduleLocationQuery,
  ]);

  const handleMapLoad = useCallback(
    (map: MapLibreMapInstance) => {
      console.log('[MapPage] Map loaded', map);
      mapInstanceRef.current = map;
      setMapInstance(map);
      ensureLocationIcons(map);
      if (enabled) {
        scheduleLocationQuery();
      }
      if (exportControlEnabled && !exportControlRef.current) {
        const control = new MaplibreExportControl({
          Format: 'pdf',
          Local: 'ja',
          Filename: nodeId ? `map-${nodeId}` : 'map-image',
        });
        map.addControl(control, 'bottom-left');
        exportControlRef.current = control;
      }
    },
    [enabled, ensureLocationIcons, exportControlEnabled, nodeId, scheduleLocationQuery]
  );

  const handleLocationMoveEnd = useCallback(
    (viewState: MapViewState) => {
      if (!enabled) return;
      scheduleLocationQuery(viewState);
    },
    [enabled, scheduleLocationQuery]
  );

  return {
    locationGeoJsonLayers,
    handleMapLoad,
    handleLocationMoveEnd,
  };
};
