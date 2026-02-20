/**
 * @file LocationBuildManager.ts
 * @description Location build processing manager extending shared build infrastructure.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type {
  LocationBuildConfig,
  LocationBuildFilterCriteria,
  LocationSearchConfig,
  LocationType,
} from '~/common/entities/LocationEntity';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import {
  mapType,
  parseNumber,
} from './download/mappers.js';
import { buildOsmPointProperties, buildOverpassPointProperties } from './pointFactories.js';
import { parseOpenFlightsCsv, parseOurAirportsCsv, parseWorldPortIndexCsv } from './download/csvSources.js';
import { appendLocationPoints, replaceLocationPoints } from './pointRepository.js';
import type { RawNominatimResult, RawOverpassElement } from './download/rawTypes.js';
import { getLocationDataSource } from '~/common/datasources/LocationDataSourceDefinitions';
import { FetchNetworkPort, getCorsProxyBaseURL, notifyPluginAuthRequired, postJson } from '@hierarchidb/download';
import { resolveIso3166CsvUrl } from '@hierarchidb/gen-iso3166-2/browser';

const logLocationBuildWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[LocationBuildManager]', message, error);
};

const isRawNominatimLike = (value: unknown): value is RawNominatimLike => {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const latType = typeof candidate.lat;
  const lonType = typeof candidate.lon;
  return (latType === 'string' || latType === 'number')
    && (lonType === 'string' || lonType === 'number');
};

const isRawNominatimArray = (value: unknown): value is RawNominatimLike[] => (
  Array.isArray(value) && value.every((item) => isRawNominatimLike(item))
);

const ISO3166_CSV_URL = resolveIso3166CsvUrl();

/**
 * Location build task interface
 */
export interface LocationBuildTask {
  taskId: string;
  nodeId: NodeId;
  searchConfig: LocationSearchConfig;
  status: 'pending' | 'searching' | 'geocoding' | 'validating' | 'completed' | 'failed';
  progress: number;
  results?: LocationPointProperties[];
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
 * Location build session status
 */
export interface LocationBuildSession {
  nodeId: NodeId;
  config: LocationBuildConfig;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalPoints: number;
  startTime: number;
  endTime?: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
}

/**
 * Location build progress event
 */
export interface LocationBuildProgressEvent {
  nodeId: NodeId;
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

type RawNominatimLike = RawNominatimResult;

/**
 * Location build manager extending Shape's build session manager
 */
export class LocationBuildManager {
  private locationSessions: Map<NodeId, LocationBuildSession> = new Map();
  private locationTasks: Map<NodeId, LocationBuildTask[]> = new Map();
  private progressCallbacks: Map<NodeId, (event: LocationBuildProgressEvent) => void> = new Map();
  private net: FetchNetworkPort | null = null;
  countryNameMap: Map<string, string> | null = null;

  private async persistLocationPoints(
    nodeId: NodeId,
    points: Array<LocationPointProperties>,
    mode: 'append' | 'replace' = 'append',
  ): Promise<void> {
    if (!points.length) return;
    if (mode === 'replace') {
      await replaceLocationPoints(nodeId, points);
      return;
    }
    await appendLocationPoints(nodeId, points);
  }

  async collectLocationPoints(
    nodeId: NodeId,
    config: LocationBuildConfig,
    progressCallback?: (event: LocationBuildProgressEvent) => void,
  ): Promise<LocationPointProperties[]> {
    const tasks = config.searchConfigs.map((searchConfig, index) => ({
      taskId: `collect-${nodeId}-task-${index}`,
      nodeId,
      searchConfig,
      status: 'pending' as const,
      progress: 0,
    }));
    const collected: LocationPointProperties[] = [];
    const concurrent = typeof config.processingOptions.concurrent === 'number'
      ? config.processingOptions.concurrent
      : 1;
    const batches = this.createBatches(tasks, concurrent);

    for (const batch of batches) {
      await Promise.all(batch.map(async (task) => {
        const searchResults = await this.searchLocations(task.searchConfig);
        const validatedResults = await this.validateAndFilterLocations(
          searchResults,
          config.filterCriteria,
        );
        collected.push(...validatedResults);
        progressCallback?.({
          nodeId: task.nodeId,
          taskId: task.taskId,
          stage: 'saving',
          progress: collected.length,
          message: `Collected ${collected.length} locations`,
          metrics: {
            locationsFound: collected.length,
            locationsProcessed: collected.length,
            locationsSaved: collected.length,
          },
        });
      }));
    }

    await this.persistLocationPoints(nodeId, collected, 'replace');
    return collected;
  }

