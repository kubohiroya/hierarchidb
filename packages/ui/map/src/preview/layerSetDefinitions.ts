import {
  buildShapeSourceLayerName as buildShapeSourceLayerNameFromSdk,
  type ShapeLayerBoundarySymbol as GisShapeLayerBoundarySymbol,
  type ShapeSourceLayerName as GisShapeSourceLayerName,
  type LayerNameBoundaryMode,
  parseShapeSourceLayerName,
} from '@hierarchidb/gis-sdk';

type BrandedString<T extends string, TBrand extends string> = T & { readonly __brand: TBrand };

export type LayerSetId = 'location' | 'route' | 'shape';

export type NodeTypeSymbol = BrandedString<'s' | 'l' | 'r', 'NodeTypeSymbol'>;
export type ShapeLayerSymbol = BrandedString<'f' | 'b', 'ShapeLayerSymbol'>;
export type LocationLayerSymbol = BrandedString<'p' | 's', 'LocationLayerSymbol'>;
export type RouteLayerSymbol = BrandedString<'l', 'RouteLayerSymbol'>;
export type AdminLevel = number;
export type ShapeSourceLayerName = GisShapeSourceLayerName;
export type ShapeLayerBoundarySymbol = GisShapeLayerBoundarySymbol;
export type ShapeLayerShortId = BrandedString<string, 'ShapeLayerShortId'>;
export type LayerSetEntryId = BrandedString<string, 'LayerSetEntryId'>;
type ShapeBoundaryMode = LayerNameBoundaryMode;
const toShapeLayerBoundarySymbol = (boundary: LayerNameBoundaryMode): ShapeLayerBoundarySymbol =>
  (boundary === 'boundary' ? 'b' : 'f') as ShapeLayerBoundarySymbol;

export const buildShapeLayerShortId = (adminLevel: number, boundary: boolean): ShapeLayerShortId =>
  `${adminLevel}-${toShapeLayerBoundarySymbol(boundary ? 'boundary' : 'fill')}` as ShapeLayerShortId;

const toNodeTypeSymbol = (nodeType: LayerSetId): NodeTypeSymbol =>
  (nodeType === 'shape' ? 's' : nodeType === 'route' ? 'r' : 'l') as NodeTypeSymbol;

const toLocationLayerSymbol = (layerType: 'points' | 'symbols'): LocationLayerSymbol =>
  (layerType === 'points' ? 'p' : 's') as LocationLayerSymbol;
export const toLayerSetEntryId = (value: string): LayerSetEntryId => value as LayerSetEntryId;

export const buildLocationLayerSetEntryId = (layerType: 'points' | 'symbols'): LayerSetEntryId =>
  toLayerSetEntryId(`${toNodeTypeSymbol('location')}-${toLocationLayerSymbol(layerType)}`);
export const buildRouteLayerSetEntryId = (): LayerSetEntryId =>
  toLayerSetEntryId(`${toNodeTypeSymbol('route')}-${'l' as RouteLayerSymbol}`);

const LOCATION_POINTS_ENTRY_ID = buildLocationLayerSetEntryId('points');
const LOCATION_SYMBOLS_ENTRY_ID = buildLocationLayerSetEntryId('symbols');
const ROUTE_LINE_ENTRY_ID = buildRouteLayerSetEntryId();
export { LOCATION_POINTS_ENTRY_ID, LOCATION_SYMBOLS_ENTRY_ID, ROUTE_LINE_ENTRY_ID };

type BuildLayerSetEntryIdParams =
  | { layerSetId: 'shape'; adminLevel: number; boundary: boolean }
  | { layerSetId: 'location'; layerType: 'points' | 'symbols' }
  | { layerSetId: 'route'; layerType: 'line' };

export const buildLayerSetEntryId = (params: BuildLayerSetEntryIdParams): LayerSetEntryId => {
  if (params.layerSetId === 'shape') {
    const adminLevel = params.adminLevel;
    if (adminLevel == null) {
      throw new Error('[LayerSetDefinition] Shape layer must provide adminLevel.');
    }
    return toLayerSetEntryId(
      `${toNodeTypeSymbol('shape')}-${adminLevel}-${params.boundary ? 'b' : 'f'}`
    );
  }
  if (params.layerSetId === 'location') {
    if (params.layerType === 'points' || params.layerType === 'symbols') {
      return buildLocationLayerSetEntryId(params.layerType);
    }
    throw new Error('[LayerSetDefinition] Location layer must use points or symbols.');
  }
  if (params.layerSetId === 'route') {
    if (params.layerType === 'line') {
      return buildRouteLayerSetEntryId();
    }
    throw new Error('[LayerSetDefinition] Route layer must use line.');
  }
  throw new Error('[LayerSetDefinition] Unknown layerSetId.');
};

export const buildShapeSourceLayerName = (
  adminLevel: number,
  mode: ShapeBoundaryMode = 'fill'
): ShapeSourceLayerName => buildShapeSourceLayerNameFromSdk(adminLevel, mode);

export { parseShapeSourceLayerName };

export const buildSourceLayerName = (
  adminLevel: number,
  boundary?: boolean
): ShapeSourceLayerName => buildShapeSourceLayerName(adminLevel, boundary ? 'boundary' : 'fill');

export const buildShapeSourceLayerShortId = (
  adminLevel: number,
  boundary: boolean
): ShapeLayerShortId => buildShapeLayerShortId(adminLevel, boundary);

export const buildRouteSourceLayerName = (): string => 'layer0';

export const formatAdminLevelLabel = (value?: number): string =>
  typeof value === 'number' && Number.isFinite(value) ? `ADM${value}` : 'Base';

