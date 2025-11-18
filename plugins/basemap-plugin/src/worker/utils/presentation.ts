import type { MapStyle, MapViewport, BasemapPeerData } from '../../common/types/BaseMapEntity.js';

const ALLOWED_STYLES: ReadonlySet<MapStyle['style']> = new Set([
  'streets',
  'satellite',
  'terrain',
  'dark',
  'light',
  'custom',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toCoordinateTuple = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [lng, lat] = value;
  return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : undefined;
};

export const extractMapStyle = (value: unknown): MapStyle | undefined => {
  if (!isRecord(value)) return undefined;
  const styleRaw = value.style;
  if (typeof styleRaw !== 'string' || !ALLOWED_STYLES.has(styleRaw as MapStyle['style'])) {
    return undefined;
  }
  const style = styleRaw as MapStyle['style'];
  const result: MapStyle = { style };
  if (style === 'custom') {
    if (typeof value.customStyleUrl === 'string' && value.customStyleUrl.trim().length > 0) {
      result.customStyleUrl = value.customStyleUrl.trim();
    }
    if (isRecord(value.customStyleConfig)) {
      result.customStyleConfig = value.customStyleConfig as Record<string, unknown>;
    }
  }
  return result;
};

export const extractViewport = (value: unknown): MapViewport | undefined => {
  if (!isRecord(value)) return undefined;
  const center = toCoordinateTuple(value.center);
  const zoom = typeof value.zoom === 'number' ? value.zoom : undefined;
  if (!center || typeof zoom !== 'number') return undefined;
  const bearing = typeof value.bearing === 'number' ? value.bearing : 0;
  const pitch = typeof value.pitch === 'number' ? value.pitch : 0;
  return {
    center,
    zoom,
    bearing,
    pitch,
  } satisfies MapViewport;
};

export const extractPresentationFromNodeData = (
  value: unknown
): BasemapPeerData['presentation'] | undefined => {
  if (!isRecord(value)) return undefined;
  const style = extractMapStyle(value.mapStyle);
  const viewport = extractViewport(value.viewport);
  if (!style && !viewport) return undefined;
  return { style, viewport };
};

export const normalizeBasemapPeerData = (
  input?: Partial<BasemapPeerData> | null
): BasemapPeerData => ({
  schemaVersion: 1,
  presentation: normalizePresentation(input?.presentation),
});

const normalizePresentation = (
  presentation?: BasemapPeerData['presentation'] | null
): BasemapPeerData['presentation'] | undefined => {
  if (!presentation) return undefined;
  const style = presentation.style ? extractMapStyle(presentation.style) : undefined;
  const viewport = presentation.viewport ? extractViewport(presentation.viewport) : undefined;
  if (!style && !viewport) return undefined;
  return { style, viewport };
};
