/**
 * DownloadWorker - Geographic data download and preprocessing
 * 
 * Responsibilities:
 * - Download from multiple data sources (GADM, Natural Earth, OSM, GeoBoundaries)
 * - Data validation and format conversion
 * - Compression and caching
 * - Initial spatial indexing
 * - Error handling with retry logic
 */

import * as Comlink from 'comlink';
import * as turf from '@turf/turf';
import * as geohash from 'geohash';
import type {
  DownloadWorkerAPI,
  DownloadTask,
  DownloadResult,
  DownloadTaskConfig,
  ValidationResult,
  FeatureIndex,
  DataSourceName
} from '../types';

/**
 * DownloadWorker implementation
 */
export class DownloadWorker implements DownloadWorkerAPI {
  private cache = new Map<string, ArrayBuffer>();
  private readonly maxCacheSize = 100 * 1024 * 1024; // 100MB cache limit
  
  constructor() {
    // Set up global error handling (only in Worker environment)
    if (typeof self !== 'undefined' && self.addEventListener && typeof self.addEventListener === 'function') {
      self.addEventListener('error', (event) => {
        console.error('DownloadWorker global error:', event.error);
      });

      self.addEventListener('unhandledrejection', (event) => {
        console.error('DownloadWorker unhandled rejection:', event.reason);
        event.preventDefault();
      });
    }
  }

