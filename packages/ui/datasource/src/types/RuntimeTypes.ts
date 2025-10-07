// Type-only replicas of runtime service contracts for UI consumers.
// Do not include any implementations here.

import type { DataSourceName } from './DataSource.js';

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
  errors: Array<{ type: string; message: string; severity: 'error' | 'warning' }>;
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
