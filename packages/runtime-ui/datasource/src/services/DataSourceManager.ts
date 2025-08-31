/**
 * DataSourceManager - Manages different geographic data sources
 * 
 * Handles:
 * - Data source registration and discovery
 * - Country metadata retrieval using pre-fetched metadata
 * - Data source validation
 * - URL generation for downloads
 * - Rate limiting and authentication
 */

import type {
  DataSourceName,
} from '../types/DataSource';
// Import metadata generated at build time
// Note: Using require for JSON imports due to TypeScript resolution issues
const gadmMetadata = require('@hierarchidb/runtime-shared-fetch-metadata/output/gadm.json');
const naturalEarthMetadata = require('@hierarchidb/runtime-shared-fetch-metadata/output/naturalearth.json');
const geoboundariesMetadata = require('@hierarchidb/runtime-shared-fetch-metadata/output/geoboundaries.json');
const osmMetadata = require('@hierarchidb/runtime-shared-fetch-metadata/output/osm.json');

// Type for fetched metadata
interface FetchedCountryMetadata {
  id: string;
  name: string;
  countryName: string;
  countryCode: string;
  iso2: string;
  iso3: string;
  continent: string;
  region: string;
  subregion: string;
  adminLevels: number[];
  numAdminLevels: number;
  bbox: [number, number, number, number];
  population?: number;
  area?: number;
}
// Note: geoboundaries and osm metadata not used yet
// import geoboundariesMetadata from '@hierarchidb/runtime-shared-fetch-metadata/output/geoboundaries.json';
// import osmMetadata from '@hierarchidb/runtime-shared-fetch-metadata/output/osm.json';

export interface CountryMetadata {
  countryCode: string;
  countryName: string;
  countryNameLocal?: string;
  adminLevels: AdminLevelInfo[];
  bbox: BoundingBox;
  center: [number, number];
  featureCount: number;
  dataSize?: number;
  lastUpdated: string;
  available: boolean;
}

export interface AdminLevelInfo {
  level: number;
  name: string;
  localName?: string;
  description?: string;
  featureCount: number;
  averageVertices?: number;
  available: boolean;
  dataSize?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{type: string; message: string; severity: 'error' | 'warning'}>;
  warnings: string[];
  metadata: Record<string, string | number | boolean>;
}

export type BoundingBox = [number, number, number, number]; // [minX, minY, maxX, maxY]

export interface DataSourceInfo {
  name: DataSourceName;
  displayName: string;
  description: string;
  license: string;
  licenseUrl?: string;
  attribution: string;
  website?: string;
  availableCountries: string[];
  maxAdminLevel: number;
  dataFormat: 'geojson' | 'topojson' | 'shapefile' | 'pbf';
  updateFrequency: string;
  lastUpdated?: string;
  estimatedSize?: number;
  features: string[];
}

export interface DataSourceStrategy {
  readonly name: DataSourceName;
  readonly displayName: string;
  readonly description: string;
  readonly license: string;
  readonly attribution: string;
  readonly website?: string;
  readonly maxAdminLevel: number;
  readonly dataFormat: 'geojson' | 'topojson' | 'shapefile' | 'pbf';
  readonly requiresAuth: boolean;

  // Core methods
  getAvailableCountries(): Promise<string[]>;
  getCountryMetadata(countryCode: string): Promise<CountryMetadata>;
  generateDownloadUrl(countryCode: string, adminLevel: number, options?: any): Promise<string>;
  validateRequest(countryCode: string, adminLevel: number): Promise<ValidationResult>;
  
  // Optional capabilities
  supportsAdminLevel?(level: number): boolean;
  getRateLimit?(): { requestsPerSecond: number; burstSize: number };
  getEstimatedSize?(countryCode: string, adminLevel: number): Promise<number>;
}

/**
 * GADM (Global Administrative Areas) Strategy
 */
