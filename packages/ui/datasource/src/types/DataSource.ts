/**
 * @fileoverview Shared data source types and UI utilities only.
 * Do NOT aggregate concrete data source definitions here.
 * Each plugin (shape, location, route) must define its own data sources.
 * @module @hierarchidb/ui-datasource/types
 */

// Keep name as a plain string to avoid central registry of names here
export type DataSourceName = string;

//  face
export interface DataSourceConfig {
  name: DataSourceName;
  displayName: string;
  description: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  website: string;
  maxAdminLevel: number;
  category: 'geographic' | 'location' | 'route';
  licenseType: 'public' | 'academic' | 'odbl' | 'cc' | 'mit' | 'commercial' | 'varies';
}

//  face (UI)
export interface DataSourceInfo extends DataSourceConfig {
  countryCount?: number;
  limitations?: string[];
  features?: string[];
  updateFrequency?: string;
  dataFormat?: string[];
  coverage?: string;
}

// Internal mutable registry to support optional runtime-worker injection
let __DATA_SOURCE_REGISTRY: Record<DataSourceName, DataSourceConfig> = {};

/**
 * Inject a registry defined by actual plugins at runtime-worker.
 * This keeps this module free from concrete definitions while
 * allowing existing selector utilities to function with provided data.
 */
export function setDataSourceRegistry(map: Record<DataSourceName, DataSourceConfig>): void {
  __DATA_SOURCE_REGISTRY = { ...map };
}

/**
 * Get a data source config by name from the injected registry.
 */
export function getDataSourceConfig(name: DataSourceName): DataSourceConfig | undefined {
  return __DATA_SOURCE_REGISTRY[name];
}

/**
 * List data sources by category from the injected registry.
 */
export function getDataSourcesByCategory(
  category: DataSourceConfig['category']
): DataSourceConfig[] {
  return Object.values(__DATA_SOURCE_REGISTRY).filter((config) => config.category === category);
}

/**
 * Deprecated: central registry export is removed. This empty object remains
 * only for backward-compatibility of import sites. Do not rely on it.
 * @deprecated Define and consume data sources from each plugin package.
 */
export const DATA_SOURCES = Object.freeze({}) as Readonly<Record<DataSourceName, DataSourceConfig>>;

// Type aliases for compatibility
export type DataSourceCategory = DataSourceConfig['category'];
export type LicenseType = DataSourceConfig['licenseType'];
export type UsageType = 'personal' | 'academic' | 'commercial';

// Utility functions (UI)
export function getLicenseColor(
  licenseType: LicenseType
): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (licenseType) {
    case 'public':
      return 'success';
    case 'cc':
      return 'success';
    case 'academic':
      return 'warning';
    case 'commercial':
      return 'error';
    case 'varies':
      return 'warning';
    case 'odbl':
      return 'info';
    case 'mit':
      return 'info';
    default:
      return 'default';
  }
}

export function extractLimitations(description: string): string[] {
  const limitations: string[] = [];

  const lower = description.toLowerCase();
  if (lower.includes('academic')) {
    limitations.push('Academic use only');
  }
  if (lower.includes('non-commercial')) {
    limitations.push('Non-commercial use only');
  }
  if (lower.includes('attribution')) {
    limitations.push('Attribution required');
  }
  if (lower.includes('varies')) {
    limitations.push('License varies by data provider');
  }

  return limitations;
}

export function getLicenseLimitations(licenseType: DataSourceConfig['licenseType']): string[] {
  switch (licenseType) {
    case 'public':
      return [];
    case 'cc':
      return ['Attribution required', 'Free for commercial use'];
    case 'academic':
      return ['Academic use only', 'Commercial use requires permission', 'No redistribution'];
    case 'odbl':
      return ['Attribution required', 'Share-alike license'];
    case 'mit':
      return ['Attribution required'];
    case 'commercial':
      return ['Commercial license required'];
    case 'varies':
      return ['License varies by data provider'];
    default:
      return ['Please check specific license terms'];
  }
}