export const buildShapeLayerEntryId = (adminLevel: number, boundary: boolean): LayerSetEntryId =>
  buildLayerSetEntryId({ layerSetId: 'shape', adminLevel, boundary });

export type LayerSetEntry = {
  id: LayerSetEntryId;
  label: string;
  adminLevel?: number;
  boundary?: boolean;
  layerType: 'line' | 'fill' | 'circle' | 'symbol';
};

export type LayerSetDefinition = {
  id: LayerSetId;
  label: string;
  priority: number;
  entries: LayerSetEntry[];
};

export type ResolvedLayerSetEntry = LayerSetEntry & {
  layerSetId: LayerSetId;
  hierarchyLevel?: number;
  sourceLayer?: string;
  priority: number;
};

const normalizeSourceLayerNames = (layerNames: string[]): ReadonlySet<string> => {
  if (layerNames.length === 0) return new Set();
  const normalized = new Set<string>();
  layerNames
    .map((name) => parseShapeSourceLayerName(name))
    .filter((parsed): parsed is { adminLevel: number; boundary: ShapeLayerBoundarySymbol } =>
      Boolean(parsed)
    )
    .forEach((parsed) => {
      normalized.add(
        buildShapeSourceLayerName(parsed.adminLevel, parsed.boundary === 'b' ? 'boundary' : 'fill')
      );
    });
  return normalized;
};

export const DEFAULT_LAYER_SETS: LayerSetDefinition[] = [
  {
    id: 'location',
    label: 'Location',
    priority: 3,
    entries: [
      { id: LOCATION_POINTS_ENTRY_ID, label: 'Points', layerType: 'circle' },
      { id: LOCATION_SYMBOLS_ENTRY_ID, label: 'Symbols', layerType: 'symbol' },
    ],
  },
  {
    id: 'route',
    label: 'Route',
    priority: 2,
    entries: [{ id: ROUTE_LINE_ENTRY_ID, label: 'Route Line', layerType: 'line' }],
  },
  {
    id: 'shape',
    label: 'Shape',
    priority: 1,
    entries: [
      {
        id: buildShapeLayerEntryId(0, true),
        label: 'ADM0 Boundary',
        adminLevel: 0,
        boundary: true,
        layerType: 'line',
      },
      {
        id: buildShapeLayerEntryId(0, false),
        label: 'ADM0 Fill',
        adminLevel: 0,
        boundary: false,
        layerType: 'fill',
      },
      {
        id: buildShapeLayerEntryId(1, true),
        label: 'ADM1 Boundary',
        adminLevel: 1,
        boundary: true,
        layerType: 'line',
      },
      {
        id: buildShapeLayerEntryId(1, false),
        label: 'ADM1 Fill',
        adminLevel: 1,
        boundary: false,
        layerType: 'fill',
      },
      {
        id: buildShapeLayerEntryId(2, true),
        label: 'ADM2 Boundary',
        adminLevel: 2,
        boundary: true,
        layerType: 'line',
      },
      {
        id: buildShapeLayerEntryId(2, false),
        label: 'ADM2 Fill',
        adminLevel: 2,
        boundary: false,
        layerType: 'fill',
      },
    ],
  },
];

export const getLayerSetDefinition = (
  id: string | null | undefined
): LayerSetDefinition | undefined => DEFAULT_LAYER_SETS.find((set) => set.id === id);

export type ResolveLayerSetEntriesOptions = {
  allowedAdminLevels?: ReadonlySet<number> | readonly number[];
};

const toAllowedAdminLevelSet = (
  value?: ResolveLayerSetEntriesOptions['allowedAdminLevels']
): ReadonlySet<number> | null => {
  if (!value) return null;
  if (value instanceof Set) {
    return value;
  }
  if (Array.isArray(value)) {
    return new Set(value);
  }
  return null;
};

export const resolveLayerSetEntries = (
  tileLayerNames: string[],
  layerSet: LayerSetDefinition,
  options: ResolveLayerSetEntriesOptions = {}
): ResolvedLayerSetEntry[] => {
  const canonicalLayerNames = normalizeSourceLayerNames(tileLayerNames);
  const allowedAdminLevels = toAllowedAdminLevelSet(options.allowedAdminLevels);
  const totalEntries = layerSet.entries.length;
  return layerSet.entries.map((entry, index) => {
    const expectedLayerName =
      typeof entry.adminLevel === 'number'
        ? buildSourceLayerName(entry.adminLevel, entry.boundary)
        : undefined;
    if (
      allowedAdminLevels &&
      typeof entry.adminLevel === 'number' &&
      !allowedAdminLevels.has(entry.adminLevel)
    ) {
      const priorityBase = layerSet.priority * 100;
      const priority = priorityBase + entry.adminLevel * 10 + (entry.boundary ? 1 : 0);
      return {
        ...entry,
        layerSetId: layerSet.id,
        hierarchyLevel: entry.adminLevel,
        sourceLayer: undefined,
        priority,
      };
    }
    const resolvedLayerName = expectedLayerName
      ? canonicalLayerNames.has(expectedLayerName)
        ? expectedLayerName
        : undefined
      : undefined;
    const sourceLayer = entry.adminLevel == null ? undefined : resolvedLayerName;
    const priorityBase = layerSet.priority * 100;
    const priority =
      typeof entry.adminLevel === 'number'
        ? priorityBase + entry.adminLevel * 10 + (entry.boundary ? 1 : 0)
        : priorityBase + (totalEntries - index);
    return {
      ...entry,
      layerSetId: layerSet.id,
      hierarchyLevel: entry.adminLevel,
      sourceLayer,
      priority,
    };
  });
};