export class GADMStrategy implements DataSourceStrategy {
  readonly name: DataSourceName = 'gadm';
  readonly displayName = 'GADM Administrative Areas';
  readonly description = 'Global administrative boundaries database';
  readonly license = 'Academic use only - Commercial use requires license';
  readonly attribution = 'GADM (www.gadm.org)';
  readonly website = 'https://gadm.org';
  readonly maxAdminLevel = 5;
  readonly dataFormat = 'geojson' as const;
  readonly requiresAuth = false;

  private readonly baseUrl = 'https://geodata.ucdavis.edu/gadm/gadm4.1/json';
  private readonly metadata = gadmMetadata as FetchedCountryMetadata[];

  async getAvailableCountries(): Promise<string[]> {
    return this.metadata.map(country => country.iso2);
  }

  async getCountryMetadata(countryCode: string): Promise<CountryMetadata> {
    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode || c.iso3 === countryCode);
    
    if (!country) {
      throw new Error(`Country ${countryCode} not found in GADM metadata`);
    }

    return {
      countryCode: country.iso2,
      countryName: country.name,
      adminLevels: country.adminLevels.map((level: number) => ({
        level,
        name: this.getAdminLevelName(level, country.iso2),
        featureCount: this.estimateFeatureCount(country.iso2, level),
        available: true
      })),
      bbox: country.bbox,
      center: this.calculateCenter(country.bbox),
      featureCount: country.adminLevels.reduce((sum: number, level: number) => sum + this.estimateFeatureCount(country.iso2, level), 0),
      lastUpdated: '2024-01-01',
      available: true
    };
  }

  async generateDownloadUrl(countryCode: string, adminLevel: number): Promise<string> {
    const validation = await this.validateRequest(countryCode, adminLevel);
    if (!validation.isValid) {
      throw new Error(`Invalid request: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode);
    if (!country) {
      throw new Error(`Country ${countryCode} not found`);
    }

    return `${this.baseUrl}/gadm41_${country.iso3}_${adminLevel}.json`;
  }

  async validateRequest(countryCode: string, adminLevel: number): Promise<ValidationResult> {
    const errors: Array<{type: string; message: string; severity: 'error' | 'warning'}> = [];
    const warnings: string[] = [];

    // Check country availability
    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode);
    if (!country) {
      errors.push({
        type: 'COUNTRY_NOT_AVAILABLE',
        message: `Country ${countryCode} is not available in GADM`,
        severity: 'error'
      });
    } else {
      // Check admin level
      if (!country.adminLevels.includes(adminLevel)) {
        errors.push({
          type: 'INVALID_ADMIN_LEVEL',
          message: `Admin level ${adminLevel} not supported for ${countryCode}`,
          severity: 'error'
        });
      }
    }

    // Add warnings for large datasets
    if (adminLevel >= 3) {
      warnings.push('High admin levels may result in large datasets and longer processing times');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        estimatedFeatures: country ? this.estimateFeatureCount(country.iso2, adminLevel) : 0,
        estimatedSizeMB: country ? this.estimateDataSize(country.iso2, adminLevel) : 0,
        dataFormat: this.dataFormat
      }
    };
  }

  supportsAdminLevel(level: number): boolean {
    return level >= 0 && level <= this.maxAdminLevel;
  }

  getRateLimit() {
    return { requestsPerSecond: 2, burstSize: 5 };
  }

  async getEstimatedSize(countryCode: string, adminLevel: number): Promise<number> {
    return this.estimateDataSize(countryCode, adminLevel) * 1024 * 1024; // Convert MB to bytes
  }

  private getAdminLevelName(level: number, countryCode: string): string {
    const levelNames: Record<string, string[]> = {
      'JP': ['Country', 'Prefectures', 'Municipalities', 'Districts', 'Neighborhoods'],
      'US': ['Country', 'States', 'Counties', 'Municipalities', 'Districts'],
      'GB': ['Country', 'Nations', 'Counties', 'Districts', 'Wards']
    };

    const names = levelNames[countryCode] || ['Country', 'Level 1', 'Level 2', 'Level 3', 'Level 4'];
    return names[level] || `Level ${level}`;
  }

  private estimateFeatureCount(countryCode: string, adminLevel: number): number {
    const baseCounts: Record<string, number[]> = {
      'JP': [1, 47, 1741, 8000, 15000],
      'US': [1, 50, 3142, 15000, 30000],
      'GB': [1, 4, 400, 2000, 8000],
      'FR': [1, 18, 342, 2000, 8000],
      'DE': [1, 16, 401, 2000, 8000],
      'CN': [1, 34, 333, 2000, 10000],
      'IN': [1, 36, 640, 5000, 15000],
      'BR': [1, 27, 558, 3000, 10000]
    };

    const counts = baseCounts[countryCode] || [1, 20, 200, 1000, 5000];
    return counts[adminLevel] || 1000;
  }

  private estimateDataSize(countryCode: string, adminLevel: number): number {
    // Size estimates in MB
    const baseSizes: Record<string, number[]> = {
      'JP': [0.1, 2, 25, 80, 150],
      'US': [0.1, 5, 50, 200, 400],
      'GB': [0.1, 1, 8, 30, 60],
      'FR': [0.1, 2, 15, 50, 100],
      'DE': [0.1, 2, 12, 40, 80],
      'CN': [0.1, 8, 80, 300, 600],
      'IN': [0.1, 6, 60, 250, 500],
      'BR': [0.1, 4, 40, 150, 300]
    };

    const sizes = baseSizes[countryCode] || [0.1, 2, 20, 80, 160];
    return sizes[adminLevel] || 20;
  }

  private calculateCenter(bbox: BoundingBox): [number, number] {
    return [
      (bbox[0] + bbox[2]) / 2, // longitude
      (bbox[1] + bbox[3]) / 2  // latitude
    ];
  }
}

/**
 * Natural Earth Strategy
 */
export class NaturalEarthStrategy implements DataSourceStrategy {
  readonly name: DataSourceName = 'naturalearth';
  readonly displayName = 'Natural Earth';
  readonly description = 'Public domain map dataset made with Natural Earth';
  readonly license = 'Public Domain';
  readonly attribution = 'Made with Natural Earth';
  readonly website = 'https://www.naturalearthdata.com';
  readonly maxAdminLevel = 1;
  readonly dataFormat = 'geojson' as const;
  readonly requiresAuth = false;

  private readonly baseUrl = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA';
  private readonly metadata = naturalEarthMetadata as FetchedCountryMetadata[];

  async getAvailableCountries(): Promise<string[]> {
    return this.metadata.map(country => country.iso2);
  }

  async getCountryMetadata(countryCode: string): Promise<CountryMetadata> {
    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode || c.iso3 === countryCode);
    
    if (!country) {
      throw new Error(`Country ${countryCode} not found in Natural Earth metadata`);
    }

    return {
      countryCode: country.iso2,
      countryName: country.name,
      adminLevels: country.adminLevels.map((level: number) => ({
        level,
        name: level === 0 ? 'Country' : 'States/Provinces',
        featureCount: level === 0 ? 1 : 10,
        available: true
      })),
      bbox: country.bbox,
      center: this.calculateCenter(country.bbox),
      featureCount: country.adminLevels.length * 10,
      lastUpdated: '2023-01-01',
      available: true
    };
  }

  async generateDownloadUrl(countryCode: string, adminLevel: number): Promise<string> {
    if (adminLevel === 0) {
      return `${this.baseUrl}/world.geojson`;
    } else {
      return `${this.baseUrl}/${countryCode.toLowerCase()}_provinces.geojson`;
    }
  }

  async validateRequest(countryCode: string, adminLevel: number): Promise<ValidationResult> {
    const errors: Array<{type: string; message: string; severity: 'error' | 'warning'}> = [];
    
    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode);
    if (!country) {
      errors.push({
        type: 'COUNTRY_NOT_AVAILABLE',
        message: `Country ${countryCode} is not available in Natural Earth`,
        severity: 'error'
      });
    } else if (!country.adminLevels.includes(adminLevel)) {
      errors.push({
        type: 'INVALID_ADMIN_LEVEL',
        message: `Admin level ${adminLevel} not supported for ${countryCode}`,
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      metadata: {
        estimatedFeatures: adminLevel === 0 ? 1 : 10,
        estimatedSizeMB: adminLevel === 0 ? 0.5 : 2,
        dataFormat: this.dataFormat
      }
    };
  }

  supportsAdminLevel(level: number): boolean {
    return level >= 0 && level <= this.maxAdminLevel;
  }

  getRateLimit() {
    return { requestsPerSecond: 10, burstSize: 20 };
  }

  async getEstimatedSize(_countryCode: string, adminLevel: number): Promise<number> {
    return (adminLevel === 0 ? 0.5 : 2) * 1024 * 1024; // Convert MB to bytes
  }

  private calculateCenter(bbox: BoundingBox): [number, number] {
    return [
      (bbox[0] + bbox[2]) / 2, // longitude
      (bbox[1] + bbox[3]) / 2  // latitude
    ];
  }
}

/**
 * DataSourceManager - Main manager class
 */
/**
 * GeoBoundaries Strategy
 */
export class GeoBoundariesStrategy implements DataSourceStrategy {
  readonly name: DataSourceName = 'geoboundaries';
  readonly displayName = 'geoBoundaries';
  readonly description = 'Open database of political administrative boundaries';
  readonly license = 'CC BY 4.0';
  readonly attribution = 'Data from geoBoundaries';
  readonly website = 'https://www.geoboundaries.org';
  readonly maxAdminLevel = 3;
  readonly dataFormat = 'geojson' as const;
  readonly requiresAuth = false;

  private readonly baseUrl = 'https://www.geoboundaries.org/api/current';
  private readonly metadata = geoboundariesMetadata as FetchedCountryMetadata[];

  async getAvailableCountries(): Promise<string[]> {
    return this.metadata.map(country => country.iso2);
  }

  async getCountryMetadata(countryCode: string): Promise<CountryMetadata> {
    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode || c.iso3 === countryCode);
    
    if (!country) {
      throw new Error(`Country ${countryCode} not found in geoBoundaries metadata`);
    }

    return {
      countryCode: country.iso2,
      countryName: country.name,
      adminLevels: country.adminLevels.map((level: number) => ({
        level,
        name: this.getAdminLevelName(level),
        featureCount: this.estimateFeatureCount(country.iso2, level),
        available: true
      })),
      bbox: country.bbox,
      center: this.calculateCenter(country.bbox),
      featureCount: country.adminLevels.reduce((sum: number, level: number) => sum + this.estimateFeatureCount(country.iso2, level), 0),
      lastUpdated: '2024-01-01',
      available: true
    };
  }

  async generateDownloadUrl(countryCode: string, adminLevel: number): Promise<string> {
    const validation = await this.validateRequest(countryCode, adminLevel);
    if (!validation.isValid) {
      throw new Error(`Invalid request: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode);
    if (!country) {
      throw new Error(`Country ${countryCode} not found`);
    }

    return `${this.baseUrl}/gbOpen/${country.iso3}/ADM${adminLevel}`;
  }

  async validateRequest(countryCode: string, adminLevel: number): Promise<ValidationResult> {
    const errors: Array<{type: string; message: string; severity: 'error' | 'warning'}> = [];
    const warnings: string[] = [];

    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode);
    if (!country) {
      errors.push({
        type: 'COUNTRY_NOT_AVAILABLE',
        message: `Country ${countryCode} is not available in geoBoundaries`,
        severity: 'error'
      });
    } else {
      if (!country.adminLevels.includes(adminLevel)) {
        errors.push({
          type: 'INVALID_ADMIN_LEVEL',
          message: `Admin level ${adminLevel} not supported for ${countryCode}`,
          severity: 'error'
        });
      }
    }

    warnings.push('CC BY 4.0 license requires attribution');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        estimatedFeatures: country ? this.estimateFeatureCount(country.iso2, adminLevel) : 0,
        estimatedSizeMB: country ? this.estimateDataSize(country.iso2, adminLevel) : 0,
        dataFormat: this.dataFormat
      }
    };
  }

  supportsAdminLevel(level: number): boolean {
    return level >= 0 && level <= this.maxAdminLevel;
  }

  getRateLimit() {
    return { requestsPerSecond: 5, burstSize: 10 };
  }

  async getEstimatedSize(countryCode: string, adminLevel: number): Promise<number> {
    return this.estimateDataSize(countryCode, adminLevel) * 1024 * 1024;
  }

  private getAdminLevelName(level: number): string {
    const levelNames = ['Country', 'States/Provinces', 'Counties/Districts', 'Municipalities'];
    return levelNames[level] || `Level ${level}`;
  }

  private estimateFeatureCount(countryCode: string, adminLevel: number): number {
    const baseCounts: Record<string, number[]> = {
      'JP': [1, 47, 1741, 8000],
      'US': [1, 50, 3142, 15000],
      'GB': [1, 4, 400, 2000]
    };

    const counts = baseCounts[countryCode] || [1, 20, 200, 1000];
    return counts[adminLevel] || 500;
  }

  private estimateDataSize(countryCode: string, adminLevel: number): number {
    const baseSizes: Record<string, number[]> = {
      'JP': [0.05, 1, 12, 40],
      'US': [0.05, 2.5, 25, 100],
      'GB': [0.05, 0.5, 4, 15]
    };

    const sizes = baseSizes[countryCode] || [0.05, 1, 10, 40];
    return sizes[adminLevel] || 10;
  }

  private calculateCenter(bbox: BoundingBox): [number, number] {
    return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  }
}

