import type {
  CountryMetadata,
  DataSourceConfig,
} from '../types/index.js';

// ================================
// Data Source Configurations
// ================================

export const DATA_SOURCE_CONFIGS: Record<string, DataSourceConfig> = {
  naturalearth: {
    name: 'naturalearth',
    displayName: 'Natural Earth',
    description: 'Public domain map dataset available at scales suitable for world, regional, and country maps',
    license: 'Public Domain',
    licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    attribution: 'Made with Natural Earth',
    color: '#4CAF50',
    icon: '🌍',
    maxAdminLevel: 1,
    countryCodeFormat: 'iso2',
  },
  geoboundaries: {
    name: 'geoboundaries',
    displayName: 'geoBoundaries',
    description: 'Open-source administrative boundaries for every country in the world',
    license: 'Creative Commons BY 4.0',
    licenseUrl: 'https://geoboundaries.org/index.html#getdata',
    attribution: 'Data from geoBoundaries.org',
    color: '#2196F3',
    icon: '🗺️',
    maxAdminLevel: 3,
    countryCodeFormat: 'iso3',
  },
  'geoboundaries-topojson': {
    name: 'geoboundaries-topojson',
    displayName: 'geoBoundaries:TopoJSON',
    description: 'geoBoundaries TopoJSON with merged ADM0 polygons',
    license: 'Creative Commons BY 4.0',
    licenseUrl: 'https://geoboundaries.org/index.html#getdata',
    attribution: 'Data from geoBoundaries.org',
    color: '#3458D4',
    icon: '🧭',
    maxAdminLevel: 3,
    countryCodeFormat: 'iso3',
  },
  gadm: {
    name: 'gadm',
    displayName: 'GADM',
    description: 'Database of Global Administrative Areas with detailed administrative boundaries',
    license: 'Academic use only',
    licenseUrl: 'https://gadm.org/license.html',
    attribution: 'Data from GADM.org',
    color: '#FF9800',
    icon: '📊',
    maxAdminLevel: 5,
    countryCodeFormat: 'iso3',
  },
};

// ================================
// Utility Functions
// ================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / k ** i * 100) / 100 + ' ' + sizes[i];
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function calculateEstimatedSize(totalSelections: number): number {
  // Rough estimate: 5MB per selection on average
  return totalSelections * 5 * 1024 * 1024;
}

export function calculateEstimatedFeatures(
  totalSelections: number,
  countries: CountryMetadata[],
): number {
  // Rough estimate based on population density
  const avgPopulation = countries.reduce((sum, c) => sum + (c.population || 0), 0) / countries.length;
  const featuresPerMillion = 100; // Rough estimate
  return Math.floor(totalSelections * (avgPopulation / 1000000) * featuresPerMillion);
}