  /**
   * Start location build session.
   */
  async startLocationBuildSession(
    nodeId: NodeId,
    config: LocationBuildConfig,
    progressCallback?: (event: LocationBuildProgressEvent) => void,
  ): Promise<NodeId> {
    const totalTasks = config.searchConfigs.length;

    // Create batch tasks
    const tasks: LocationBuildTask[] = config.searchConfigs.map((searchConfig, index) => ({
      taskId: `${nodeId}-task-${index}`,
      nodeId,
      searchConfig,
      status: 'pending' as const,
      progress: 0,
    }));

    // Initialize session
    const session: LocationBuildSession = {
      nodeId,
      config,
      totalTasks,
      completedTasks: 0,
      failedTasks: 0,
      totalPoints: 0,
      startTime: Date.now(),
      status: 'running',
    };

    this.locationSessions.set(nodeId, session);
    this.locationTasks.set(nodeId, tasks);

    if (progressCallback) {
      this.progressCallbacks.set(nodeId, progressCallback);
    }

    // Start processing
    this.processLocationBatch(nodeId).catch(error => {
      console.error('Location build processing failed:', error);
      this.handleBatchError(nodeId, error);
    });

    return nodeId;
  }

  /**
   * Process location batch
   */
  private async processLocationBatch(nodeId: NodeId): Promise<void> {
    const session = this.locationSessions.get(nodeId);
    const tasks = this.locationTasks.get(nodeId);

    if (!session || !tasks) {
      throw new Error(`Session not found: ${nodeId}`);
    }

    // Process tasks with concurrency control
    const concurrent = typeof session.config.processingOptions.concurrent === 'number'
      ? session.config.processingOptions.concurrent
      : 1;
    const batches = this.createBatches(tasks, concurrent);

    for (const batch of batches) {
      await Promise.all(batch.map(task => this.processLocationTask(task, session)));
    }

    // Complete session
    session.endTime = Date.now();
    session.status = session.failedTasks === 0 ? 'completed' : 'failed';

    // Emit completion event
    this.emitLocationProgress(nodeId, {
      nodeId,
      stage: 'completed',
      progress: 100,
      message: `Batch processing completed: ${session.totalPoints} locations processed`,
      metrics: {
        locationsFound: session.totalPoints,
        locationsProcessed: session.totalPoints,
        locationsSaved: session.totalPoints,
      },
    });
  }