/**
 * OpenStreetMap Strategy
 */
export class OpenStreetMapStrategy implements DataSourceStrategy {
  readonly name: DataSourceName = 'openstreetmap';
  readonly displayName = 'OpenStreetMap';
  readonly description = 'Free editable map of the world with administrative boundaries';
  readonly license = 'Open Database License (ODbL)';
  readonly attribution = '© OpenStreetMap contributors';
  readonly website = 'https://www.openstreetmap.org';
  readonly maxAdminLevel = 10;
  readonly dataFormat = 'geojson' as const;
  readonly requiresAuth = false;

  private readonly baseUrl = 'https://nominatim.openstreetmap.org';
  private readonly metadata = osmMetadata as FetchedCountryMetadata[];

  async getAvailableCountries(): Promise<string[]> {
    return this.metadata.map(country => country.iso2);
  }

  async getCountryMetadata(countryCode: string): Promise<CountryMetadata> {
    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode || c.iso3 === countryCode);
    
    if (!country) {
      throw new Error(`Country ${countryCode} not found in OpenStreetMap metadata`);
    }

    return {
      countryCode: country.iso2,
      countryName: country.name,
      adminLevels: country.adminLevels.map((level: number) => ({
        level,
        name: this.getAdminLevelName(level, country.iso2),
        featureCount: this.estimateFeatureCount(country.iso2, level),
        available: true
      })),
      bbox: country.bbox,
      center: this.calculateCenter(country.bbox),
      featureCount: country.adminLevels.reduce((sum: number, level: number) => sum + this.estimateFeatureCount(country.iso2, level), 0),
      lastUpdated: '2024-01-01',
      available: true
    };
  }

  async generateDownloadUrl(countryCode: string, adminLevel: number): Promise<string> {
    const validation = await this.validateRequest(countryCode, adminLevel);
    if (!validation.isValid) {
      throw new Error(`Invalid request: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode);
    if (!country) {
      throw new Error(`Country ${countryCode} not found`);
    }

    return `${this.baseUrl}/search?country=${country.iso3}&admin_level=${adminLevel}&format=geojson&polygon_geojson=1`;
  }

  async validateRequest(countryCode: string, adminLevel: number): Promise<ValidationResult> {
    const errors: Array<{type: string; message: string; severity: 'error' | 'warning'}> = [];
    const warnings: string[] = [];

    const country = this.metadata.find((c: FetchedCountryMetadata) => c.iso2 === countryCode);
    if (!country) {
      errors.push({
        type: 'COUNTRY_NOT_AVAILABLE',
        message: `Country ${countryCode} is not available in OpenStreetMap`,
        severity: 'error'
      });
    } else {
      if (!country.adminLevels.includes(adminLevel)) {
        errors.push({
          type: 'INVALID_ADMIN_LEVEL',
          message: `Admin level ${adminLevel} not supported for ${countryCode}`,
          severity: 'error'
        });
      }
    }

    warnings.push('OSM data quality varies by region and contributor activity');
    warnings.push('ODbL license requires attribution and share-alike');

    if (adminLevel > 6) {
      warnings.push('Very high admin levels may have incomplete or inconsistent data');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        estimatedFeatures: country ? this.estimateFeatureCount(country.iso2, adminLevel) : 0,
        estimatedSizeMB: country ? this.estimateDataSize(country.iso2, adminLevel) : 0,
        dataFormat: this.dataFormat
      }
    };
  }

  supportsAdminLevel(level: number): boolean {
    return level >= 0 && level <= this.maxAdminLevel;
  }

  getRateLimit() {
    return { requestsPerSecond: 1, burstSize: 3 };
  }

  async getEstimatedSize(countryCode: string, adminLevel: number): Promise<number> {
    return this.estimateDataSize(countryCode, adminLevel) * 1024 * 1024;
  }

  private getAdminLevelName(level: number, countryCode: string): string {
    const levelNames: Record<string, string[]> = {
      'JP': ['Country', 'Prefectures', 'Subprefectures', 'Cities', 'Special Wards', 'Districts', 'Neighborhoods', 'Blocks', 'Lots', 'Buildings', 'Units'],
      'US': ['Country', 'States', 'Counties', 'Cities', 'Boroughs', 'Districts', 'Neighborhoods', 'Census Blocks', 'Lots', 'Buildings', 'Units'],
      'GB': ['Country', 'Nations', 'Regions', 'Counties', 'Districts', 'Parishes', 'Wards', 'Neighborhoods', 'Streets', 'Buildings', 'Units']
    };

    const names = levelNames[countryCode] || [
      'Country', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 
      'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Level 9', 'Level 10'
    ];
    return names[level] || `Admin Level ${level}`;
  }

  private estimateFeatureCount(countryCode: string, adminLevel: number): number {
    const baseCounts: Record<string, number[]> = {
      'JP': [1, 47, 1741, 8000, 15000, 30000, 60000, 120000, 250000, 500000, 1000000],
      'US': [1, 50, 3142, 15000, 30000, 60000, 120000, 250000, 500000, 1000000, 2000000],
      'GB': [1, 4, 400, 2000, 8000, 16000, 32000, 64000, 128000, 256000, 512000]
    };

    const counts = baseCounts[countryCode] || [
      1, 20, 200, 1000, 5000, 10000, 20000, 40000, 80000, 160000, 320000
    ];
    return counts[adminLevel] || Math.pow(2, adminLevel) * 1000;
  }

  private estimateDataSize(countryCode: string, adminLevel: number): number {
    const baseSizes: Record<string, number[]> = {
      'JP': [0.1, 2, 25, 80, 150, 300, 600, 1200, 2400, 4800, 9600],
      'US': [0.1, 5, 50, 200, 400, 800, 1600, 3200, 6400, 12800, 25600],
      'GB': [0.1, 1, 8, 30, 60, 120, 240, 480, 960, 1920, 3840]
    };

    const sizes = baseSizes[countryCode] || [
      0.1, 2, 20, 80, 160, 320, 640, 1280, 2560, 5120, 10240
    ];
    return sizes[adminLevel] || Math.pow(2, adminLevel) * 20;
  }

  private calculateCenter(bbox: BoundingBox): [number, number] {
    return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  }
}

export class DataSourceManager {
  private strategies = new Map<DataSourceName, DataSourceStrategy>();
  private rateLimiters = new Map<DataSourceName, RateLimiter>();

  constructor() {
    this.registerDefaultStrategies();
  }

  // Strategy Management
  registerStrategy(strategy: DataSourceStrategy): void {
    this.strategies.set(strategy.name, strategy);
    
    if (strategy.getRateLimit) {
      const limits = strategy.getRateLimit();
      this.rateLimiters.set(strategy.name, new RateLimiter(limits));
    }
  }

  getStrategy(name: DataSourceName): DataSourceStrategy | undefined {
    return this.strategies.get(name);
  }

  getAvailableDataSources(): DataSourceInfo[] {
    return Array.from(this.strategies.values()).map(strategy => ({
      name: strategy.name,
      displayName: strategy.displayName,
      description: strategy.description,
      license: strategy.license,
      attribution: strategy.attribution,
      website: strategy.website,
      availableCountries: [], // Would be populated asynchronously
      maxAdminLevel: strategy.maxAdminLevel,
      dataFormat: strategy.dataFormat,
      updateFrequency: 'Variable',
      features: ['boundaries']
    }));
  }

  // Data Source Operations
  async getCountryMetadata(dataSource: DataSourceName, countryCode: string): Promise<CountryMetadata> {
    const strategy = this.getStrategy(dataSource);
    if (!strategy) {
      throw new Error(`Data source ${dataSource} not found`);
    }

    return await strategy.getCountryMetadata(countryCode);
  }

  async generateDownloadUrl(
    dataSource: DataSourceName, 
    countryCode: string, 
    adminLevel: number,
    options?: any
  ): Promise<string> {
    const strategy = this.getStrategy(dataSource);
    if (!strategy) {
      throw new Error(`Data source ${dataSource} not found`);
    }

    // Check rate limits
    const rateLimiter = this.rateLimiters.get(dataSource);
    if (rateLimiter && !rateLimiter.canMakeRequest()) {
      throw new Error(`Rate limit exceeded for ${dataSource}`);
    }

    const url = await strategy.generateDownloadUrl(countryCode, adminLevel, options);
    
    if (rateLimiter) {
      rateLimiter.recordRequest();
    }

    return url;
  }

  async validateDataSource(
    dataSource: DataSourceName,
    countryCode: string,
    adminLevel: number
  ): Promise<ValidationResult> {
    const strategy = this.getStrategy(dataSource);
    if (!strategy) {
      return {
        isValid: false,
        errors: [{ type: 'DATA_SOURCE_NOT_FOUND', message: `Data source ${dataSource} not found`, severity: 'error' }],
        warnings: [],
        metadata: {}
      };
    }

    return await strategy.validateRequest(countryCode, adminLevel);
  }

  private registerDefaultStrategies(): void {
    this.registerStrategy(new GADMStrategy());
    this.registerStrategy(new NaturalEarthStrategy());
    this.registerStrategy(new GeoBoundariesStrategy());
    this.registerStrategy(new OpenStreetMapStrategy());
  }
}

/**
 * Simple rate limiter implementation
 */
class RateLimiter {
  private requests: number[] = [];

  constructor(
    private config: { requestsPerSecond: number; burstSize: number }
  ) {}

  canMakeRequest(): boolean {
    this.cleanupOldRequests();
    return this.requests.length < this.config.burstSize;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  private cleanupOldRequests(): void {
    const cutoff = Date.now() - (1000 / this.config.requestsPerSecond);
    this.requests = this.requests.filter(time => time > cutoff);
  }
}