import { useCallback, useMemo } from 'react';
import type { MapViewState } from '@hierarchidb/ui-map';
import { getStyleAttribution } from '../../common/constants/builtInStyles.js';
import type { MapStyle, MapViewport } from '../../common/types/BaseMapEntity.js';
import { resolvePreviewMapStyle } from '../utils/mapStyle.js';

interface UseBaseMapPreviewProps {
  mapStyle: MapStyle;
  viewport: MapViewport;
  zxy?: string;
  interactive: boolean;
}

export function useBaseMapPreview({
  mapStyle,
  viewport,
  zxy,
  interactive,
}: UseBaseMapPreviewProps) {
  const initialViewState = useMemo<MapViewState>(
    () => ({
      longitude: viewport.center[0],
      latitude: viewport.center[1],
      zoom: viewport.zoom,
      bearing: viewport.bearing || 0,
      pitch: viewport.pitch || 0,
    }),
    [viewport]
  );

  const zxyString = useMemo(() => {
    if (zxy) return zxy;
    return `${viewport.zoom},${viewport.center[0]},${viewport.center[1]}`;
  }, [zxy, viewport]);

  const handleMapClick = useCallback(() => {
    if (!interactive) {
      const baseUrl = window.location.origin;
      const prefix =
        typeof import.meta !== 'undefined' ? import.meta.env?.VITE_APP_PREFIX : undefined;
      const sanitized = prefix?.replace(/^\/+|\/+$/g, '');
      const basePath = sanitized ? `/${sanitized}/` : '/';
      const mapUrl = `${baseUrl}${basePath}map?zxy=${zxyString}`;
      window.open(mapUrl, '_blank');
    }
  }, [interactive, zxyString]);

  const mapStyleSource = useMemo(() => resolvePreviewMapStyle(mapStyle), [mapStyle]);

  const attribution = useMemo(() => {
    if (mapStyle.style !== 'custom') {
      return getStyleAttribution(mapStyle.style);
    }
    return '© Map contributors';
  }, [mapStyle]);

  const mapStyleProps = typeof mapStyleSource === 'string'
    ? { mapStyleUrl: mapStyleSource }
    : { mapStyleObject: mapStyleSource };

  return {
    attribution,
    handleMapClick,
    initialViewState,
    mapStyleProps,
    zxyString,
  };
}
