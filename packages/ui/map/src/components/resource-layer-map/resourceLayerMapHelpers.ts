import { formatAdminLevelLabel } from '../../preview/layerSetDefinitions.js';
import type React from 'react';
import { isValidElement } from 'react';
import type { LayerStyleOverrides, MapLayerType } from './ResourceLayerMap.types';
import type { VectorTileLayerConfig } from '~/types/unified-map-props';
import type { MapLibreGeoJSONFeature } from '~/types/maplibre-public';

export type SortableLayer = {
  absolutePath?: string;
  nodeId?: string;
  layerId?: string;
  sourceId?: string;
  layerPriority?: number;
};

export const LAYER_PAINT_KEYS: Record<MapLayerType, Set<string>> = {
  fill: new Set(['fill-color', 'fill-opacity', 'fill-outline-color']),
  line: new Set(['line-color', 'line-opacity', 'line-width']),
  circle: new Set(['circle-color', 'circle-opacity', 'circle-radius']),
  symbol: new Set(['text-color', 'text-halo-color', 'text-halo-width']),
  raster: new Set(['raster-opacity', 'raster-brightness-max', 'raster-brightness-min', 'raster-contrast']),
  background: new Set(['background-color', 'background-opacity', 'background-pattern']),
};

export const pickStyleOverrides = (
  layerType: VectorTileLayerConfig['layerType'] | undefined,
  overrides?: Record<string, unknown>,
  overridesByType?: LayerStyleOverrides,
): Record<string, unknown> => {
  const allowed = LAYER_PAINT_KEYS[layerType ?? 'fill'];
  if (!allowed) return {};
  const globalOverrides = overrides ?? {};
  const typedOverrides = overridesByType?.[layerType ?? 'fill'] ?? {};
  return Object.fromEntries(
    Object.entries({ ...typedOverrides, ...globalOverrides }).filter(([key]) => allowed.has(key)),
  );
};

export const toFiniteNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const buildDefaultHighlightOverrides = (
  layerType: VectorTileLayerConfig['layerType'] | undefined,
  basePaint: Record<string, unknown>,
  theme: import('@mui/material/styles').Theme,
): Record<string, unknown> => {
  const hasSearch = ['boolean', ['feature-state', 'hdbSearch'], false];
  const hasHover = ['boolean', ['feature-state', 'hdbHover'], false];
  const hasSelected = ['boolean', ['feature-state', 'hdbSelected'], false];
  const selectedColor = theme.palette.primary.main;
  const hoverColor = theme.palette.primary.light;
  const searchColor = theme.palette.secondary.light;

  const colorExpression = (base: unknown) => [
    'case',
    hasSelected,
    selectedColor,
    hasHover,
    hoverColor,
    hasSearch,
    searchColor,
    base,
  ];

  switch (layerType ?? 'fill') {
    case 'line': {
      const baseColor = basePaint['line-color'] ?? theme.palette.primary.main;
      const baseWidth = toFiniteNumber(basePaint['line-width'], 2);
      const baseOpacity = toFiniteNumber(basePaint['line-opacity'], 0.8);
      return {
        'line-color': colorExpression(baseColor),
        'line-width': [
          'case',
          hasSelected,
          baseWidth + 1.6,
          hasHover,
          baseWidth + 0.8,
          hasSearch,
          baseWidth + 0.4,
          baseWidth,
        ],
        'line-opacity': [
          'case',
          hasSelected,
          Math.min(1, baseOpacity + 0.2),
          hasHover,
          Math.min(1, baseOpacity + 0.1),
          hasSearch,
          Math.min(1, baseOpacity + 0.05),
          baseOpacity,
        ],
      };
    }
    case 'circle': {
      const baseColor = basePaint['circle-color'] ?? theme.palette.primary.main;
      const baseRadius = toFiniteNumber(basePaint['circle-radius'], 4);
      const baseOpacity = toFiniteNumber(basePaint['circle-opacity'], 0.8);
      const baseStroke = basePaint['circle-stroke-color'] ?? baseColor;
      const baseStrokeWidth = toFiniteNumber(basePaint['circle-stroke-width'], 0);
      return {
        'circle-color': colorExpression(baseColor),
        'circle-radius': [
          'case',
          hasSelected,
          baseRadius + 2,
          hasHover,
          baseRadius + 1,
          hasSearch,
          baseRadius + 0.5,
          baseRadius,
        ],
        'circle-opacity': [
          'case',
          hasSelected,
          Math.min(1, baseOpacity + 0.15),
          hasHover,
          Math.min(1, baseOpacity + 0.08),
          hasSearch,
          Math.min(1, baseOpacity + 0.05),
          baseOpacity,
        ],
        'circle-stroke-color': colorExpression(baseStroke),
        'circle-stroke-width': [
          'case',
          hasSelected,
          baseStrokeWidth + 1.5,
          hasHover,
          baseStrokeWidth + 0.8,
          hasSearch,
          baseStrokeWidth + 0.4,
          baseStrokeWidth,
        ],
      };
    }
    case 'fill':
    default: {
      const baseColor = basePaint['fill-color'] ?? theme.palette.primary.light;
      const baseOutline = basePaint['fill-outline-color'] ?? baseColor;
      const baseOpacity = toFiniteNumber(basePaint['fill-opacity'], 0.3);
      return {
        'fill-color': colorExpression(baseColor),
        'fill-outline-color': colorExpression(baseOutline),
        'fill-opacity': [
          'case',
          hasSelected,
          Math.min(1, baseOpacity + 0.35),
          hasHover,
          Math.min(1, baseOpacity + 0.2),
          hasSearch,
          Math.min(1, baseOpacity + 0.12),
          baseOpacity,
        ],
      };
    }
  }
};

