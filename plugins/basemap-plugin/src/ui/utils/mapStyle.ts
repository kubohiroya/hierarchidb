import type { MapLibreStyle } from '@hierarchidb/ui-map';
import type { MapStyle } from '../../common/types/BaseMapEntity.js';
import { BUILT_IN_STYLES, getBuiltInStyleUrl } from '../../common/constants/builtInStyles.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isMapLibreStyleConfig(value: unknown): value is MapLibreStyle {
  if (!isObject(value)) return false;
  const candidate = value as Partial<MapLibreStyle> & { version?: unknown };
  const layers = (candidate as { layers?: unknown }).layers;
  const sources = (candidate as { sources?: unknown }).sources;
  const hasLayers = Array.isArray(layers);
  const hasSources = isObject(sources);
  const hasVersion = typeof candidate.version === 'number';
  return hasLayers && hasSources && hasVersion;
}

export function resolveMapStyleSource(mapStyle: MapStyle): string | MapLibreStyle {
  if (mapStyle.style === 'custom') {
    if (mapStyle.customStyleUrl) {
      return mapStyle.customStyleUrl;
    }
    if (mapStyle.customStyleConfig && isMapLibreStyleConfig(mapStyle.customStyleConfig)) {
      return mapStyle.customStyleConfig;
    }
  }
  const builtInStyle = BUILT_IN_STYLES[mapStyle.style as keyof typeof BUILT_IN_STYLES];
  return builtInStyle?.url ?? BUILT_IN_STYLES.streets.url;
}

export function resolvePreviewMapStyle(mapStyle: MapStyle): string | MapLibreStyle {
  if (mapStyle.style === 'custom') {
    if (mapStyle.customStyleUrl) {
      return mapStyle.customStyleUrl;
    }
    if (mapStyle.customStyleConfig && isMapLibreStyleConfig(mapStyle.customStyleConfig)) {
      return mapStyle.customStyleConfig;
    }
  }
  return getBuiltInStyleUrl(mapStyle.style);
}
