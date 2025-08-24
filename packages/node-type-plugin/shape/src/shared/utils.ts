/**
 * Shape plugin shared utilities
 * Pure functions that can be used in both UI and Worker environments
 */

import type { 
  ValidationResult,
  SelectionStats,
  UrlMetadata,
  CountryMetadata,
  ProcessingConfig,
  DataSourceName
} from './types';
import { DEFAULT_PROCESSING_CONFIG } from './constants';

/**
 * Validate shape entity name
 */
export function validateShapeName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name.trim()) {
    errors.push('Name is required');
  }
  
  if (name.length > 100) {
    errors.push('Name must be 100 characters or less');
  }
  
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    errors.push('Name can only contain letters, numbers, spaces, hyphens, and underscores');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate processing configuration
 */
export function validateProcessingConfig(config: Partial<ProcessingConfig>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate concurrent downloads
  if (config.concurrentDownloads !== undefined) {
    if (config.concurrentDownloads < 1 || config.concurrentDownloads > 10) {
      errors.push('Concurrent downloads must be between 1 and 10');
    }
  }
  
  // Validate concurrent processes
  if (config.concurrentProcesses !== undefined) {
    if (config.concurrentProcesses < 1 || config.concurrentProcesses > 8) {
      errors.push('Concurrent processes must be between 1 and 8');
    }
  }
  
  // Validate max zoom level
  if (config.maxZoomLevel !== undefined) {
    if (config.maxZoomLevel < 8 || config.maxZoomLevel > 18) {
      errors.push('Max zoom level must be between 8 and 18');
    }
    if (config.maxZoomLevel > 14) {
      warnings.push('High zoom levels may require significant storage and processing time');
    }
  }
  
  // Validate feature area threshold
  if (config.featureAreaThreshold !== undefined) {
    if (config.featureAreaThreshold < 0 || config.featureAreaThreshold > 1) {
      errors.push('Feature area threshold must be between 0 and 1');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Calculate selection statistics from URL metadata
 */
export function calculateSelectionStats(urlMetadata: UrlMetadata[]): SelectionStats {
  if (urlMetadata.length === 0) {
    return {
      totalSelected: 0,
      countriesWithSelection: 0,
      levelCounts: [],
      estimatedSize: 0,
      estimatedFeatures: 0,
      estimatedProcessingTime: 0
    };
  }
  
  const countries = new Set<string>();
  const levelCounts: number[] = new Array(6).fill(0);
  let estimatedSize = 0;
  let estimatedFeatures = 0;
  
  urlMetadata.forEach(metadata => {
    countries.add(metadata.countryCode);
    if (metadata.adminLevel >= 0 && metadata.adminLevel < levelCounts.length) {
      levelCounts[metadata.adminLevel]++;
    }
    if (metadata.estimatedSize) {
      estimatedSize += metadata.estimatedSize;
    }
    // Rough estimate: 1MB ≈ 1000 features
    estimatedFeatures += Math.floor((metadata.estimatedSize || 0) / 1000);
  });
  
  // Rough processing time estimate: 1 second per 1000 features + 10 seconds base
  const estimatedProcessingTime = Math.ceil(estimatedFeatures / 1000) + 10;
  
  return {
    totalSelected: urlMetadata.length,
    countriesWithSelection: countries.size,
    levelCounts,
    estimatedSize,
    estimatedFeatures,
    estimatedProcessingTime
  };
}

/**
 * Generate URL metadata for selected countries and admin levels
 */
export function generateUrlMetadata(
  dataSource: DataSourceName,
  countries: string[],
  adminLevels: number[],
  countryMetadata: CountryMetadata[]
): UrlMetadata[] {
  const urlMetadata: UrlMetadata[] = [];
  const countryMap = new Map(countryMetadata.map(c => [c.countryCode, c]));
  
  countries.forEach(countryCode => {
    const country = countryMap.get(countryCode);
    if (!country) return;
    
    adminLevels.forEach(level => {
      if (!country.availableAdminLevels.includes(level)) return;
      
      const url = buildDataSourceUrl(dataSource, countryCode, level);
      if (url) {
        urlMetadata.push({
          url,
          countryCode,
          adminLevel: level,
          continent: country.continent,
          estimatedSize: estimateDataSize(dataSource, countryCode, level, country),
          lastUpdated: new Date().toISOString()
        });
      }
    });
  });
  
  return urlMetadata;
}

/**
 * Build data source URL for specific country and admin level
 */
function buildDataSourceUrl(
  dataSource: DataSourceName,
  countryCode: string,
  adminLevel: number
): string | null {
  const baseUrls = {
    naturalearth: 'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download',
    geoboundaries: 'https://www.geoboundaries.org/api/gbOpen',
    gadm: 'https://biogeo.ucdavis.edu/data/gadm3.6',
    openstreetmap: 'https://download.geofabrik.de'
  };
  
  const baseUrl = baseUrls[dataSource];
  if (!baseUrl) return null;
  
  switch (dataSource) {
    case 'naturalearth':
      return `${baseUrl}/10m/cultural/ne_10m_admin_${adminLevel}_countries.zip`;
    case 'geoboundaries':
      return `${baseUrl}/${countryCode}/ADM${adminLevel}`;
    case 'gadm':
      return `${baseUrl}/shp/gadm36_${countryCode}_${adminLevel}.zip`;
    case 'openstreetmap':
      return `${baseUrl}/${countryCode.toLowerCase()}-latest.osm.pbf`;
    default:
      return null;
  }
}

/**
 * Estimate data size based on country and admin level
 */
function estimateDataSize(
  dataSource: DataSourceName,
  countryCode: string,
  adminLevel: number,
  country: CountryMetadata
): number {
  // Base size factors per data source (in KB)
  const baseSizeFactors = {
    naturalearth: 100,
    geoboundaries: 50,
    gadm: 200,
    openstreetmap: 1000
  };
  
  // Admin level multipliers
  const adminLevelMultipliers = [1, 2, 5, 10, 20, 50];
  
  // Population factor (larger countries = more data)
  const populationFactor = Math.log10((country.population || 1000000) / 1000000) + 1;
  
  const baseSize = baseSizeFactors[dataSource] || 100;
  const adminMultiplier = adminLevelMultipliers[adminLevel] || 1;
  
  return Math.round(baseSize * adminMultiplier * populationFactor * 1000); // Convert to bytes
}

/**
 * Merge processing config with defaults
 */
export function mergeProcessingConfig(config: Partial<ProcessingConfig>): ProcessingConfig {
  return {
    ...DEFAULT_PROCESSING_CONFIG,
    ...config
  };
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `session-${timestamp}-${random}`;
}

/**
 * Generate a unique task ID
 */
export function generateTaskId(type: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${type}-${timestamp}-${random}`;
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable time
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Parse serialized checkbox state
 */
export function parseCheckboxState(state: boolean[][] | string): boolean[][] {
  if (typeof state === 'string') {
    try {
      return JSON.parse(state) as boolean[][];
    } catch {
      return [];
    }
  }
  return state;
}

/**
 * Serialize checkbox state
 */
export function serializeCheckboxState(state: boolean[][]): string {
  return JSON.stringify(state);
}