export const sortByPath = <T extends SortableLayer>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.nodeId ?? a.layerId ?? a.sourceId ?? '';
    const bKey = b.absolutePath ?? b.nodeId ?? b.layerId ?? b.sourceId ?? '';
    return aKey.localeCompare(bKey);
  });

export const sortByLayerPriority = <T extends SortableLayer>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aPriority = a.layerPriority ?? 0;
    const bPriority = b.layerPriority ?? 0;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aKey = a.absolutePath ?? a.nodeId ?? a.layerId ?? a.sourceId ?? '';
    const bKey = b.absolutePath ?? b.nodeId ?? b.layerId ?? b.sourceId ?? '';
    return aKey.localeCompare(bKey);
  });

const ADMIN_LABEL_PATTERN = /(?:adm|admin)\s*(\d+)/i;

const toPropertyString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  return undefined;
};

const pickFirstString = (properties: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = toPropertyString(properties[key]);
    if (value) return value;
  }
  return undefined;
};

const resolveAdminLevel = (properties: Record<string, unknown>): number | undefined => {
  const candidates = [
    properties.adminLevel,
    properties.admin_level,
    properties.ADM_LEVEL,
    properties.level,
    properties.admin_lvl,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  const labelCandidates = [
    properties.shapeType,
    properties.boundaryType,
    properties.adminType,
    properties.ADMIN_TYPE,
    properties.layer,
    properties.LAYER,
  ];
  for (const candidate of labelCandidates) {
    if (typeof candidate !== 'string') continue;
    const match = candidate.match(ADMIN_LABEL_PATTERN);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const buildAdminHoverCandidate = (
  properties: Record<string, unknown>,
): { level: number; label: string } | null => {
  const level = resolveAdminLevel(properties);
  if (level == null) return null;
  const adminName = pickFirstString(properties, [
    'name',
    'NAME',
    'name_en',
    'NAME_EN',
    'shapeName',
    'NAME_1',
    'NAME_2',
    'NAME_3',
    'NAME_4',
    'NAME_5',
    'adminName',
  ]);
  const countryName = pickFirstString(properties, [
    'countryName',
    'country',
    'COUNTRY',
    'COUNTRY_NAME',
    'NAME_0',
    'ADMIN',
    'SOVEREIGNT',
  ]);
  const countryCode = pickFirstString(properties, [
    'countryCode',
    'ISO_A2',
    'ISO2',
    'ISO_2',
    'ISO_A3',
    'ADM0_A3',
    'ISO3',
    'shapeISO',
  ]);
  const countrySuffix = countryCode ? ` (${countryCode})` : '';
  const adminLabel = formatAdminLevelLabel(level);

  if (level <= 0) {
    const label = countryName ? `${adminLabel}: ${countryName}${countrySuffix}` : `${adminLabel}: Unknown`;
    return { level, label };
  }
  if (level === 1) {
    const admin1 = adminName ?? countryName ?? 'Unknown';
    const country = countryName ?? 'Unknown';
    return { level, label: `${adminLabel}: ${admin1} / ${country}${countrySuffix}` };
  }
  const admin2 = adminName ?? 'Unknown';
  const admin1 = pickFirstString(properties, [
    'admin1Name',
    'NAME_1',
    'name_1',
    'ADM1_NAME',
    'admin1',
  ]);
  const country = countryName ?? 'Unknown';
  const parts = [admin2, admin1, country].filter((part): part is string => Boolean(part && part.trim().length > 0));
  return { level, label: `${adminLabel}: ${parts.join(' / ')}${countrySuffix}` };
};

const buildDefaultHoverLabel = (properties: Record<string, unknown>): string | null => {
  const label =
    (properties.name as string | undefined) ??
    (properties.NAME as string | undefined) ??
    (properties.label as string | undefined) ??
    (properties.id as string | number | undefined);
  return label ? String(label) : null;
};

export const buildHoverSnackbarContent = (features: MapLibreGeoJSONFeature[]): React.ReactNode => {
  if (features.length === 0) return '';
  const adminCandidates = features
    .map((feature, index) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const adminParts = buildAdminHoverCandidate(props);
      if (!adminParts) return null;
      return { index, ...adminParts };
    })
    .filter(
      (candidate): candidate is { index: number; level: number; label: string } => Boolean(candidate),
    );
  if (adminCandidates.length > 0) {
    adminCandidates.sort((a, b) => (b.level - a.level) || (a.index - b.index));
    return adminCandidates[0]?.label ?? '';
  }
  const labels = features
    .slice(0, 3)
    .map((feature) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      return buildDefaultHoverLabel(props) ?? 'Feature';
    });
  return labels.join(' / ');
};

export const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

export const isRenderableNode = (value: unknown): value is React.ReactNode => {
  if (value == null || typeof value === 'boolean') return false;
  if (typeof value === 'string' || typeof value === 'number') return true;
  if (Array.isArray(value)) return true;
  return isValidElement(value);
};

export const normalizeChildren = (children: React.ReactNode): React.ReactNode => {
  if (children == null || typeof children === 'boolean') return null;
  if (Array.isArray(children)) {
    const filtered = children.filter(isRenderableNode);
    return filtered.length > 0 ? filtered : null;
  }
  return isRenderableNode(children) ? children : null;
};
