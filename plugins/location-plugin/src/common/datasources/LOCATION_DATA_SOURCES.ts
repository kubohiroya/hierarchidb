/**
 * Location plugin: Data source definitions
 * These are defined locally to the plugin as requested. Do not import from UI package.
 */

import {
  type LocationDataSourceBase,
  LocationDataSources,
} from './LocationDataSourceDefinitions.js';

export type LocationDataSourceCategory = 'location';

export interface LocationDataSourceConfig {
  name: string;
  displayName: string;
  description: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  website: string;
  maxAdminLevel: number;
  category: LocationDataSourceCategory; // always 'location'
  licenseType: 'public' | 'odbl' | 'cc' | 'mit' | 'academic' | 'commercial' | 'varies';
}

function toConfig(source: LocationDataSourceBase): LocationDataSourceConfig {
  return {
    name: source.id,
    displayName: source.displayName ?? source.name,
    description: source.description ?? source.name,
    license: source.license,
    licenseUrl: source.licenseUrl ?? '',
    attribution: source.attribution ?? '',
    website: source.website ?? source.baseUrl,
    maxAdminLevel: source.maxAdminLevel ?? 0,
    category: source.category ?? 'location',
    licenseType: source.licenseType ?? 'varies',
  };
}

/**
 * Default location data sources provided by this plugin.
 * Derived from LocationDataSourceDefinitions.ts to keep a single source of truth.
 */
export const LOCATION_DATA_SOURCES: ReadonlyArray<LocationDataSourceConfig> =
  Object.values(LocationDataSources).map(toConfig);

export default LOCATION_DATA_SOURCES;
