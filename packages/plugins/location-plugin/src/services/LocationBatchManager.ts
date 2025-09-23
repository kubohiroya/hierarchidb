/**
 * @file LocationBatchManager.ts
 * @description Location batch processing manager extending Shape's batch infrastructure
 */

import type { NodeId } from '@hierarchidb/common-type';
import type {
  LocationBatchConfig,
  LocationCategory,
  LocationEntity,
  LocationSearchConfig,
  LocationType,
} from '../entities/LocationEntity.js';
import {
  buildLocationEntity,
  createPoint,
  mapCategory,
  mapType,
  normalizeImportance,
  normalizeOsmType,
  parseBoundingBox,
  parseNumber,
  sanitizeTags,
} from './download/mappers.js';

const logLocationBatchWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[LocationBatchManager]', message, error);
};

/**
 * Location batch task interface
 */
interface LocationBatchTask {
  taskId: string;
  sessionId: string;
  nodeId: NodeId;
  searchConfig: LocationSearchConfig;
  status: 'pending' | 'searching' | 'geocoding' | 'validating' | 'completed' | 'failed';
  progress: number;
  results?: LocationEntity[];
  error?: string;
  metrics?: {
    searchTime?: number;
    geocodeTime?: number;
    totalFound?: number;
    totalFiltered?: number;
    totalSaved?: number;
  };
}

/**
 * Location batch session status
 */
interface LocationBatchSession {
  sessionId: string;
  nodeId: NodeId;
  config: LocationBatchConfig;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalLocations: number;
  startTime: number;
  endTime?: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
}

/**
 * Location batch progress event
 */
export interface LocationBatchProgressEvent {
  sessionId: string;
  taskId?: string;
  stage: 'searching' | 'geocoding' | 'validating' | 'saving' | 'completed';
  progress: number;
  message: string;
  metrics?: {
    locationsFound?: number;
    locationsProcessed?: number;
    locationsFiltered?: number;
    locationsSaved?: number;
  };
}

interface RawOsmAddress {
  road?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

interface RawNominatimLike {
  osm_id: number | string;
  display_name?: string;
  class?: string;
  type?: string;
  osm_type?: string;
  lon?: string | number;
  lat?: string | number;
  boundingbox?: [string, string, string, string] | string[];
  address?: RawOsmAddress;
  extratags?: Record<string, string>;
  importance?: number | string;
}

interface RawOverpassElement {
  id: number | string;
  type?: string;
  lon?: number | string;
  lat?: number | string;
  center?: { lon?: number; lat?: number };
  tags?: Record<string, string>;
  importance?: number | string;
}

/**
 * Location batch manager extending Shape's batch session manager
 */
export class LocationBatchManager {
  private locationSessions: Map<string, LocationBatchSession> = new Map();
  private locationTasks: Map<string, LocationBatchTask[]> = new Map();
  private progressCallbacks: Map<string, (event: LocationBatchProgressEvent) => void> = new Map();

