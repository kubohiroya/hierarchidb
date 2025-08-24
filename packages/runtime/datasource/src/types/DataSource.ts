/**
 * @fileoverview Data source types and configurations
 * @module @hierarchidb/ui-datasource/types
 */

// 基本的なデータソース名の定義
export const DataSourceNames = {
  // Geographic boundary data sources
  NaturalEarth: "naturalearth",
  OpenStreetMap: "openstreetmap", 
  GADM: "gadm",
  GeoBoundaries: "geoboundaries",
  
  // Location/Point data sources
  NaturalEarthPopulatedPlaces: "naturalearth-populated-places",
  OurAirports: "ourairports",
  WorldPortIndex: "world-port-index",
  
  // Route/Connection data sources
  OpenFlights: "openflights",
  Transitland: "transitland",
  SearouteJS: "searoute-js",
  NaturalEarthRivers: "naturalearth-rivers",
} as const;

export type DataSourceName = (typeof DataSourceNames)[keyof typeof DataSourceNames];

// データソース設定インターface
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

// データソース情報インターface (UI表示用の追加情報)
export interface DataSourceInfo extends DataSourceConfig {
  countryCount?: number;
  limitations?: string[];
  features?: string[];
  updateFrequency?: string;
  dataFormat?: string[];
  coverage?: string;
}

// デフォルトのデータソース設定
export const DataSourceConfigs: Record<DataSourceName, DataSourceConfig> = {
  // Geographic boundary data sources
  [DataSourceNames.NaturalEarth]: {
    name: DataSourceNames.NaturalEarth,
    displayName: "Natural Earth",
    description: "Free vector and raster map data at 1:10m, 1:50m, and 1:110m scales",
    license: "Public Domain",
    licenseUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
    attribution: "Made with Natural Earth",
    website: "https://www.naturalearthdata.com/",
    maxAdminLevel: 1,
    category: 'geographic',
    licenseType: 'public',
  },
  [DataSourceNames.OpenStreetMap]: {
    name: DataSourceNames.OpenStreetMap,
    displayName: "OpenStreetMap",
    description: "Free editable map of the world",
    license: "Open Database License (ODbL)",
    licenseUrl: "https://www.openstreetmap.org/copyright",
    attribution: "© OpenStreetMap contributors",
    website: "https://www.openstreetmap.org/",
    maxAdminLevel: 10,
    category: 'geographic',
    licenseType: 'odbl',
  },
  [DataSourceNames.GADM]: {
    name: DataSourceNames.GADM,
    displayName: "GADM",
    description: "Database of Global Administrative Areas",
    license: "Academic use only",
    licenseUrl: "https://gadm.org/license.html",
    attribution: "Data from GADM",
    website: "https://gadm.org/",
    maxAdminLevel: 5,
    category: 'geographic',
    licenseType: 'academic',
  },
  [DataSourceNames.GeoBoundaries]: {
    name: DataSourceNames.GeoBoundaries,
    displayName: "geoBoundaries", 
    description: "Open database of political administrative boundaries",
    license: "CC BY 4.0",
    licenseUrl: "https://www.geoboundaries.org/index.html#usage",
    attribution: "Data from geoBoundaries",
    website: "https://www.geoboundaries.org/",
    maxAdminLevel: 3,
    category: 'geographic',
    licenseType: 'cc',
  },
  
  // Location data sources
  [DataSourceNames.NaturalEarthPopulatedPlaces]: {
    name: DataSourceNames.NaturalEarthPopulatedPlaces,
    displayName: "Natural Earth Populated Places",
    description: "Major cities and populated places worldwide",
    license: "Public Domain",
    licenseUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
    attribution: "Made with Natural Earth",
    website: "https://www.naturalearthdata.com/",
    maxAdminLevel: 0,
    category: 'location',
    licenseType: 'public',
  },
  [DataSourceNames.OurAirports]: {
    name: DataSourceNames.OurAirports,
    displayName: "OurAirports",
    description: "Global airport database with IATA/ICAO codes",
    license: "Open Database License (ODbL)",
    licenseUrl: "https://ourairports.com/about.html#license",
    attribution: "© OurAirports contributors",
    website: "https://ourairports.com/",
    maxAdminLevel: 0,
    category: 'location',
    licenseType: 'odbl',
  },
  [DataSourceNames.WorldPortIndex]: {
    name: DataSourceNames.WorldPortIndex,
    displayName: "World Port Index",
    description: "Major ports worldwide from US government data",
    license: "Public Domain",
    licenseUrl: "https://msi.nga.mil/Publications/WPI",
    attribution: "Data from World Port Index (NGA)",
    website: "https://msi.nga.mil/Publications/WPI",
    maxAdminLevel: 0,
    category: 'location',
    licenseType: 'public',
  },
  
  // Route data sources
  [DataSourceNames.OpenFlights]: {
    name: DataSourceNames.OpenFlights,
    displayName: "OpenFlights",
    description: "Flight route data between airports worldwide", 
    license: "Open Database License (ODbL)",
    licenseUrl: "https://openflights.org/data.html#license",
    attribution: "© OpenFlights contributors",
    website: "https://openflights.org/",
    maxAdminLevel: 0,
    category: 'route',
    licenseType: 'odbl',
  },
  [DataSourceNames.Transitland]: {
    name: DataSourceNames.Transitland,
    displayName: "Transitland",
    description: "GTFS feeds from transit operators worldwide",
    license: "Varies by operator",
    licenseUrl: "https://www.transit.land/documentation/licenses/",
    attribution: "Data from Transitland operators",
    website: "https://www.transit.land/",
    maxAdminLevel: 0,
    category: 'route',
    licenseType: 'varies',
  },
  [DataSourceNames.SearouteJS]: {
    name: DataSourceNames.SearouteJS,
    displayName: "searoute-js",
    description: "Calculated maritime routes between ports",
    license: "MIT",
    licenseUrl: "https://github.com/eurostat/searoute-js/blob/master/LICENSE",
    attribution: "Routes calculated by searoute-js",
    website: "https://github.com/eurostat/searoute-js",
    maxAdminLevel: 0,
    category: 'route',
    licenseType: 'mit',
  },
  [DataSourceNames.NaturalEarthRivers]: {
    name: DataSourceNames.NaturalEarthRivers,
    displayName: "Natural Earth Rivers",
    description: "Major river systems worldwide",
    license: "Public Domain",
    licenseUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
    attribution: "Made with Natural Earth",
    website: "https://www.naturalearthdata.com/",
    maxAdminLevel: 0,
    category: 'route',
    licenseType: 'public',
  },
};

