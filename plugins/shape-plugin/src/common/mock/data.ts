import type {
  CountryMetadata,
  DataSourceConfig,
  UrlMetadata,
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
    licenseUrl: 'https://www.geoboundaries.org/index.html#getdata',
    attribution: 'Data from geoBoundaries.org',
    color: '#2196F3',
    icon: '🗺️',
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
    countryCodeFormat: 'iso2',
  },
  openstreetmap: {
    name: 'openstreetmap',
    displayName: 'OpenStreetMap',
    description: 'Community-driven open geographic database of the world',
    license: 'ODbL 1.0',
    licenseUrl: 'https://www.openstreetmap.org/copyright',
    attribution: '© OpenStreetMap contributors',
    color: '#9C27B0',
    icon: '🚗',
    maxAdminLevel: 4,
    countryCodeFormat: 'iso2',
  },
};

// ================================
// Country Metadata Sample
// ================================

export const SAMPLE_COUNTRIES: CountryMetadata[] = [
  // Asia
  {
    countryCode: 'JPN',
    countryName: 'Japan',
    continent: 'Asia',
    availableAdminLevels: [0, 1, 2, 3],
    population: 125800000,
    area: 377975,
    dataQuality: 'high',
  },
  {
    countryCode: 'CHN',
    countryName: 'China',
    continent: 'Asia',
    availableAdminLevels: [0, 1, 2, 3, 4],
    population: 1444216107,
    area: 9596961,
    dataQuality: 'high',
  },
  {
    countryCode: 'IND',
    countryName: 'India',
    continent: 'Asia',
    availableAdminLevels: [0, 1, 2, 3],
    population: 1393409038,
    area: 3287263,
    dataQuality: 'high',
  },
  {
    countryCode: 'KOR',
    countryName: 'South Korea',
    continent: 'Asia',
    availableAdminLevels: [0, 1, 2],
    population: 51780579,
    area: 100210,
    dataQuality: 'high',
  },

  // Europe
  {
    countryCode: 'DEU',
    countryName: 'Germany',
    continent: 'Europe',
    availableAdminLevels: [0, 1, 2, 3],
    population: 83190556,
    area: 357022,
    dataQuality: 'high',
  },
  {
    countryCode: 'FRA',
    countryName: 'France',
    continent: 'Europe',
    availableAdminLevels: [0, 1, 2, 3],
    population: 67391582,
    area: 643801,
    dataQuality: 'high',
  },
  {
    countryCode: 'GBR',
    countryName: 'United Kingdom',
    continent: 'Europe',
    availableAdminLevels: [0, 1, 2, 3],
    population: 67886011,
    area: 242495,
    dataQuality: 'high',
  },
  {
    countryCode: 'ITA',
    countryName: 'Italy',
    continent: 'Europe',
    availableAdminLevels: [0, 1, 2, 3],
    population: 60461826,
    area: 301340,
    dataQuality: 'high',
  },

  // Americas
  {
    countryCode: 'USA',
    countryName: 'United States',
    continent: 'North America',
    availableAdminLevels: [0, 1, 2, 3],
    population: 331002651,
    area: 9833517,
    dataQuality: 'high',
  },
  {
    countryCode: 'CAN',
    countryName: 'Canada',
    continent: 'North America',
    availableAdminLevels: [0, 1, 2],
    population: 37742154,
    area: 9984670,
    dataQuality: 'high',
  },
  {
    countryCode: 'MEX',
    countryName: 'Mexico',
    continent: 'North America',
    availableAdminLevels: [0, 1, 2],
    population: 128932753,
    area: 1964375,
    dataQuality: 'medium',
  },
  {
    countryCode: 'BRA',
    countryName: 'Brazil',
    continent: 'South America',
    availableAdminLevels: [0, 1, 2, 3],
    population: 212559417,
    area: 8515767,
    dataQuality: 'high',
  },
  {
    countryCode: 'ARG',
    countryName: 'Argentina',
    continent: 'South America',
    availableAdminLevels: [0, 1, 2],
    population: 45195774,
    area: 2780400,
    dataQuality: 'medium',
  },

  // Africa
  {
    countryCode: 'NGA',
    countryName: 'Nigeria',
    continent: 'Africa',
    availableAdminLevels: [0, 1, 2],
    population: 206139589,
    area: 923768,
    dataQuality: 'medium',
  },
  {
    countryCode: 'ZAF',
    countryName: 'South Africa',
    continent: 'Africa',
    availableAdminLevels: [0, 1, 2],
    population: 59308690,
    area: 1221037,
    dataQuality: 'medium',
  },
  {
    countryCode: 'EGY',
    countryName: 'Egypt',
    continent: 'Africa',
    availableAdminLevels: [0, 1, 2],
    population: 102334404,
    area: 1001450,
    dataQuality: 'medium',
  },

  // Oceania
  {
    countryCode: 'AUS',
    countryName: 'Australia',
    continent: 'Oceania',
    availableAdminLevels: [0, 1, 2],
    population: 25499884,
    area: 7692024,
    dataQuality: 'high',
  },
  {
    countryCode: 'NZL',
    countryName: 'New Zealand',
    continent: 'Oceania',
    availableAdminLevels: [0, 1, 2],
    population: 4822233,
    area: 268838,
    dataQuality: 'high',
  },
];

// ================================
// Sample URL Metadata
// ================================

export function generateUrlMetadata(
  countries: string[],
  adminLevels: number[],
  dataSource: string,
): UrlMetadata[] {
  const metadata: UrlMetadata[] = [];

  countries.forEach(countryCode => {
    const country = SAMPLE_COUNTRIES.find(c => c.countryCode === countryCode);
    if (!country) return;

    adminLevels.forEach(level => {
      if (level <= (country.availableAdminLevels?.slice(-1)[0] || 0)) {
        metadata.push({
          url: `https://example.com/${dataSource}/${countryCode}/admin${level}.geojson`,
          countryCode,
          adminLevel: level,
          continent: country.continent,
          lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    });
  });

  return metadata;
}

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
