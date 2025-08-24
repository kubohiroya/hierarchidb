/**
 * Shared layer utility functions tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateShapeName,
  validateProcessingConfig,
  calculateSelectionStats,
  generateUrlMetadata,
  formatBytes,
  formatDuration,
  parseCheckboxState,
  serializeCheckboxState
} from '../utils';
import type { ProcessingConfig, UrlMetadata, CountryMetadata } from '../types';

describe('validateShapeName', () => {
  it('should validate correct names', () => {
    const result = validateShapeName('Valid Name');
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should reject empty names', () => {
    const result = validateShapeName('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Name is required');
  });

  it('should reject names that are too long', () => {
    const longName = 'a'.repeat(101);
    const result = validateShapeName(longName);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Name must be 100 characters or less');
  });

  it('should reject names with invalid characters', () => {
    const result = validateShapeName('Invalid@Name!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Name can only contain letters, numbers, spaces, hyphens, and underscores');
  });
});

describe('validateProcessingConfig', () => {
  it('should validate correct config', () => {
    const config: Partial<ProcessingConfig> = {
      concurrentDownloads: 4,
      concurrentProcesses: 2,
      maxZoomLevel: 12,
      featureAreaThreshold: 0.5
    };
    
    const result = validateProcessingConfig(config);
    expect(result.isValid).toBe(true);
  });

  it('should reject invalid concurrent downloads', () => {
    const config: Partial<ProcessingConfig> = {
      concurrentDownloads: 15
    };
    
    const result = validateProcessingConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Concurrent downloads must be between 1 and 10');
  });

  it('should warn about high zoom levels', () => {
    const config: Partial<ProcessingConfig> = {
      maxZoomLevel: 16
    };
    
    const result = validateProcessingConfig(config);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('High zoom levels may require significant storage and processing time');
  });
});

describe('calculateSelectionStats', () => {
  it('should calculate stats for empty metadata', () => {
    const stats = calculateSelectionStats([]);
    expect(stats.totalSelected).toBe(0);
    expect(stats.countriesWithSelection).toBe(0);
    expect(stats.estimatedSize).toBe(0);
  });

  it('should calculate stats for metadata with estimates', () => {
    const metadata: UrlMetadata[] = [
      {
        url: 'http://example.com/us-0.zip',
        countryCode: 'US',
        adminLevel: 0,
        continent: 'North America',
        estimatedSize: 1000000
      },
      {
        url: 'http://example.com/us-1.zip',
        countryCode: 'US',
        adminLevel: 1,
        continent: 'North America',
        estimatedSize: 2000000
      }
    ];

    const stats = calculateSelectionStats(metadata);
    expect(stats.totalSelected).toBe(2);
    expect(stats.countriesWithSelection).toBe(1);
    expect(stats.estimatedSize).toBe(3000000);
    expect(stats.estimatedFeatures).toBe(3000); // 1MB ≈ 1000 features
    expect(stats.estimatedProcessingTime).toBe(13); // 3 + 10 seconds base
  });
});

describe('generateUrlMetadata', () => {
  const mockCountryMetadata: CountryMetadata[] = [
    {
      countryCode: 'US',
      countryName: 'United States',
      continent: 'North America',
      availableAdminLevels: [0, 1, 2],
      population: 331000000
    },
    {
      countryCode: 'JP',
      countryName: 'Japan',
      continent: 'Asia',
      availableAdminLevels: [0, 1],
      population: 125800000
    }
  ];

  it('should generate URL metadata for valid selections', () => {
    const urlMetadata = generateUrlMetadata(
      'naturalearth',
      ['US', 'JP'],
      [0, 1],
      mockCountryMetadata
    );

    expect(urlMetadata).toHaveLength(3); // US: 0,1; JP: 0,1 but JP doesn't have level 1
    expect(urlMetadata.every(meta => meta.url.includes('naturalearth'))).toBe(true);
  });

  it('should filter out unavailable admin levels', () => {
    const urlMetadata = generateUrlMetadata(
      'naturalearth',
      ['JP'],
      [0, 1, 2],
      mockCountryMetadata
    );

    // JP only has levels 0,1 - level 2 should be filtered out
    expect(urlMetadata).toHaveLength(2);
    expect(urlMetadata.every(meta => meta.adminLevel <= 1)).toBe(true);
  });
});

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('should handle decimal places', () => {
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
    expect(formatBytes(1536, 0)).toBe('2 KB');
  });
});

describe('formatDuration', () => {
  it('should format durations correctly', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(65000)).toBe('1.1m');
    expect(formatDuration(3665000)).toBe('1.0h');
  });
});

describe('checkbox state serialization', () => {
  it('should parse and serialize checkbox state', () => {
    const state = [[true, false], [false, true]];
    const serialized = serializeCheckboxState(state);
    const parsed = parseCheckboxState(serialized);
    
    expect(parsed).toEqual(state);
  });

  it('should handle invalid serialized state', () => {
    const parsed = parseCheckboxState('invalid json');
    expect(parsed).toEqual([]);
  });

  it('should handle array input directly', () => {
    const state = [[true, false], [false, true]];
    const parsed = parseCheckboxState(state);
    expect(parsed).toEqual(state);
  });
});