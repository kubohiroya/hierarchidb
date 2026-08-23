import type {
  LocationBuildConfig,
  LocationDataSource,
  LocationSearchConfig,
  LocationType,
} from '~/common/entities/LocationEntity.js';

export const LOCATION_CANONICAL_SOURCE_PLAN_VERSION = 1;

export const LOCATION_CANONICAL_LOCATION_TYPES = [
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
] as const satisfies readonly LocationType[];

export const LOCATION_CANONICAL_NETWORK_DATA_SOURCES = [
  'openstreetmap',
  'overpass',
  'ourairports',
  'openflights',
  'world-port-index',
] as const satisfies readonly LocationDataSource[];

export type LocationCanonicalNetworkDataSource =
  (typeof LOCATION_CANONICAL_NETWORK_DATA_SOURCES)[number];

export type LocationSourceSelectionEntry = {
  countryCode: string;
  types: readonly LocationType[];
};

export type LocationSourcePlanIdentity = {
  schemaVersion: typeof LOCATION_CANONICAL_SOURCE_PLAN_VERSION;
  sourceKind: 'network';
  dataSource: LocationCanonicalNetworkDataSource;
  authScope: 'location';
  parserVersion: string;
  selectionSignature: string;
  requestTargets: readonly string[];
  inputHash: string;
};

export type LocationSourcePlan = {
  sourceKind: 'network';
  dataSource: LocationCanonicalNetworkDataSource;
  selection: readonly LocationSourceSelectionEntry[];
  searchConfigs: readonly LocationSearchConfig[];
  identity: LocationSourcePlanIdentity;
};

export type PreparedLocationBuild = {
  config: LocationBuildConfig;
  sourcePlan: LocationSourcePlan;
};
