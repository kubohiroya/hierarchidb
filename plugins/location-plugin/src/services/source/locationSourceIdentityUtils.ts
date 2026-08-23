import { getLocationDataSource } from '~/common/datasources/LocationDataSourceDefinitions.js';
import type { LocationSearchConfig } from '~/common/entities/LocationEntity.js';
import {
  LOCATION_CANONICAL_SOURCE_PLAN_VERSION,
  type LocationCanonicalNetworkDataSource,
  type LocationSourcePlanIdentity,
  type LocationSourceSelectionEntry,
} from './LocationSourcePlan.js';

const PARSER_VERSION_BY_SOURCE: Record<LocationCanonicalNetworkDataSource, string> = {
  openstreetmap: 'nominatim-json-v1',
  overpass: 'overpass-json-v1',
  ourairports: 'ourairports-csv-v1',
  openflights: 'openflights-dat-v1',
  'world-port-index': 'world-port-index-csv-v1',
};

export const resolveLocationParserVersion = (
  dataSource: LocationCanonicalNetworkDataSource
): string => PARSER_VERSION_BY_SOURCE[dataSource];

export const createLocationSelectionSignature = (
  selection: readonly LocationSourceSelectionEntry[]
): string =>
  selection.map((entry) => `${entry.countryCode}:${[...entry.types].sort().join(',')}`).join('|');

export const resolveLocationRequestTargets = (
  dataSource: LocationCanonicalNetworkDataSource,
  searchConfigs: readonly LocationSearchConfig[]
): readonly string[] => {
  const source = getLocationDataSource(dataSource);
  const endpoint = source?.endpoints;
  const targets = searchConfigs.map((config) => {
    const override = config.options?.sourceUrl;
    if (typeof override === 'string' && override.length > 0) return override;
    switch (dataSource) {
      case 'openstreetmap':
        return String(config.options?.nominatimEndpoint ?? endpoint?.search ?? '');
      case 'overpass':
        return String(config.options?.overpassEndpoint ?? endpoint?.interpreter ?? '');
      case 'ourairports':
      case 'openflights':
        return String(endpoint?.airports ?? '');
      case 'world-port-index':
        return String(endpoint?.ports ?? '');
    }
  });
  if (targets.some((target) => target.length === 0)) {
    throw new Error(`[location source plan] ${dataSource} has an empty request target`);
  }
  return [...new Set(targets)].sort();
};

export const createLocationSourcePlanIdentity = (input: {
  dataSource: LocationCanonicalNetworkDataSource;
  selection: readonly LocationSourceSelectionEntry[];
  searchConfigs: readonly LocationSearchConfig[];
}): LocationSourcePlanIdentity => {
  const parserVersion = resolveLocationParserVersion(input.dataSource);
  const selectionSignature = createLocationSelectionSignature(input.selection);
  const requestTargets = resolveLocationRequestTargets(input.dataSource, input.searchConfigs);
  const stablePayload = {
    schemaVersion: LOCATION_CANONICAL_SOURCE_PLAN_VERSION,
    sourceKind: 'network',
    dataSource: input.dataSource,
    authScope: 'location',
    parserVersion,
    selectionSignature,
    requestTargets,
  } satisfies Omit<LocationSourcePlanIdentity, 'inputHash'>;
  return {
    ...stablePayload,
    inputHash: `locsrc:${fnv1a64(JSON.stringify(stablePayload))}`,
  };
};

const fnv1a64 = (value: string): string => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
};