// ユーティリティ関数
export const DEFAULT_DATA_SOURCE = DataSourceNames.NaturalEarth;

export const DataSourceNameArray = Object.values(DataSourceNames) as DataSourceName[];

// Export aliases for compatibility
export { DataSourceConfigs as DATA_SOURCES };

// Type aliases for compatibility
export type DataSourceCategory = DataSourceConfig['category'];
export type LicenseType = DataSourceConfig['licenseType'];  
export type UsageType = 'personal' | 'academic' | 'commercial';

// Utility functions
export function getDataSourceConfig(name: DataSourceName): DataSourceConfig | undefined {
  return DataSourceConfigs[name];
}

export function getDataSourcesByCategory(category: DataSourceConfig['category']): DataSourceConfig[] {
  return Object.values(DataSourceConfigs).filter(config => config.category === category);
}

export function getLicenseColor(licenseType: LicenseType): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (licenseType) {
    case 'public': return 'success';
    case 'cc': return 'success';
    case 'academic': return 'warning';
    case 'commercial': return 'error';
    case 'varies': return 'warning';
    case 'odbl': return 'info';
    case 'mit': return 'info';
    default: return 'default';
  }
}

export function extractLimitations(description: string): string[] {
  const limitations: string[] = [];
  
  if (description.includes('academic')) {
    limitations.push('Academic use only');
  }
  if (description.includes('non-commercial')) {
    limitations.push('Non-commercial use only');
  }
  if (description.includes('attribution')) {
    limitations.push('Attribution required');
  }
  if (description.includes('varies')) {
    limitations.push('License varies by data provider');
  }
  
  return limitations;
}

// ライセンス制限の取得
export function getLicenseLimitations(licenseType: DataSourceConfig['licenseType']): string[] {
  switch (licenseType) {
    case 'public': return [];
    case 'cc': return ['Attribution required', 'Free for commercial use'];
    case 'academic': return ['Academic use only', 'Commercial use requires permission', 'No redistribution'];
    case 'odbl': return ['Attribution required', 'Share-alike license'];
    case 'mit': return ['Attribution required'];
    case 'commercial': return ['Commercial license required'];
    case 'varies': return ['License varies by data provider'];
    default: return ['Please check specific license terms'];
  }
}