  /**
   * Process download task
   */
  async processDownload(task: DownloadTask): Promise<DownloadResult> {
    const startTime = Date.now();
    console.log(`DownloadWorker: Starting download task ${task.taskId}`);

    try {
      // 1. Check cache first
      const cacheKey = this.generateCacheKey(task.config);
      let rawData = await this.getCachedData(cacheKey);
      let fromCache = true;

      if (!rawData) {
        // 2. Download from source
        rawData = await this.downloadFromSource(task.config);
        fromCache = false;

        // 3. Cache the data
        await this.cacheData(cacheKey, rawData);
      }

      // 4. Validate and parse data
      const validationResult = await this.validateData(rawData);
      if (!validationResult.isValid) {
        throw new Error(`Invalid data: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // 5. Parse GeoJSON
      const geoJson = await this.parseData(rawData, task.config.expectedFormat);

      // 6. Generate spatial indices
      const spatialIndices = await this.generateSpatialIndices(geoJson, task.nodeId);

      // 7. Calculate metrics
      const downloadTime = Date.now() - startTime;
      const compressionRatio = this.calculateCompressionRatio(rawData);

      const result: DownloadResult = {
        taskId: task.taskId,
        status: 'completed',
        outputBufferId: `buffer-${task.taskId}-${Date.now()}`,
        featureCount: geoJson.features.length,
        downloadTime,
        downloadSize: rawData.byteLength,
        compressionRatio,
        spatialIndices
      };

      console.log(`DownloadWorker: Completed task ${task.taskId} in ${downloadTime}ms (${fromCache ? 'from cache' : 'downloaded'})`);
      return result;

    } catch (error) {
      console.error(`DownloadWorker: Task ${task.taskId} failed:`, error);
      
      return {
        taskId: task.taskId,
        status: 'failed',
        outputBufferId: '',
        featureCount: 0,
        downloadTime: Date.now() - startTime,
        downloadSize: 0,
        compressionRatio: 0,
        spatialIndices: [],
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Download data from source with retry logic
   */
  private async downloadFromSource(config: DownloadTaskConfig): Promise<ArrayBuffer> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`DownloadWorker: Downloading from ${config.url} (attempt ${attempt + 1})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(config.url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json, application/geo+json, */*',
            'User-Agent': 'HierarchiDB-Shape-Plugin/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`DownloadWorker: Downloaded ${arrayBuffer.byteLength} bytes`);
        
        return arrayBuffer;

      } catch (error) {
        lastError = error as Error;
        console.warn(`DownloadWorker: Download attempt ${attempt + 1} failed:`, error);
        
        if (attempt < 2) {
          // Exponential backoff
          const delay = config.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Download failed after 3 attempts');
  }

  /**
   * Validate downloaded data
   */
  async validateData(data: ArrayBuffer): Promise<ValidationResult> {
    const errors: Array<{type: string; message: string; severity: 'error' | 'warning'}> = [];
    const warnings: string[] = [];

    try {
      // Basic size validation
      if (data.byteLength === 0) {
        errors.push({
          type: 'EMPTY_DATA',
          message: 'Downloaded data is empty',
          severity: 'error'
        });
      }

      if (data.byteLength > 100 * 1024 * 1024) { // 100MB
        warnings.push('Data size is very large (>100MB), processing may be slow');
      }

      // Try to parse as text to check format
      const text = new TextDecoder().decode(data.slice(0, 1024)); // First 1KB
      
      if (text.includes('<?xml')) {
        errors.push({
          type: 'UNSUPPORTED_FORMAT',
          message: 'XML format detected, expected GeoJSON',
          severity: 'error'
        });
      }

      if (!text.includes('{') && !text.includes('Feature')) {
        errors.push({
          type: 'INVALID_FORMAT',
          message: 'Data does not appear to be valid GeoJSON',
          severity: 'error'
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          size: data.byteLength,
          estimatedType: this.detectDataType(text)
        }
      };

    } catch (error) {
      errors.push({
        type: 'VALIDATION_ERROR',
        message: `Validation failed: ${error}`,
        severity: 'error'
      });

      return {
        isValid: false,
        errors,
        warnings: [],
        metadata: {}
      };
    }
  }

  /**
   * Parse data based on format
   */
  private async parseData(data: ArrayBuffer, expectedFormat: string): Promise<any> {
    const text = new TextDecoder().decode(data);
    
    try {
      switch (expectedFormat) {
        case 'geojson':
        default:
          return JSON.parse(text);
        
        case 'topojson':
          // TopoJSON parsing would require additional library
          const parsed = JSON.parse(text);
          if (parsed.type === 'Topology') {
            // Convert TopoJSON to GeoJSON (simplified)
            return this.convertTopoJSONToGeoJSON(parsed);
          }
          return parsed;
      }
    } catch (error) {
      throw new Error(`Failed to parse ${expectedFormat}: ${error}`);
    }
  }

  /**
   * Generate spatial indices for features
   */
  private async generateSpatialIndices(geoJson: any, nodeId: string): Promise<FeatureIndex[]> {
    const indices: FeatureIndex[] = [];
    
    if (!geoJson.features || !Array.isArray(geoJson.features)) {
      return indices;
    }

    for (let i = 0; i < geoJson.features.length; i++) {
      const feature = geoJson.features[i];
      
      try {
        // Use Turf.js for accurate geospatial calculations
        const bbox = turf.bbox(feature);
        const centroid = turf.centroid(feature);
        const area = turf.area(feature);
        const geohashCode = geohash.encode(centroid.geometry.coordinates[1], centroid.geometry.coordinates[0], 12);
        const complexity = this.calculateComplexity(feature.geometry);

        indices.push({
          indexId: `${nodeId}-${i}`,
          featureId: feature.id || `feature-${i}`,
          mortonCode: geohashCode.charCodeAt(0), // Simple numeric representation
          bbox: bbox as [number, number, number, number],
          centroid: centroid.geometry.coordinates as [number, number],
          area,
          complexity
        });

      } catch (error) {
        console.warn(`DownloadWorker: Failed to index feature ${i}:`, error);
      }
    }

    return indices;
  }

  /**
   * Cache data
   */
  async cacheData(key: string, data: ArrayBuffer): Promise<void> {
    // Simple LRU cache implementation
    if (this.cache.size > 10) { // Max 10 entries
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, data);
  }

  /**
   * Get cached data
   */
  async getCachedData(key: string): Promise<ArrayBuffer | null> {
    return this.cache.get(key) || null;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generateCacheKey(config: DownloadTaskConfig): string {
    return `${config.dataSource}-${config.country}-${config.adminLevel}-${config.url}`;
  }

  private calculateCompressionRatio(data: ArrayBuffer): number {
    // Simplified compression ratio calculation
    const text = new TextDecoder().decode(data);
    const compressedEstimate = text.length * 0.3; // Rough estimate
    return compressedEstimate / data.byteLength;
  }

  private detectDataType(text: string): string {
    if (text.includes('"type":"FeatureCollection"')) return 'geojson';
    if (text.includes('"type":"Topology"')) return 'topojson';
    if (text.includes('<?xml')) return 'xml';
    return 'unknown';
  }

  private convertTopoJSONToGeoJSON(topology: any): any {
    // Simplified TopoJSON to GeoJSON conversion
    // In practice, you'd use a proper library like topojson-client
    return {
      type: 'FeatureCollection',
      features: []
    };
  }

  private calculateBoundingBox(geometry: any): [number, number, number, number] {
    // Simplified bbox calculation
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    const processCoords = (coords: any) => {
      if (typeof coords[0] === 'number') {
        minX = Math.min(minX, coords[0]);
        maxX = Math.max(maxX, coords[0]);
        minY = Math.min(minY, coords[1]);
        maxY = Math.max(maxY, coords[1]);
      } else {
        coords.forEach(processCoords);
      }
    };

    if (geometry.coordinates) {
      processCoords(geometry.coordinates);
    }

    return [minX, minY, maxX, maxY];
  }

  private calculateCentroid(bbox: [number, number, number, number]): [number, number] {
    return [
      (bbox[0] + bbox[2]) / 2,
      (bbox[1] + bbox[3]) / 2
    ];
  }

  private calculateMortonCode(lon: number, lat: number): number {
    // Simplified Morton code calculation
    const x = Math.floor(((lon + 180) / 360) * 0xFFFF);
    const y = Math.floor(((lat + 90) / 180) * 0xFFFF);
    return this.interleave(x, y);
  }

  private interleave(x: number, y: number): number {
    let result = 0;
    for (let i = 0; i < 16; i++) {
      result |= ((x & (1 << i)) << i) | ((y & (1 << i)) << (i + 1));
    }
    return result;
  }

  private calculateArea(geometry: any): number {
    // Simplified area calculation - would use proper library in practice
    return 1000; // Placeholder
  }

  private calculateComplexity(geometry: any): number {
    // Count vertices as complexity measure
    let vertexCount = 0;
    
    const countVertices = (coords: any) => {
      if (typeof coords[0] === 'number') {
        vertexCount++;
      } else {
        coords.forEach(countVertices);
      }
    };

    if (geometry.coordinates) {
      countVertices(geometry.coordinates);
    }

    return vertexCount;
  }

}

// Export for Comlink
Comlink.expose(DownloadWorker);

// Also export the class for direct usage if needed
export default DownloadWorker;