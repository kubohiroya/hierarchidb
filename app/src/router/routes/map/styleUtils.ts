import type { MapLibreStyle } from '@hierarchidb/ui-plugin-shell/ui-map';
import { DEFAULT_MAP_CONFIG } from '@hierarchidb/ui-plugin-shell/ui-map';
import { BUILT_IN_STYLE_URLS } from './constants.js';
import type { MapStyle } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMapLibreStyle = (value: unknown): value is MapLibreStyle => {
  if (!isRecord(value)) return false;
  return Array.isArray(value.layers) && isRecord(value.sources);
};

export const resolveMapStyleSource = (
  mapStyle?: MapStyle | null
): string | MapLibreStyle | null => {
  if (!mapStyle?.style) return null;
  if (mapStyle.style === 'custom') {
    if (mapStyle.customStyleConfig) {
      if (isMapLibreStyle(mapStyle.customStyleConfig)) return mapStyle.customStyleConfig;
      return mapStyle.customStyleUrl ?? null;
    }
    return mapStyle.customStyleUrl ?? null;
  }
  return BUILT_IN_STYLE_URLS[mapStyle.style] ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
};

export const sortByPath = <T extends { absolutePath?: string; nodeId: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.nodeId;
    const bKey = b.absolutePath ?? b.nodeId;
    return aKey.localeCompare(bKey);
  });

export const sortByLayerPath = <T extends { absolutePath?: string; layerId: string }>(
  items: T[]
): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.layerId;
    const bKey = b.absolutePath ?? b.layerId;
    return aKey.localeCompare(bKey);
  });