  /**
   * Start location batch session
   */
  async startLocationBatchSession(
    nodeId: NodeId,
    config: LocationBatchConfig,
    progressCallback?: (event: LocationBatchProgressEvent) => void,
  ): Promise<string> {
    const sessionId = `location-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const totalTasks = config.searchConfigs.length;

    // Create batch tasks
    const tasks: LocationBatchTask[] = config.searchConfigs.map((searchConfig, index) => ({
      taskId: `${sessionId}-task-${index}`,
      sessionId,
      nodeId,
      searchConfig,
      status: 'pending' as const,
      progress: 0,
    }));

    // Initialize session
    const session: LocationBatchSession = {
      sessionId,
      nodeId,
      config,
      totalTasks,
      completedTasks: 0,
      failedTasks: 0,
      totalLocations: 0,
      startTime: Date.now(),
      status: 'running',
    };

    this.locationSessions.set(sessionId, session);
    this.locationTasks.set(sessionId, tasks);

    if (progressCallback) {
      this.progressCallbacks.set(sessionId, progressCallback);
    }

    // Start processing
    this.processLocationBatch(sessionId).catch(error => {
      console.error('Location batch processing failed:', error);
      this.handleBatchError(sessionId, error);
    });

    return sessionId;
  }

  /**
   * Process location batch
   */
  private async processLocationBatch(sessionId: string): Promise<void> {
    const session = this.locationSessions.get(sessionId);
    const tasks = this.locationTasks.get(sessionId);

    if (!session || !tasks) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Process tasks with concurrency control
    const { concurrent } = session.config.processingOptions;
    const batches = this.createBatches(tasks, concurrent);

    for (const batch of batches) {
      await Promise.all(batch.map(task => this.processLocationTask(task, session)));
    }

    // Complete session
    session.endTime = Date.now();
    session.status = session.failedTasks === 0 ? 'completed' : 'failed';

    // Emit completion event
    this.emitLocationProgress(sessionId, {
      sessionId,
      stage: 'completed',
      progress: 100,
      message: `Batch processing completed: ${session.totalLocations} locations processed`,
      metrics: {
        locationsFound: session.totalLocations,
        locationsProcessed: session.totalLocations,
        locationsSaved: session.totalLocations,
      },
    });
  }

  /**
   * Process individual location task
   */
  private async processLocationTask(
    task: LocationBatchTask,
    session: LocationBatchSession,
  ): Promise<void> {
    try {
      task.status = 'searching';
      task.metrics = {};

      // Phase 1: Search locations
      const searchStartTime = Date.now();
      const searchResults = await this.searchLocations(task.searchConfig);
      task.metrics.searchTime = Date.now() - searchStartTime;
      task.metrics.totalFound = searchResults.length;

      this.emitLocationProgress(session.sessionId, {
        sessionId: session.sessionId,
        taskId: task.taskId,
        stage: 'searching',
        progress: 25,
        message: `Found ${searchResults.length} locations`,
        metrics: {
          locationsFound: searchResults.length,
        },
      });

      // Phase 2: Geocoding (if needed)
      if (session.config.processingOptions.geocoding) {
        task.status = 'geocoding';
        const geocodeStartTime = Date.now();
        const geocodedResults = await this.geocodeLocations(searchResults);
        task.metrics.geocodeTime = Date.now() - geocodeStartTime;
        task.results = geocodedResults;

        this.emitLocationProgress(session.sessionId, {
          sessionId: session.sessionId,
          taskId: task.taskId,
          stage: 'geocoding',
          progress: 50,
          message: `Geocoded ${geocodedResults.length} locations`,
          metrics: {
            locationsProcessed: geocodedResults.length,
          },
        });
      } else {
        task.results = searchResults;
      }

      // Phase 3: Validation and filtering
      task.status = 'validating';
      const validatedResults = await this.validateAndFilterLocations(
        task.results!,
        session.config.filterCriteria,
      );
      task.metrics.totalFiltered = task.results!.length - validatedResults.length;
      task.results = validatedResults;

      this.emitLocationProgress(session.sessionId, {
        sessionId: session.sessionId,
        taskId: task.taskId,
        stage: 'validating',
        progress: 75,
        message: `Validated ${validatedResults.length} locations`,
        metrics: {
          locationsFiltered: task.metrics.totalFiltered,
        },
      });

      // Phase 4: Save locations
      task.status = 'completed';
      task.metrics.totalSaved = task.results.length;
      session.totalLocations += task.results.length;
      session.completedTasks++;
      task.progress = 100;

      this.emitLocationProgress(session.sessionId, {
        sessionId: session.sessionId,
        taskId: task.taskId,
        stage: 'saving',
        progress: 100,
        message: `Saved ${task.results.length} locations`,
        metrics: {
          locationsSaved: task.results.length,
        },
      });

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      session.failedTasks++;

      console.error(`Location task ${task.taskId} failed:`, error);
    }
  }

  /**
   * Search locations based on configuration
   */
  private async searchLocations(config: LocationSearchConfig): Promise<LocationEntity[]> {
    // Try Strategy registry first (feature-gated)
    try {
      const { getLocationStrategy } = await import('./download/registry.js');
      const strategy = getLocationStrategy(config);
      if (strategy) {
        const list = await strategy.search(config);
        if (config.limit && list.length > (config.limit || 0)) return list.slice(0, config.limit);
        return list;
      }
    } catch (error) {
      logLocationBatchWarning('Failed to execute registered location strategy', error);
    }

    const locations: LocationEntity[] = [];

    switch (config.dataSource) {
      case 'openstreetmap':
        locations.push(...await this.searchOSM(config));
        break;
      case 'geonames':
        locations.push(...await this.searchGeoNames(config));
        break;
      case 'wikidata':
        locations.push(...await this.searchWikidata(config));
        break;
      case 'overpass':
        locations.push(...await this.searchOverpass(config));
        break;
      case 'custom':
        locations.push(...await this.searchCustom(config));
        break;
      default:
        console.warn(`Unsupported data source: ${config.dataSource}`);
    }

    // Apply limit if specified
    if (config.limit && locations.length > config.limit) {
      return locations.slice(0, config.limit);
    }

    return locations;
  }

  /**
   * Search OpenStreetMap Nominatim
   */
  private async searchOSM(config: LocationSearchConfig): Promise<LocationEntity[]> {
    const endpoint = config.options?.nominatimEndpoint || 'https://nominatim.openstreetmap.org/search';
    const params = new URLSearchParams({
      q: config.query || '',
      format: 'json',
      limit: String(config.limit || 50),
      addressdetails: config.options?.addressDetails ? '1' : '0',
      extratags: config.options?.extraTags ? '1' : '0',
      namedetails: config.options?.nameDetails ? '1' : '0',
    });

    if (config.boundingBox) {
      params.append('viewbox', config.boundingBox.join(','));
      params.append('bounded', '1');
    }

    if (config.language) {
      params.append('accept-language', config.language);
    }

    try {
      const { getJson } = await import('./utils/sharedNet.js');
      const data = await getJson(`${endpoint}?${params}`);
      return this.convertOSMToLocations(data);
    } catch (error) {
      console.error('OSM search failed:', error);
      return [];
    }
  }

  /**
   * Search GeoNames
   */
  private async searchGeoNames(config: LocationSearchConfig): Promise<LocationEntity[]> {
    // Placeholder implementation
    console.log('GeoNames search:', config);
    return [];
  }

  /**
   * Search Wikidata
   */
  private async searchWikidata(config: LocationSearchConfig): Promise<LocationEntity[]> {
    // Placeholder implementation
    console.log('Wikidata search:', config);
    return [];
  }

  /**
   * Search Overpass API
   */
  private async searchOverpass(config: LocationSearchConfig): Promise<LocationEntity[]> {
    const endpoint = config.options?.overpassEndpoint || 'https://overpass-api.de/api/interpreter';
    const query = config.options?.overpassQuery || this.buildOverpassQuery(config);

    try {
      const { postJson } = await import('./utils/sharedNet.js');
      const data = await postJson(endpoint, query, { 'Content-Type': 'application/x-www-form-urlencoded' });
      return this.convertOverpassToLocations(data);
    } catch (error) {
      console.error('Overpass search failed:', error);
      return [];
    }
  }

  /**
   * Search custom endpoint
   */
  private async searchCustom(config: LocationSearchConfig): Promise<LocationEntity[]> {
    if (!config.options?.customEndpoint) {
      console.error('Custom endpoint not specified');
      return [];
    }

    try {
      const { getJson } = await import('./utils/sharedNet.js');
      const url = config.options.customEndpoint;
      const searchParams = new URLSearchParams(config.options.queryParams ?? {});
      const requestUrl = searchParams.size > 0 ? `${url}?${searchParams.toString()}` : url;
      const init: RequestInit | undefined = config.options.customHeaders
        ? { headers: config.options.customHeaders }
        : undefined;
      const data = await getJson(requestUrl, init);
      return this.convertCustomToLocations(data);
    } catch (error) {
      console.error('Custom search failed:', error);
      return [];
    }
  }

  /**
   * Build Overpass query
   */
  private buildOverpassQuery(config: LocationSearchConfig): string {
    const bbox = config.boundingBox ?
      `(${config.boundingBox[1]},${config.boundingBox[0]},${config.boundingBox[3]},${config.boundingBox[2]})` :
      '';

    let query = '[out:json];(';

    // Add queries for each location type
    if (config.types && config.types.length > 0) {
      for (const type of config.types) {
        const osmTag = this.getOSMTagForType(type);
        if (osmTag) {
          query += `node["${osmTag.key}"="${osmTag.value}"]${bbox};`;
          query += `way["${osmTag.key}"="${osmTag.value}"]${bbox};`;
        }
      }
    } else if (config.query) {
      query += `node["name"~"${config.query}"]${bbox};`;
      query += `way["name"~"${config.query}"]${bbox};`;
    }

    query += ');out body;>;out skel qt;';
    return query;
  }

  /**
   * Get OSM tag for location type
   */
  private getOSMTagForType(type: LocationType): { key: string; value: string } | null {
    const typeToTag: Record<LocationType, { key: string; value: string }> = {
      'airport': { key: 'aeroway', value: 'aerodrome' },
      'railway_station': { key: 'railway', value: 'station' },
      'bus_stop': { key: 'highway', value: 'bus_stop' },
      'port': { key: 'harbour', value: 'yes' },
      'parking': { key: 'amenity', value: 'parking' },
      'government': { key: 'office', value: 'government' },
      'embassy': { key: 'office', value: 'diplomatic' },
      'courthouse': { key: 'amenity', value: 'courthouse' },
      'hospital': { key: 'amenity', value: 'hospital' },
      'clinic': { key: 'amenity', value: 'clinic' },
      'pharmacy': { key: 'amenity', value: 'pharmacy' },
      'school': { key: 'amenity', value: 'school' },
      'university': { key: 'amenity', value: 'university' },
      'library': { key: 'amenity', value: 'library' },
      'shopping_mall': { key: 'shop', value: 'mall' },
      'supermarket': { key: 'shop', value: 'supermarket' },
      'restaurant': { key: 'amenity', value: 'restaurant' },
      'hotel': { key: 'tourism', value: 'hotel' },
      'bank': { key: 'amenity', value: 'bank' },
      'museum': { key: 'tourism', value: 'museum' },
      'theater': { key: 'amenity', value: 'theatre' },
      'monument': { key: 'historic', value: 'monument' },
      'park': { key: 'leisure', value: 'park' },
      'stadium': { key: 'leisure', value: 'stadium' },
      'beach': { key: 'natural', value: 'beach' },
      'mountain': { key: 'natural', value: 'peak' },
      'lake': { key: 'natural', value: 'water' },
      'river': { key: 'waterway', value: 'river' },
    };

    return typeToTag[type] || null;
  }

  /**
   * Convert OSM data to location entities
   */
  private convertOSMToLocations(data: RawNominatimLike[]): LocationEntity[] {
    return data
      .map((item) => this.createLocationFromOSM(item))
      .filter((value): value is LocationEntity => value !== null);
  }

  /**
   * Convert Overpass data to location entities
   */
  private convertOverpassToLocations(data: { elements?: RawOverpassElement[] }): LocationEntity[] {
    if (!Array.isArray(data.elements)) return [];
    return data.elements
      .map((item) => this.createLocationFromOverpass(item))
      .filter((value): value is LocationEntity => value !== null);
  }

  /**
   * Convert custom data to location entities
   */
  private convertCustomToLocations(_data: any): LocationEntity[] {
    // This would need custom mapping logic based on the data format
    return [];
  }

  /**
   * Create location entity from OSM data
   */
  private createLocationFromOSM(osmData: RawNominatimLike): LocationEntity | null {
    const lon = parseNumber(osmData.lon);
    const lat = parseNumber(osmData.lat);
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;

    const address = osmData.address
      ? {
          street: osmData.address.road,
          houseNumber: osmData.address.house_number,
          postcode: osmData.address.postcode,
          city: osmData.address.city || osmData.address.town || osmData.address.village,
          district: osmData.address.suburb,
          state: osmData.address.state,
          country: osmData.address.country,
          countryCode: osmData.address.country_code?.toUpperCase(),
        }
      : undefined;

    return buildLocationEntity({
      prefix: 'osm',
      rawId: osmData.osm_id,
      name: osmData.display_name || 'Unknown',
      category: mapCategory(osmData.class),
      type: mapType(osmData.type),
      dataSource: 'openstreetmap',
      point: createPoint(lon, lat, 'openstreetmap', Date.now()),
      attributes: {
        osmId: String(osmData.osm_id),
        osmType: normalizeOsmType(osmData.osm_type),
        osmTags: sanitizeTags(osmData.extratags),
      },
      boundingBox: parseBoundingBox(osmData.boundingbox),
      address,
      importance: normalizeImportance(osmData.importance, 0.5),
      metadata: { source: 'osm-batch' },
    });
  }

  /**
   * Create location entity from Overpass data
   */
  private createLocationFromOverpass(overpassData: RawOverpassElement): LocationEntity | null {
    const lon = typeof overpassData.lon === 'number'
      ? overpassData.lon
      : typeof overpassData.lon === 'string'
        ? parseNumber(overpassData.lon)
        : overpassData.center?.lon;
    const lat = typeof overpassData.lat === 'number'
      ? overpassData.lat
      : typeof overpassData.lat === 'string'
        ? parseNumber(overpassData.lat)
        : overpassData.center?.lat;
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;

    const tags = overpassData.tags ?? {};
    return buildLocationEntity({
      prefix: 'overpass',
      rawId: overpassData.id,
      name: tags.name || 'Unknown',
      category: this.detectCategoryFromTags(tags),
      type: this.detectTypeFromTags(tags),
      dataSource: 'overpass',
      point: createPoint(lon, lat, 'overpass', Date.now()),
      attributes: {
        osmId: String(overpassData.id),
        osmType: normalizeOsmType(overpassData.type),
        osmTags: sanitizeTags(tags),
      },
      importance: normalizeImportance(tags.importance),
      metadata: { source: 'overpass-batch' },
    });
  }

  /**
   * Detect category from OSM class
   */
  /**
   * Detect category from OSM tags
   */
  private detectCategoryFromTags(tags: Record<string, string>): LocationCategory {
    if (tags.aeroway || tags.railway || tags.highway) return 'transportation';
    if (tags.office || tags.government) return 'administrative';
    if (tags.amenity) return 'infrastructure';
    if (tags.shop) return 'commercial';
    if (tags.tourism || tags.leisure) return 'leisure';
    if (tags.historic) return 'cultural';
    if (tags.natural) return 'natural';
    return 'infrastructure';
  }

  /**
   * Detect type from OSM tags
   */
  private detectTypeFromTags(tags: Record<string, string>): LocationType {
    if (tags.aeroway === 'aerodrome') return 'airport';
    if (tags.railway === 'station') return 'railway_station';
    if (tags.highway === 'bus_stop') return 'bus_stop';
    if (tags.harbour === 'yes') return 'port';
    if (tags.amenity === 'parking') return 'parking';
    if (tags.amenity === 'hospital') return 'hospital';
    if (tags.amenity === 'school') return 'school';
    if (tags.amenity === 'university') return 'university';
    if (tags.amenity === 'library') return 'library';
    if (tags.shop === 'mall') return 'shopping_mall';
    if (tags.shop === 'supermarket') return 'supermarket';
    if (tags.amenity === 'restaurant') return 'restaurant';
    if (tags.tourism === 'hotel') return 'hotel';
    if (tags.amenity === 'bank') return 'bank';
    if (tags.tourism === 'museum') return 'museum';
    if (tags.amenity === 'theatre') return 'theater';
    if (tags.historic === 'monument') return 'monument';
    if (tags.leisure === 'park') return 'park';
    if (tags.leisure === 'stadium') return 'stadium';
    if (tags.natural === 'beach') return 'beach';
    if (tags.natural === 'peak') return 'mountain';
    if (tags.natural === 'water') return 'lake';
    if (tags.waterway === 'river') return 'river';

    return 'airport'; // Default
  }

  /**
   * Geocode locations
   */
  private async geocodeLocations(locations: LocationEntity[]): Promise<LocationEntity[]> {
    // Geocoding would be done here for locations without coordinates
    // or to enhance address information
    return locations;
  }

  /**
   * Validate and filter locations
   */
  private async validateAndFilterLocations(
    locations: LocationEntity[],
    criteria?: any,
  ): Promise<LocationEntity[]> {
    if (!criteria) return locations;

    return locations.filter(location => {
      // Apply filter criteria
      if (criteria.minImportance && (location.importance || 0) < criteria.minImportance) {
        return false;
      }

      if (criteria.categories && !criteria.categories.includes(location.category)) {
        return false;
      }

      if (criteria.types && !criteria.types.includes(location.type)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Create batches for concurrent processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Emit location progress event
   */
  private emitLocationProgress(sessionId: string, event: LocationBatchProgressEvent): void {
    const callback = this.progressCallbacks.get(sessionId);
    if (callback) {
      callback(event);
    }
  }

  /**
   * Handle batch error
   */
  private handleBatchError(sessionId: string, error: any): void {
    const session = this.locationSessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.endTime = Date.now();
    }

    this.emitLocationProgress(sessionId, {
      sessionId,
      stage: 'completed',
      progress: 100,
      message: `Batch processing failed: ${error.message}`,
    });
  }

  /**
   * Get session status
   */
  getLocationSessionStatus(sessionId: string): LocationBatchSession | undefined {
    return this.locationSessions.get(sessionId);
  }

  /**
   * Abort location batch session
   */
  async abortLocationSession(sessionId: string): Promise<void> {
    const session = this.locationSessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.endTime = Date.now();
    }

    // Cleanup session
    this.locationSessions.delete(sessionId);
    this.locationTasks.delete(sessionId);
    this.progressCallbacks.delete(sessionId);
  }
}
