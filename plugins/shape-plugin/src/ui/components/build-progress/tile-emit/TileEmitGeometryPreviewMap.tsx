import FitScreenSharpIcon from '@mui/icons-material/FitScreenSharp';
import { Box, IconButton } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export type TileBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type TileEmitGeometryPreviewMapProps = {
  tileBBox: TileBBox;
  bufferBBox: TileBBox;
  features: Feature<Geometry>[];
  selectedFeatureId: string | null;
  hoveredFeatureId: string | null;
  baseColor: string;
  hoverColor: string;
  onMouseLeave?: () => void;
};

const toLatLngBounds = (bbox: TileBBox): L.LatLngBounds => (
  L.latLngBounds([
    [bbox.minY, bbox.minX],
    [bbox.maxY, bbox.maxX],
  ])
);

const resolveFeatureId = (feature: Feature): string | null => {
  const props = feature.properties as Record<string, unknown> | undefined;
  const metadataFeatureId = props?.__hdbFeatureId;
  if (typeof metadataFeatureId === 'string' && metadataFeatureId.trim().length > 0) {
    return metadataFeatureId;
  }
  if (typeof feature.id === 'string' && feature.id.trim().length > 0) return feature.id;
  if (typeof feature.id === 'number' && Number.isFinite(feature.id)) return String(feature.id);
  return null;
};

const toFeatureCollection = (features: Feature<Geometry>[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

export const TileEmitGeometryPreviewMap = ({
  tileBBox,
  bufferBBox,
  features,
  selectedFeatureId,
  hoveredFeatureId,
  baseColor,
  hoverColor,
  onMouseLeave,
}: TileEmitGeometryPreviewMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.LayerGroup | null>(null);

  const featureById = useMemo(() => {
    const map = new Map<string, Feature<Geometry>>();
    features.forEach((feature) => {
      const id = resolveFeatureId(feature);
      if (id) {
        map.set(id, feature);
      }
    });
    return map;
  }, [features]);

  const fitToTarget = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    let nextBounds: L.LatLngBounds | null = null;
    if (selectedFeatureId) {
      const selectedFeature = featureById.get(selectedFeatureId);
      if (selectedFeature) {
        const selectedBounds = L.geoJSON(toFeatureCollection([selectedFeature])).getBounds();
        if (selectedBounds.isValid()) {
          nextBounds = selectedBounds;
        }
      }
    }
    if (!nextBounds) {
      const tileBounds = toLatLngBounds(tileBBox);
      if (tileBounds.isValid()) {
        nextBounds = tileBounds;
      }
    }
    if (nextBounds) {
      map.fitBounds(nextBounds, { padding: [8, 8], animate: false });
    }
  }, [featureById, selectedFeatureId, tileBBox]);

  const refreshTileLayers = useCallback(() => {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) return;
    tileLayer.clearLayers();
    const tileBounds = toLatLngBounds(tileBBox);
    const bufferBounds = toLatLngBounds(bufferBBox);
    L.rectangle(bufferBounds, {
      color: '#999',
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0,
      dashArray: '4 3',
      interactive: false,
    }).addTo(tileLayer);
    L.rectangle(tileBounds, {
      color: '#111',
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0,
      interactive: false,
    }).addTo(tileLayer);
  }, [bufferBBox, tileBBox]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: false,
      doubleClickZoom: true,
      boxZoom: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.setView([0, 0], 1);
    const baseLayer = L.layerGroup().addTo(map);
    const highlightLayer = L.layerGroup().addTo(map);
    const tileLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    baseLayerRef.current = baseLayer;
    highlightLayerRef.current = highlightLayer;
    tileLayerRef.current = tileLayer;

    map.whenReady(() => {
      map.invalidateSize(false);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      highlightLayerRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const baseLayer = baseLayerRef.current;
    const highlightLayer = highlightLayerRef.current;
    if (!map || !baseLayer || !highlightLayer) return;
    map.invalidateSize(false);
    baseLayer.clearLayers();
    highlightLayer.clearLayers();

    const selectedFeature = selectedFeatureId ? featureById.get(selectedFeatureId) ?? null : null;
    const renderFeatures = selectedFeature ? [selectedFeature] : features;
    if (renderFeatures.length > 0) {
      L.geoJSON(toFeatureCollection(renderFeatures), {
        style: {
          color: baseColor,
          weight: 1.5,
          opacity: 0.9,
          fillOpacity: 0.25,
        },
      }).addTo(baseLayer);
    }

    if (!selectedFeature && hoveredFeatureId) {
      const hoveredFeature = featureById.get(hoveredFeatureId) ?? null;
      if (hoveredFeature) {
        L.geoJSON(toFeatureCollection([hoveredFeature]), {
          style: {
            color: hoverColor,
            weight: 3,
            opacity: 0.95,
            fillOpacity: 0.35,
          },
        }).addTo(highlightLayer);
      }
    }

    fitToTarget();
  }, [baseColor, bufferBBox, featureById, features, fitToTarget, hoveredFeatureId, hoverColor, selectedFeatureId, tileBBox]);

  useEffect(() => {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) return;
    refreshTileLayers();
  }, [refreshTileLayers]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize(false);
      fitToTarget();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    onMouseLeave?.();
  }, [onMouseLeave]);

  const handleFitClick = useCallback(() => {
    fitToTarget();
  }, [fitToTarget]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minWidth: 200,
        minHeight: 200,
        aspectRatio: '1 / 1',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'common.white',
      }}
      onMouseLeave={handleMouseLeave}
    >
      <IconButton
        size="small"
        aria-label="Fit geometry bounds"
        onClick={handleFitClick}
        sx={{
          position: 'absolute',
          top: 72,
          right: 12,
          zIndex: 1200,
          bgcolor: 'common.white',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 1,
          width: 26,
          height: 26,
          p: 0,
          borderRadius: '4px',
          color: 'grey.600',
          '&:hover': {
            bgcolor: 'grey.50',
          },
          '& svg': {
            fontSize: 16,
          },
        }}
      >
        <FitScreenSharpIcon fontSize="inherit" />
      </IconButton>
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          '& .leaflet-container': {
            width: '100%',
            height: '100%',
            background: 'transparent',
          },
          '& .leaflet-control-zoom': {
            transform: 'scale(0.85)',
            transformOrigin: 'top right',
            marginTop: '4px',
            marginRight: '4px',
          },
          '& .leaflet-control-zoom a': {
            width: 20,
            height: 20,
            lineHeight: '20px',
            fontSize: '14px',
          },
        }}
      />
    </Box>
  );
};
