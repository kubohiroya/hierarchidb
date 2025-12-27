/**
 * RoutePreviewStep - Step 6 of route creation dialog.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Alert, Box, Paper, Snackbar, Typography } from '@mui/material';
import type { NodeId } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import type { RouteNearestLineResponse } from '@hierarchidb/plugin-service-api';
import type { RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { formatDistance, getTransportModeName, useTranslation } from '../../../common/i18n/index.js';

interface RoutePreviewStepProps {
  draft: RouteUpdaterPayload;
  nodeId?: NodeId;
}

type Bounds = { minLon: number; maxLon: number; minLat: number; maxLat: number };
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
  bounds: Bounds,
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

const resolveBounds = (geometry: [number, number][]): Bounds | null => {
  if (!geometry.length) return null;
  const lngs = geometry.map((point) => point[0]);
  const lats = geometry.map((point) => point[1]);
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
};

export const RoutePreviewStep: React.FC<RoutePreviewStepProps> = ({ draft, nodeId }) => {
  const { t, locale } = useTranslation();
  const hasGeometry = Array.isArray(draft.draftData?.lineGeometry) && draft.draftData?.lineGeometry.length > 0;
  const geometry = (draft.draftData?.lineGeometry ?? []) as [number, number][];
  const previewNodeId = nodeId ?? draft.treeNodeId;
  const bounds = useMemo(() => resolveBounds(geometry), [geometry]);
  const mapRef = useRef<HTMLDivElement>(null);
  const workerBridgeRef = useRef(getWorkerBridge());
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [hoverInfo, setHoverInfo] = useState<RouteNearestLineResponse | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);
  const hoverRequestIdRef = useRef(0);
  const lastHoverRef = useRef<{ longitude: number; latitude: number; zoom: number } | null>(null);

  const hoverBounds = useMemo<Bounds>(() => bounds ?? { minLon: -180, maxLon: 180, minLat: -85, maxLat: 85 }, [bounds]);
  const zoomLevel = useMemo(() => {
    const maxZoom = draft.draftData?.processing?.vectorTiles?.maxZoom ?? draft.draftData?.zoomRange?.[1];
    return Math.max(0, Math.min(20, Math.round(maxZoom ?? 8)));
  }, [draft.draftData?.processing?.vectorTiles?.maxZoom, draft.draftData?.zoomRange]);
  const isHoverActive = hoverOpen && Boolean(hoverInfo?.matches?.length);

  const formatTemplate = useCallback(
    (template: string, values: Record<string, string | number>) =>
      Object.entries(values).reduce(
        (acc, [key, value]) => acc.replace(new RegExp(`{${key}}`, 'g'), String(value)),
        template,
      ),
    [],
  );

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

  const scheduleHoverLookup = useCallback((longitude: number, latitude: number) => {
    if (!previewNodeId || mapSize.width === 0 || mapSize.height === 0) return;
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
          const api = await workerBridgeRef.current.getRouteQueryAPI();
          const metersPerPixel = resolveMetersPerPixel(hoverBounds, mapSize, longitude, latitude);
          if (!metersPerPixel) {
            setHoverInfo(null);
            setHoverOpen(false);
            return;
          }
          const result = await api.findNearestRouteLine({
            nodeId: previewNodeId,
            longitude,
            latitude,
            zoom: zoomLevel,
            maxDistanceMeters: metersPerPixel * HOVER_DISTANCE_PX,
          });
          if (hoverRequestIdRef.current !== requestId) return;
          setHoverInfo(result);
          setHoverOpen(result.matches.length > 0);
        } catch (error) {
          if (hoverRequestIdRef.current === requestId) {
            setHoverInfo(null);
            setHoverOpen(false);
          }
          console.warn('[RoutePreviewStep] hover lookup failed', error);
        }
      })();
    }, 120);
  }, [hoverBounds, mapSize.height, mapSize.width, previewNodeId, zoomLevel]);

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
  }, []);

  const hoverMessage = useMemo(() => {
    const nearest = hoverInfo?.matches?.[0]?.line;
    if (!nearest) return '';
    const modeLabel = nearest.routeMode
      ? getTransportModeName(nearest.routeMode, locale)
      : t('preview.hoverUnknown', 'Unknown route');
    const startParts = [nearest.start?.name, nearest.start?.admin1Name, nearest.start?.admin0Name].filter(Boolean);
    const endParts = [nearest.end?.name, nearest.end?.admin1Name, nearest.end?.admin0Name].filter(Boolean);
    const startLabel = startParts.join(', ') || t('preview.hoverUnknown', 'Unknown route');
    const endLabel = endParts.join(', ') || t('preview.hoverUnknown', 'Unknown route');
    const distanceValue = nearest.routeDistanceMeters ?? hoverInfo?.matches?.[0]?.distanceMeters ?? 0;
    const distanceLabel = formatDistance(distanceValue, locale);
    const template = t('preview.hoverTemplate', '{mode} / {start} -> {end} / {distance}');
    return formatTemplate(template, {
      mode: modeLabel,
      start: startLabel,
      end: endLabel,
      distance: distanceLabel,
    });
  }, [formatTemplate, hoverInfo, locale, t]);

  const polylinePoints = useMemo(() => {
    if (!bounds || mapSize.width === 0 || mapSize.height === 0) return '';
    const { minLon, maxLon, minLat, maxLat } = bounds;
    const scaleX = mapSize.width / (maxLon - minLon);
    const scaleY = mapSize.height / (maxLat - minLat);
    return geometry
      .map(([lon, lat]) => {
        const x = (lon - minLon) * scaleX;
        const y = (maxLat - lat) * scaleY;
        return `${x},${y}`;
      })
      .join(' ');
  }, [bounds, geometry, mapSize.height, mapSize.width]);

  useEffect(() => () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
  }, []);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h6">{t('preview.title', 'Preview')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('preview.description', 'Preview the generated route geometry once the build is complete.')}
      </Typography>

      {!hasGeometry && (
        <Alert severity="info">
          {t('preview.missing', 'No route geometry is available yet. Run Build to generate a preview.')}
        </Alert>
      )}

      {hasGeometry && (
        <>
          <Alert severity="success">
            {t('preview.ready', 'Route geometry is available. Map preview will appear here.')}
          </Alert>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1">{t('preview.mapTitle', 'Map Preview')}</Typography>
            <Box
              ref={mapRef}
              onMouseMove={handleMapMouseMove}
              onMouseLeave={handleMapMouseLeave}
              sx={{
                position: 'relative',
                mt: 1,
                height: 320,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                overflow: 'hidden',
              }}
            >
              <Box
                component="svg"
                sx={{ position: 'absolute', inset: 0 }}
                viewBox={`0 0 ${Math.max(1, mapSize.width)} ${Math.max(1, mapSize.height)}`}
                preserveAspectRatio="none"
              >
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  opacity={0.6}
                />
                {isHoverActive && (
                  <polyline
                    points={polylinePoints}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={5}
                    opacity={0.95}
                    style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
                  />
                )}
              </Box>
            </Box>
          </Paper>
          <Snackbar
            open={hoverOpen && Boolean(hoverMessage)}
            message={hoverMessage}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            autoHideDuration={2000}
          />
        </>
      )}
    </Box>
  );
};
