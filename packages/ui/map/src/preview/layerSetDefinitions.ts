export type LayerSetId = 'location' | 'route' | 'shape';

export type LayerSetEntry = {
  id: string;
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

const normalizeLayerName = (value: string): string => value.trim().toLowerCase();

const resolveAdminLayerName = (adminLevel: number, boundary?: boolean): string =>
  boundary ? `admin${adminLevel}-boundary` : `admin${adminLevel}`;

const canonicalizeLayerName = (value: string): string =>
  normalizeLayerName(value).replace(/[^a-z0-9]/g, '');

const buildExpectedLayerNameAliases = (value: string): string[] => {
  const raw = canonicalizeLayerName(value);
  const normalizedVariants = new Set<string>([raw]);
  if (raw.startsWith('admin')) {
    normalizedVariants.add(`adm${raw.slice(5)}`);
  }
  if (raw.startsWith('adm')) {
    normalizedVariants.add(`admin${raw.slice(3)}`);
  }
  return Array.from(normalizedVariants);
};

const parseLayerName = (value: string) => {
  const normalized = normalizeLayerName(value);
  const match = normalized.match(/(?:admin|adm)(\d+)/);
  const boundary = normalized.includes('boundary');
  return {
    normalized,
    canonical: canonicalizeLayerName(value),
    adminLevel: match ? Number(match[1]) : undefined,
    boundary,
  };
};

const findMatchingLayerName = (layerNames: string[], expected: string): string | undefined => {
  if (layerNames.length === 0) return undefined;
  const expectedAliases = buildExpectedLayerNameAliases(expected);
  const expectedInfo = parseLayerName(expected);
  const expectedSet = new Set(expectedAliases);
  const normalizedLayers = layerNames.map((name) => ({ name, ...parseLayerName(name) }));
  const exact = normalizedLayers.find((entry) => expectedSet.has(entry.canonical) || entry.normalized === normalizeLayerName(expected));
  if (exact) return exact.name;
  const endsWith = normalizedLayers.find((entry) =>
    expectedAliases.some((alias) => entry.canonical.endsWith(alias)),
  );
  if (endsWith) return endsWith.name;
  const included = normalizedLayers.find((entry) =>
    expectedAliases.some((alias) => entry.canonical.includes(alias)),
  );
  if (included) return included.name;
  if (expectedInfo.adminLevel == null) return undefined;
  const sameAdmin = normalizedLayers.filter((entry) => entry.adminLevel === expectedInfo.adminLevel);
  const exactBoundary = sameAdmin.find((entry) => entry.boundary === expectedInfo.boundary);
  if (exactBoundary) return exactBoundary.name;
  return sameAdmin[0]?.name;
};

export const DEFAULT_LAYER_SETS: LayerSetDefinition[] = [
  {
    id: 'location',
    label: 'Location',
    priority: 3,
    entries: [
      { id: 'location-points', label: 'Points', layerType: 'circle' },
      { id: 'location-symbols', label: 'Symbols', layerType: 'symbol' },
    ],
  },
  {
    id: 'route',
    label: 'Route',
    priority: 2,
    entries: [
      { id: 'route-line', label: 'Route Line', layerType: 'line' },
    ],
  },
  {
    id: 'shape',
    label: 'Shape',
    priority: 1,
    entries: [
      { id: 'shape-adm0-boundary', label: 'ADM0 Boundary', adminLevel: 0, boundary: true, layerType: 'line' },
      { id: 'shape-adm0-fill', label: 'ADM0 Fill', adminLevel: 0, boundary: false, layerType: 'fill' },
      { id: 'shape-adm1-boundary', label: 'ADM1 Boundary', adminLevel: 1, boundary: true, layerType: 'line' },
      { id: 'shape-adm1-fill', label: 'ADM1 Fill', adminLevel: 1, boundary: false, layerType: 'fill' },
      { id: 'shape-adm2-boundary', label: 'ADM2 Boundary', adminLevel: 2, boundary: true, layerType: 'line' },
      { id: 'shape-adm2-fill', label: 'ADM2 Fill', adminLevel: 2, boundary: false, layerType: 'fill' },
    ],
  },
];

export const getLayerSetDefinition = (id: string | null | undefined): LayerSetDefinition | undefined =>
  DEFAULT_LAYER_SETS.find((set) => set.id === id);

export const resolveLayerSetEntries = (
  tileLayerNames: string[],
  layerSet: LayerSetDefinition,
): ResolvedLayerSetEntry[] => {
  const totalEntries = layerSet.entries.length;
  return layerSet.entries.map((entry, index) => {
    const expectedLayerName =
      typeof entry.adminLevel === 'number' ? resolveAdminLayerName(entry.adminLevel, entry.boundary) : undefined;
    const sourceLayer = expectedLayerName
      ? findMatchingLayerName(tileLayerNames, expectedLayerName) ?? expectedLayerName
      : undefined;
    const priorityBase = layerSet.priority * 100;
    const priority = typeof entry.adminLevel === 'number'
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
