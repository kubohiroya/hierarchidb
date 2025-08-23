/**
 * DataSourceManager - Manages different geographic data sources
 * 
 * Handles:
 * - Data source registration and discovery
 * - Country metadata retrieval
 * - Data source validation
 * - URL generation for downloads
 * - Rate limiting and authentication
 */

import type {
  DataSourceName,
  DataSourceInfo,
  CountryMetadata,
  AdminLevelInfo,
  ValidationResult,
  BoundingBox
} from '../types';

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
  readonly name: DataSourceName = 'GADM';
  readonly displayName = 'GADM Administrative Areas';
  readonly description = 'Global administrative boundaries database';
  readonly license = 'Academic use only - Commercial use requires license';
  readonly attribution = 'GADM (www.gadm.org)';
  readonly website = 'https://gadm.org';
  readonly maxAdminLevel = 5;
  readonly dataFormat = 'geojson' as const;
  readonly requiresAuth = false;

  private readonly baseUrl = 'https://geodata.ucdavis.edu/gadm/gadm4.1/json';
  private readonly countryData = new Map<string, CountryMetadata>();

  async getAvailableCountries(): Promise<string[]> {
    // GADM supports most countries - this is a subset
    return [
      'JP', 'US', 'GB', 'FR', 'DE', 'IT', 'ES', 'CA', 'AU', 'BR',
      'CN', 'IN', 'RU', 'MX', 'AR', 'ZA', 'EG', 'NG', 'KE', 'TH'
    ];
  }

  async getCountryMetadata(countryCode: string): Promise<CountryMetadata> {
    if (this.countryData.has(countryCode)) {
      return this.countryData.get(countryCode)!;
    }

    const metadata = await this.fetchCountryMetadata(countryCode);
    this.countryData.set(countryCode, metadata);
    return metadata;
  }

  async generateDownloadUrl(countryCode: string, adminLevel: number): Promise<string> {
    const validation = await this.validateRequest(countryCode, adminLevel);
    if (!validation.isValid) {
      throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
    }

    return `${this.baseUrl}/gadm41_${countryCode}_${adminLevel}.json`;
  }

  async validateRequest(countryCode: string, adminLevel: number): Promise<ValidationResult> {
    const errors: Array<{type: string; message: string; severity: 'error' | 'warning'}> = [];
    const warnings: string[] = [];

    // Check country availability
    const availableCountries = await this.getAvailableCountries();
    if (!availableCountries.includes(countryCode)) {
      errors.push({
        type: 'COUNTRY_NOT_AVAILABLE',
        message: `Country ${countryCode} is not available in GADM`,
        severity: 'error'
      });
    }

    // Check admin level
    if (adminLevel < 0 || adminLevel > this.maxAdminLevel) {
      errors.push({
        type: 'INVALID_ADMIN_LEVEL',
        message: `Admin level ${adminLevel} not supported (max: ${this.maxAdminLevel})`,
        severity: 'error'
      });
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
        estimatedFeatures: this.estimateFeatureCount(countryCode, adminLevel),
        estimatedSizeMB: this.estimateDataSize(countryCode, adminLevel),
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

  async getEstimatedSize(_countryCode: string, adminLevel: number): Promise<number> {
    return this.estimateDataSize(_countryCode, adminLevel) * 1024 * 1024; // Convert MB to bytes
  }

  private async fetchCountryMetadata(countryCode: string): Promise<CountryMetadata> {
    // Mock implementation - in real version would fetch from GADM API
    const countryNames: Record<string, {name: string; localName?: string}> = {
      'JP': { name: 'Japan', localName: '日本' },
      'US': { name: 'United States', localName: 'United States' },
      'GB': { name: 'United Kingdom', localName: 'United Kingdom' },
      'FR': { name: 'France', localName: 'France' },
      'DE': { name: 'Germany', localName: 'Deutschland' },
      'CN': { name: 'China', localName: '中国' },
      'IN': { name: 'India', localName: 'भारत' },
      'BR': { name: 'Brazil', localName: 'Brasil' }
    };

    const countryInfo = countryNames[countryCode] || { name: countryCode };
    
    return {
      countryCode,
      countryName: countryInfo.name,
      countryNameLocal: countryInfo.localName,
      adminLevels: this.generateAdminLevels(countryCode),
      bbox: this.getCountryBbox(countryCode),
      center: this.getCountryCenter(countryCode),
      featureCount: this.estimateFeatureCount(countryCode, 2),
      lastUpdated: '2024-01-01',
      available: true
    };
  }

  private generateAdminLevels(countryCode: string): AdminLevelInfo[] {
    const levels: AdminLevelInfo[] = [
      { level: 0, name: 'Country', featureCount: 1, available: true },
      { level: 1, name: 'States/Provinces', featureCount: this.estimateFeatureCount(countryCode, 1), available: true },
      { level: 2, name: 'Counties/Districts', featureCount: this.estimateFeatureCount(countryCode, 2), available: true }
    ];

    if (countryCode === 'JP' && levels[1] && levels[2]) {
      levels[1].name = 'Prefectures';
      levels[1].localName = '都道府県';
      levels[2].name = 'Municipalities';
      levels[2].localName = '市町村';
    }

    return levels;
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

  private getCountryBbox(countryCode: string): BoundingBox {
    const bboxes: Record<string, BoundingBox> = {
      'JP': [122.93, 24.25, 145.82, 45.52],
      'US': [-179.15, 18.91, -66.96, 71.36],
      'GB': [-8.18, 49.96, 1.75, 60.84],
      'FR': [-5.14, 41.33, 9.56, 51.09],
      'DE': [5.87, 47.27, 15.04, 55.06],
      'CN': [73.50, 18.16, 134.77, 53.56],
      'IN': [68.11, 6.75, 97.40, 37.08],
      'BR': [-73.99, -33.75, -28.84, 5.27]
    };

    return bboxes[countryCode] || [0, 0, 0, 0];
  }

  private getCountryCenter(countryCode: string): [number, number] {
    const centers: Record<string, [number, number]> = {
      'JP': [138.25, 36.20],
      'US': [-98.58, 39.83],
      'GB': [-3.44, 55.38],
      'FR': [2.21, 46.23],
      'DE': [10.45, 51.17],
      'CN': [104.20, 35.86],
      'IN': [78.96, 20.59],
      'BR': [-51.93, -14.24]
    };

    return centers[countryCode] || [0, 0];
  }
}

/**
 * Natural Earth Strategy
 */
export class NaturalEarthStrategy implements DataSourceStrategy {
  readonly name: DataSourceName = 'NaturalEarth';
  readonly displayName = 'Natural Earth';
  readonly description = 'Public domain map dataset made with Natural Earth';
  readonly license = 'Public Domain';
  readonly attribution = 'Made with Natural Earth';
  readonly website = 'https://www.naturalearthdata.com';
  readonly maxAdminLevel = 1;
  readonly dataFormat = 'geojson' as const;
  readonly requiresAuth = false;

  private readonly baseUrl = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA';

  async getAvailableCountries(): Promise<string[]> {
    // Natural Earth has global coverage but simplified data
    return ['JP', 'US', 'GB', 'FR', 'DE', 'IT', 'ES', 'CA', 'AU', 'BR'];
  }

  async getCountryMetadata(countryCode: string): Promise<CountryMetadata> {
    return {
      countryCode,
      countryName: countryCode,
      adminLevels: [
        { level: 0, name: 'Country', featureCount: 1, available: true },
        { level: 1, name: 'States/Provinces', featureCount: 10, available: true }
      ],
      bbox: [0, 0, 0, 0], // Would be populated from actual data
      center: [0, 0],
      featureCount: 11,
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

  async validateRequest(_countryCode: string, adminLevel: number): Promise<ValidationResult> {
    const errors: Array<{type: string; message: string; severity: 'error' | 'warning'}> = [];
    
    if (adminLevel > this.maxAdminLevel) {
      errors.push({
        type: 'INVALID_ADMIN_LEVEL',
        message: `Admin level ${adminLevel} not supported (max: ${this.maxAdminLevel})`,
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
}

/**
 * DataSourceManager - Main manager class
 */
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
      availableCountries: [] as string[], // Would be populated asynchronously
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