  /**
   * Process individual location task
   */
  private async processLocationTask(
    task: LocationBuildTask,
    session: LocationBuildSession,
  ): Promise<void> {
    try {
      task.status = 'searching';
      task.metrics = {};

      // Phase 1: Search locations
      const searchStartTime = Date.now();
      const searchResults = await this.searchLocations(task.searchConfig);
      task.metrics.searchTime = Date.now() - searchStartTime;
      task.metrics.totalFound = searchResults.length;

      this.emitLocationProgress(session.nodeId, {
        nodeId: session.nodeId,
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

        this.emitLocationProgress(session.nodeId, {
          nodeId: session.nodeId,
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
        task.results,
        session.config.filterCriteria,
      );
      task.metrics.totalFiltered = task.results.length - validatedResults.length;
      task.results = validatedResults;

      this.emitLocationProgress(session.nodeId, {
        nodeId: session.nodeId,
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
      await this.persistLocationPoints(task.nodeId, task.results ?? []);
      task.metrics.totalSaved = task.results.length;
      session.totalPoints += task.results.length;
      session.completedTasks++;
      task.progress = 100;

      this.emitLocationProgress(session.nodeId, {
        nodeId: session.nodeId,
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
  private async searchLocations(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    // Try Strategy registry first (features-gated)
    try {
      const { getLocationStrategy } = await import('./download/strategyRegistry.js');
      const strategy = getLocationStrategy(config);
      if (strategy) {
        const list = await strategy.search(config);
        const normalized = await this.normalizeCountryCodes(list);
        const filtered = this.filterLocationsByConfig(normalized, config);
        if (config.limit && filtered.length > (config.limit || 0)) return filtered.slice(0, config.limit);
        return filtered;
      }
    } catch (error) {
      logLocationBuildWarning('Failed to execute registered location strategy', error);
    }

    const locations: LocationPointProperties[] = [];

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
      case 'ourairports':
        locations.push(...await this.searchOurAirports(config));
        break;
      case 'openflights':
        locations.push(...await this.searchOpenFlights(config));
        break;
      case 'world-port-index':
        locations.push(...await this.searchWorldPortIndex(config));
        break;
      default:
        console.warn(`Unsupported data source: ${config.dataSource}`);
    }

    const normalized = await this.normalizeCountryCodes(locations);
    const filtered = this.filterLocationsByConfig(normalized, config);

    // Apply limit if specified
    if (config.limit && filtered.length > config.limit) {
      return filtered.slice(0, config.limit);
    }

    return filtered;
  }

  /**
   * Search OpenStreetMap Nominatim
   */
  private async searchOSM(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
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
      const data = await this.getJson(`${endpoint}?${params}`);
      if (!isRawNominatimArray(data)) {
        logLocationBuildWarning('Unexpected Nominatim response shape', data);
        return [];
      }
      return await this.convertOSMToLocations(data);
    } catch (error) {
      console.error('OSM search failed:', error);
      return [];
    }
  }

  /**
   * Search GeoNames
   */
  private async searchGeoNames(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    // Placeholder implementation
    console.log('GeoNames search:', config);
    return [];
  }

  /**
   * Search Wikidata
   */
  private async searchWikidata(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    // Placeholder implementation
    console.log('Wikidata search:', config);
    return [];
  }

  /**
   * Search Overpass API
   */
  private async searchOverpass(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const endpoint = config.options?.overpassEndpoint || 'https://overpass-api.de/api/interpreter';
    const queryOption = config.options?.overpassQuery;
    const query = typeof queryOption === 'string' && queryOption.trim().length > 0
      ? queryOption
      : this.buildOverpassQuery(config);

    try {
      const data = await postJson<{ elements?: RawOverpassElement[] }>(
        'location',
        endpoint,
        query,
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      return await this.convertOverpassToLocations(data);
    } catch (error) {
      console.error('Overpass search failed:', error);
      return [];
    }
  }

  /**
   * Search custom endpoint
   */
  private async searchCustom(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    if (!config.options?.customEndpoint) {
      console.error('Custom endpoint not specified');
      return [];
    }

    try {
      const endpointUrl = config.options.customEndpoint;
      if (typeof endpointUrl !== 'string' || endpointUrl.length === 0) {
        console.error('Custom endpoint is invalid');
        return [];
      }
      const queryParamsRaw = config.options.queryParams as Record<string, unknown> | undefined;
      const queryParams = queryParamsRaw
        ? Object.entries(queryParamsRaw).reduce((acc, [key, value]) => {
          if (value == null) return acc;
          acc[key] = Array.isArray(value)
            ? value.map((item) => String(item)).join(',')
            : String(value);
          return acc;
        }, {} as Record<string, string>)
        : undefined;
      const searchParams = new URLSearchParams(queryParams);
      const requestUrl = searchParams.size > 0 ? `${endpointUrl}?${searchParams.toString()}` : endpointUrl;
      const customHeaders = config.options.customHeaders as HeadersInit | undefined;
      const init: RequestInit | undefined = customHeaders ? { headers: customHeaders } : undefined;
      const data = await this.getJson(requestUrl, init);
      return await this.convertCustomToLocations(data);
    } catch (error) {
      console.error('Custom search failed:', error);
      return [];
    }
  }

  private async searchOurAirports(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const source = getLocationDataSource('ourairports');
    const endpoint = config.options?.sourceUrl || source?.endpoints?.airports;
    if (typeof endpoint !== 'string' || endpoint.length === 0) {
      console.error('OurAirports endpoint not specified');
      return [];
    }
    try {
      const csv = await this.getText(endpoint);
      return await parseOurAirportsCsv(csv, Date.now());
    } catch (error) {
      console.error('OurAirports search failed:', error);
      return [];
    }
  }

  private async searchOpenFlights(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const source = getLocationDataSource('openflights');
    const endpoint = config.options?.sourceUrl || source?.endpoints?.airports;
    if (typeof endpoint !== 'string' || endpoint.length === 0) {
      console.error('OpenFlights endpoint not specified');
      return [];
    }
    try {
      const csv = await this.getText(endpoint);
      return await parseOpenFlightsCsv(csv, Date.now());
    } catch (error) {
      console.error('OpenFlights search failed:', error);
      return [];
    }
  }

  private async searchWorldPortIndex(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const source = getLocationDataSource('world-port-index');
    const endpoint = config.options?.sourceUrl || source?.endpoints?.ports;
    if (typeof endpoint !== 'string' || endpoint.length === 0) {
      console.error('World Port Index endpoint not specified');
      return [];
    }
    try {
      const csv = await this.getText(endpoint);
      return await parseWorldPortIndexCsv(csv, Date.now());
    } catch (error) {
      console.error('World Port Index search failed:', error);
      return [];
    }
  }

  private getNetworkPort(): FetchNetworkPort {
    if (this.net) return this.net;
    const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
    this.net = new FetchNetworkPort({
      perHostConcurrency: 4,
      corsProxyBaseURL,
      auth: { scope: 'location' },
    });
    return this.net;
  }

  private async getJson(url: string, init?: RequestInit): Promise<unknown> {
    const net = this.getNetworkPort();
    const res = await net.get(url, init);
    if (res.status === 401 || res.status === 403) {
      notifyPluginAuthRequired('location', { resource: url, provider: 'location', hint: 'Authentication required', status: res.status });
      throw new Error(`Auth required: ${res.status}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const text = new TextDecoder().decode(buf);
    return JSON.parse(text);
  }

  private async getText(url: string, init?: RequestInit): Promise<string> {
    const net = this.getNetworkPort();
    const res = await net.get(url, init);
    if (res.status === 401 || res.status === 403) {
      notifyPluginAuthRequired('location', { resource: url, provider: 'location', hint: 'Authentication required', status: res.status });
      throw new Error(`Auth required: ${res.status}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return new TextDecoder().decode(buf);
  }

  /**
   * Build Overpass query
   */
  private buildOverpassQuery(config: LocationSearchConfig): string {
    const bbox = config.boundingBox ?
      `(${config.boundingBox[1]},${config.boundingBox[0]},${config.boundingBox[3]},${config.boundingBox[2]})` :
      '';
    const countryCode = config.countryCode?.trim().toUpperCase();
    const areaClause = countryCode ? `area["ISO3166-1"="${countryCode}"][admin_level=2]->.searchArea;` : '';
    const region = countryCode ? '(area.searchArea)' : bbox;
    let query = '[out:json];';
    if (areaClause) {
      query += areaClause;
    }
    query += '(';

    // Add queries for each location type
    if (config.types && config.types.length > 0) {
      for (const type of config.types) {
        const osmTag = this.getOSMTagForType(type);
        if (osmTag) {
          query += `node["${osmTag.key}"="${osmTag.value}"]${region};`;
          query += `way["${osmTag.key}"="${osmTag.value}"]${region};`;
        }
      }
    } else if (config.query) {
      query += `node["name"~"${config.query}"]${region};`;
      query += `way["name"~"${config.query}"]${region};`;
    }

    query += ');out body;>;out skel qt;';
    return query;
  }

  /**
   * Get OSM tag for location type
   */
  private getOSMTagForType(type: LocationType): { key: string; value: string } | null {
    const typeToTag: Partial<Record<LocationType, { key: string; value: string }>> = {
      airport: { key: 'aeroway', value: 'aerodrome' },
      railway_station: { key: 'railway', value: 'station' },
      port: { key: 'harbour', value: 'yes' },
      interchange: { key: 'highway', value: 'motorway_junction' },
    };

    return typeToTag[type] ?? null;
  }

  /**
   * Convert OSM data to location entities
   */
  private async convertOSMToLocations(data: RawNominatimLike[]): Promise<LocationPointProperties[]> {
    const points: Array<LocationPointProperties | null> = await Promise.all(
      data.map((item) => this.createLocationFromOSM(item)),
    );
    return points.filter((value): value is LocationPointProperties => value !== null);
  }

  /**
   * Convert Overpass data to location entities
   */
  private async convertOverpassToLocations(data: { elements?: RawOverpassElement[] }): Promise<LocationPointProperties[]> {
    if (!Array.isArray(data.elements)) return [];
    const points: Array<LocationPointProperties | null> = await Promise.all(
      data.elements.map((item) => this.createLocationFromOverpass(item)),
    );
    return points.filter((value): value is LocationPointProperties => value !== null);
  }

  /**
   * Convert custom data to location entities
   */
  private async convertCustomToLocations(_data: unknown): Promise<LocationPointProperties[]> {
    // This would need custom mapping logic based on the data format
    return [];
  }

  /**
   * Create location entity from OSM data
   */
  private async createLocationFromOSM(osmData: RawNominatimLike): Promise<LocationPointProperties | null> {
    const lon = parseNumber(osmData.lon);
    const lat = parseNumber(osmData.lat);
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;

    const type = mapType(osmData.type);
    const fetchedAt = Date.now();
    const point = await buildOsmPointProperties(
      osmData,
      type,
      lat,
      lon,
      fetchedAt,
    );
    return point;
  }

  /**
   * Create location entity from Overpass data
   */
  private async createLocationFromOverpass(overpassData: RawOverpassElement): Promise<LocationPointProperties | null> {
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
    const mappedType = this.detectTypeFromTags(tags);
    const fetchedAt = Date.now();
    const point = await buildOverpassPointProperties(
      overpassData,
      mappedType,
      lat,
      lon,
      fetchedAt,
    );

    return point;
  }

  /**
   * Detect category from OSM class
   */
  /**
   * Detect category from OSM tags
   */
  /**
   * Detect type from OSM tags
   */
  private detectTypeFromTags(tags: Record<string, string>): LocationType {
    if (tags.aeroway === 'aerodrome') return 'airport';
    if (tags.railway === 'station') return 'railway_station';
    if (tags.harbour === 'yes') return 'port';
    if (tags.highway === 'motorway_junction') return 'interchange';
    return 'area_centroid';
  }

  /**
   * Geocode locations
   */
  private async geocodeLocations(locations: LocationPointProperties[]): Promise<LocationPointProperties[]> {
    // Geocoding would be done here for locations without coordinates
    // or to enhance address information
    return locations;
  }

  /**
   * Validate and filter locations
   */
  private async validateAndFilterLocations(
    locations: LocationPointProperties[],
    criteria?: LocationBuildFilterCriteria,
  ): Promise<LocationPointProperties[]> {
    if (!criteria) return locations;

    const normalizedCodes = criteria.countryCodes?.map((code: string) => code.toUpperCase()) ?? [];
    const normalizedNames = criteria.countryNames?.map((name: string) => name.toLowerCase()) ?? [];

    return locations.filter(location => {
      if (criteria.allowedTypes && !criteria.allowedTypes.includes(location.type as LocationType)) {
        return false;
      }

      if (normalizedCodes.length > 0 || normalizedNames.length > 0) {
        const normalizedLocationCode = location.admin0Code?.toUpperCase();
        const normalizedLocationName = location.admin0?.toLowerCase();
        const matchesCode = normalizedLocationCode
          ? normalizedCodes.includes(normalizedLocationCode)
          : false;
        const matchesName = normalizedLocationName
          ? normalizedNames.includes(normalizedLocationName)
          : false;
        if (!matchesCode && !matchesName) {
          if (normalizedLocationCode || normalizedLocationName) {
            return false;
          }
        }
      }

      if (criteria.excludeIds && location.pointId && criteria.excludeIds.includes(String(location.pointId))) {
        return false;
      }

      return true;
    });
  }

  private filterLocationsByConfig(
    locations: LocationPointProperties[],
    config: LocationSearchConfig,
  ): LocationPointProperties[] {
    const allowedTypes = config.types ?? [];
    const hasTypeFilter = allowedTypes.length > 0;
    const countryCode = config.countryCode?.toUpperCase();
    const countryName = config.countryName?.toLowerCase();
    const hasCountryFilter = Boolean(countryCode || countryName);

    if (!hasTypeFilter && !hasCountryFilter) return locations;

    return locations.filter((location) => {
      if (hasTypeFilter && !allowedTypes.includes(location.type as LocationType)) {
        return false;
      }
      if (!hasCountryFilter) return true;

      const normalizedLocationCode = location.admin0Code?.toUpperCase();
      const normalizedLocationName = location.admin0?.toLowerCase();
      const matchesCode = countryCode && normalizedLocationCode
        ? normalizedLocationCode === countryCode
        : false;
      const matchesName = countryName && normalizedLocationName
        ? normalizedLocationName === countryName
        : false;

      if (matchesCode || matchesName) return true;
      if (normalizedLocationCode || normalizedLocationName) return false;
      return true;
    });
  }

  private async normalizeCountryCodes(
    locations: LocationPointProperties[],
  ): Promise<LocationPointProperties[]> {
    if (locations.length === 0) return locations;
    const map = await this.getCountryNameMap();
    if (map.size === 0) return locations;
    return locations.map((location) => {
      const rawCode = location.admin0Code?.trim();
      const rawName = location.admin0?.trim();
      const normalized = this.resolveIso2Code(map, rawCode, rawName);
      if (!normalized || normalized === location.admin0Code) return location;
      return { ...location, admin0Code: normalized };
    });
  }

  private resolveIso2Code(
    map: Map<string, string>,
    rawCode?: string,
    rawName?: string,
  ): string | null {
    if (rawCode) {
      const normalized = rawCode.trim().toUpperCase();
      if (normalized.length === 2) return normalized;
      const mappedCode = map.get(normalized.toLowerCase());
      if (mappedCode) return mappedCode;
    }
    if (rawName) {
      const mappedName = map.get(rawName.trim().toLowerCase());
      if (mappedName) return mappedName;
    }
    return null;
  }

  private async getCountryNameMap(): Promise<Map<string, string>> {
    if (this.countryNameMap) return this.countryNameMap;
    try {
      const { ensureIso3166Data, getAllCountries } = await import('@hierarchidb/gen-iso3166-2/browser');
      await ensureIso3166Data({ csvUrl: ISO3166_CSV_URL });
      const countries = await getAllCountries();
      const map = new Map<string, string>();
      countries.forEach((country) => {
        const alpha2 = country.alpha2.toUpperCase();
        map.set(country.alpha2.toLowerCase(), alpha2);
        map.set(country.alpha3.toLowerCase(), alpha2);
        map.set(country.countryEn.toLowerCase(), alpha2);
      });
      this.countryNameMap = map;
      return map;
    } catch (error) {
      logLocationBuildWarning('Failed to normalize country names using ISO3166 data', error);
      this.countryNameMap = new Map();
      return this.countryNameMap;
    }
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
  private emitLocationProgress(nodeId: NodeId, event: LocationBuildProgressEvent): void {
    const callback = this.progressCallbacks.get(nodeId);
    if (callback) {
      callback(event);
    }
  }

  /**
   * Handle batch error
   */
  private handleBatchError(nodeId: NodeId, error: {message:unknown}): void {
    const session = this.locationSessions.get(nodeId);
    if (session) {
      session.status = 'failed';
      session.endTime = Date.now();
    }

    this.emitLocationProgress(nodeId, {
      nodeId,
      stage: 'completed',
      progress: 100,
      message: `Batch processing failed: ${error.message}`,
    });
  }

  /**
   * Get location build session status.
   */
  getLocationBuildSessionStatus(nodeId: NodeId): LocationBuildSession | undefined {
    return this.locationSessions.get(nodeId);
  }


  /**
   * Abort location build session.
   */
  async abortLocationBuildSession(nodeId: NodeId): Promise<void> {
    const session = this.locationSessions.get(nodeId);
    if (session) {
      session.status = 'failed';
      session.endTime = Date.now();
    }

    // Cleanup session
    this.locationSessions.delete(nodeId);
    this.locationTasks.delete(nodeId);
    this.progressCallbacks.delete(nodeId);
  }

}
