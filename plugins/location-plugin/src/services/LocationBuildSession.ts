/**
 * @file LocationBuildSession.ts
 * @description Location build session extending AbstractBuildSession.
 */

import type {
  BuildTaskSummary,
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
  TaskStatus,
} from '@hierarchidb/build-api';
import {
  AbstractBuildSession,
  type CanonicalBuildSessionEventSource,
} from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import { FetchNetworkPort, notifyPluginAuthRequired } from '@hierarchidb/download';
import { resolveIso3166CsvUrl } from '@hierarchidb/gen-iso3166-2/browser';
import { getLocationDataSource } from '~/common/datasources/LocationDataSourceDefinitions';
import type {
  LocationBuildConfig,
  LocationBuildFilterCriteria,
  LocationSearchConfig,
  LocationType,
} from '~/common/entities/LocationEntity';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import { createLocationNetworkPort } from './download/createLocationNetworkPort.js';
import {
  parseOpenFlightsCsv,
  parseOurAirportsCsv,
  parseWorldPortIndexCsv,
} from './download/csvSourceConstants.js';
import { mapType, parseNumber } from './download/mapperUtils.js';
import type { RawNominatimResult, RawOverpassElement } from './download/rawTypes.js';
import { buildOsmPointProperties, buildOverpassPointProperties } from './pointFactoryUtils.js';
import { replaceLocationArtifacts, replaceLocationPoints } from './pointRepository.js';
import type { LocationSourcePlan } from './source/LocationSourcePlan.js';
import { createLocationSourceArtifactRecord } from './source/persistLocationSourceArtifact.js';
import { runLocationSourceArtifactCleanup } from './source/runLocationSourceArtifactCleanup.js';

const logLocationBuildWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[LocationBuildSession]', message, error);
};

type RawNominatimLike = RawNominatimResult;

const isRawNominatimLike = (value: unknown): value is RawNominatimLike => {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const latType = typeof candidate.lat;
  const lonType = typeof candidate.lon;
  return (
    (latType === 'string' || latType === 'number') && (lonType === 'string' || lonType === 'number')
  );
};

const isRawNominatimArray = (value: unknown): value is RawNominatimLike[] =>
  Array.isArray(value) && value.every((item) => isRawNominatimLike(item));

const ISO3166_CSV_URL = resolveIso3166CsvUrl();

type LocationBuildTaskState = {
  taskId: string;
  searchConfig: LocationSearchConfig;
  status: TaskStatus;
  progress: number;
  version: number;
  index: number;
  errorMessage?: string;
};

type LocationStageTiming = {
  stageStartedAt: number;
  stageInactiveMs: number;
  stageCompletedAt?: number;
};

class LocationAuthRequiredError extends Error {
  readonly code = 'BUILD_AUTH_REQUIRED';

  constructor(status: number) {
    super(`Auth required: ${String(status)}`);
    this.name = 'LocationAuthRequiredError';
  }
}

const isAuthRequiredError = (error: unknown): error is LocationAuthRequiredError =>
  error instanceof LocationAuthRequiredError ||
  (error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'BUILD_AUTH_REQUIRED');

export class LocationBuildSession
  extends AbstractBuildSession<LocationBuildConfig>
  implements CanonicalBuildSessionEventSource
{
  private net: FetchNetworkPort | null = null;
  private readonly tasks: LocationBuildTaskState[];
  private readonly pendingTaskProgressUpdates: TaskProgressUpdatedEvent['payload'][] = [];
  private sourceStageTiming: LocationStageTiming | null = null;
  countryNameMap: Map<string, string> | null = null;

  constructor(
    nodeId: NodeId,
    config: LocationBuildConfig,
    private readonly sourcePlan: LocationSourcePlan
  ) {
    super(nodeId, config);
    this.tasks = config.searchConfigs.map((searchConfig, index) => ({
      taskId: `${String(nodeId)}:source:${String(index)}`,
      searchConfig,
      status: 'queued',
      progress: 0,
      version: 1,
      index,
    }));
  }

  protected async processBatch(signal: AbortSignal): Promise<void> {
    const { processingOptions } = this.config;
    const total = this.tasks.length;
    let completed = 0;
    let failed = 0;
    const sourcePoints: LocationPointProperties[] = [];

    this.beginSourceStage();
    this.updateProgress({ total, completed, failed }, 'source');

    const concurrent =
      typeof processingOptions.concurrent === 'number' ? processingOptions.concurrent : 1;

    const batches = createBatches(this.tasks, concurrent);

    for (const batch of batches) {
      if (signal.aborted) throw abortError('Location build aborted');

      const taskResults = await Promise.allSettled(
        batch.map(async (task) => {
          requireNotAborted(signal, 'Location build paused before task start');
          task.status = 'running';
          task.errorMessage = undefined;
          this.updateLocationTaskProgress(task, 0);
          this.updateProgress({ total, completed, failed }, 'source');
          try {
            const results = await this.searchLocations(task.searchConfig);
            requireNotAborted(signal, 'Location build paused during search');
            const validated = await this.validateAndFilterLocations(
              results,
              this.config.filterCriteria
            );
            requireNotAborted(signal, 'Location build paused during validation');
            sourcePoints.push(...validated);
            completed += 1;
            task.status = 'completed';
            this.updateLocationTaskProgress(task, 100);
          } catch (error) {
            if (isAbortError(error)) throw error;
            if (isAuthRequiredError(error)) throw error;
            failed += 1;
            task.status = 'failed';
            task.errorMessage = error instanceof Error ? error.message : String(error);
            this.updateLocationTaskProgress(task, task.progress, task.errorMessage);
            logLocationBuildWarning('Location search task failed', error);
          }
          this.updateProgress({ total, completed, failed }, 'source');
        })
      );
      const rejectedTask = taskResults.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      if (rejectedTask) throw rejectedTask.reason;
    }

    if (failed > 0) {
      throw new Error(`Location build completed with ${failed} failures`);
    }
    const completedAt = Date.now();
    const sourceArtifact = createLocationSourceArtifactRecord({
      nodeId: this.nodeId,
      sourcePlan: this.sourcePlan,
      points: sourcePoints,
      completedAt,
    });
    await runLocationSourceArtifactCleanup(this.nodeId);
    requireNotAborted(signal, 'Location build paused during artifact cleanup');
    await replaceLocationArtifacts(this.nodeId, sourcePoints, sourceArtifact);
    requireNotAborted(signal, 'Location build paused during persistence');
    this.completeSourceStage(completedAt);
    this.updateProgress({ total, completed, failed }, 'source');
  }

  getCanonicalStageSnapshot(): StageSnapshotUpdatedEvent['payload'] | null {
    if (!this.sourceStageTiming) return null;
    return {
      stageId: 'source',
      tasks: this.tasks.map((task) => ({
        taskId: task.taskId,
        stage: 'source',
        status: task.status,
        progress: task.progress,
        version: task.version,
        errorMessage: task.errorMessage,
        metadata: {
          dataSource: task.searchConfig.dataSource,
          index: task.index,
          inputHash: this.sourcePlan.identity.inputHash,
        },
      })),
      ...this.sourceStageTiming,
    };
  }

  takeCanonicalTaskProgressUpdates(): TaskProgressUpdatedEvent['payload'][] {
    return this.pendingTaskProgressUpdates.splice(0);
  }

  getBuildTasks(): BuildTaskSummary[] {
    return this.tasks.map((task) => ({
      taskId: task.taskId,
      version: task.version,
      stage: 'source',
      status: task.status,
      progress: task.progress,
      errorMessage: task.errorMessage,
      metadata: {
        dataSource: task.searchConfig.dataSource,
        index: task.index,
        inputHash: this.sourcePlan.identity.inputHash,
      },
    }));
  }

  protected override async onPause(): Promise<void> {
    for (const task of this.tasks) {
      if (task.status !== 'running') continue;
      task.status = 'queued';
      task.errorMessage = undefined;
      this.updateLocationTaskProgress(task, 0);
    }
  }

  protected override shouldPauseOnError(error: unknown): boolean {
    return isAuthRequiredError(error);
  }

  protected override async onCancelQueued(): Promise<void> {
    this.tasks.splice(0);
    this.updateProgress({ total: 0, completed: 0, failed: 0, skipped: 0 });
  }

  private beginSourceStage(): void {
    if (this.sourceStageTiming) {
      throw new Error('Location source stage has already started');
    }
    this.sourceStageTiming = {
      stageStartedAt: Date.now(),
      stageInactiveMs: 0,
    };
  }

  private completeSourceStage(completedAt: number): void {
    if (!this.sourceStageTiming) {
      throw new Error('Location source stage cannot complete before it starts');
    }
    if (!Number.isFinite(completedAt) || completedAt < 0) {
      throw new Error(`Location source stage completedAt must be finite and non-negative`);
    }
    this.sourceStageTiming.stageCompletedAt = completedAt;
  }

  private updateLocationTaskProgress(
    task: LocationBuildTaskState,
    value: number,
    message?: string
  ): void {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Location task progress must be finite 0..100, received ${String(value)}`);
    }
    task.progress = value;
    task.version += 1;
    this.pendingTaskProgressUpdates.push({
      taskId: task.taskId,
      version: task.version,
      stageId: 'source',
      value,
      message,
      metadata: {
        dataSource: task.searchConfig.dataSource,
        index: task.index,
        inputHash: this.sourcePlan.identity.inputHash,
      },
    });
  }

  private async persistLocationPoints(
    nodeId: NodeId,
    points: LocationPointProperties[]
  ): Promise<void> {
    if (!points.length) return;
    await replaceLocationPoints(nodeId, points);
  }

  async collectLocationPoints(config: LocationBuildConfig): Promise<LocationPointProperties[]> {
    const concurrent =
      typeof config.processingOptions.concurrent === 'number'
        ? config.processingOptions.concurrent
        : 1;
    const batches = createBatches(config.searchConfigs, concurrent);
    const collected: LocationPointProperties[] = [];

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (searchConfig) => {
          const results = await this.searchLocations(searchConfig);
          const validated = await this.validateAndFilterLocations(results, config.filterCriteria);
          collected.push(...validated);
        })
      );
    }

    await this.persistLocationPoints(this.nodeId, collected);
    return collected;
  }

  private async searchLocations(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const { getLocationStrategy } = await import('./download/strategyRegistryUtils.js');
    const strategy = getLocationStrategy(config);
    if (strategy) {
      const list = await strategy.search(config);
      const normalized = await this.normalizeCountryCodes(list);
      const filtered = this.filterLocationsByConfig(normalized, config);
      if (config.limit && filtered.length > config.limit) return filtered.slice(0, config.limit);
      return filtered;
    }

    const locations: LocationPointProperties[] = [];

    switch (config.dataSource) {
      case 'openstreetmap':
        locations.push(...(await this.searchOSM(config)));
        break;
      case 'geonames':
        locations.push(...(await this.searchGeoNames(config)));
        break;
      case 'wikidata':
        locations.push(...(await this.searchWikidata(config)));
        break;
      case 'overpass':
        locations.push(...(await this.searchOverpass(config)));
        break;
      case 'custom':
        locations.push(...(await this.searchCustom(config)));
        break;
      case 'ourairports':
        locations.push(...(await this.searchOurAirports(config)));
        break;
      case 'openflights':
        locations.push(...(await this.searchOpenFlights(config)));
        break;
      case 'world-port-index':
        locations.push(...(await this.searchWorldPortIndex(config)));
        break;
      default:
        throw new Error(`Unsupported location data source: ${String(config.dataSource)}`);
    }

    const normalized = await this.normalizeCountryCodes(locations);
    const filtered = this.filterLocationsByConfig(normalized, config);
    if (config.limit && filtered.length > config.limit) {
      return filtered.slice(0, config.limit);
    }
    return filtered;
  }

  private async searchOSM(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const endpoint =
      config.options?.nominatimEndpoint || 'https://nominatim.openstreetmap.org/search';
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
    const data = await this.getJson(`${endpoint}?${params}`);
    if (!isRawNominatimArray(data)) {
      throw new Error('Unexpected Nominatim response shape');
    }
    return await this.convertOSMToLocations(data);
  }

  private async searchGeoNames(_config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    throw new Error('GeoNames location search is not implemented');
  }

  private async searchWikidata(_config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    throw new Error('Wikidata location search is not implemented');
  }

  private async searchOverpass(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const endpoint = config.options?.overpassEndpoint || 'https://overpass-api.de/api/interpreter';
    const queryOption = config.options?.overpassQuery;
    const query =
      typeof queryOption === 'string' && queryOption.trim().length > 0
        ? queryOption
        : this.buildOverpassQuery(config);
    const data = await this.postTextJson<{ elements?: RawOverpassElement[] }>(endpoint, query, {
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    return await this.convertOverpassToLocations(data);
  }

  private async searchCustom(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    if (!config.options?.customEndpoint) {
      throw new Error('Custom endpoint not specified');
    }
    const endpointUrl = config.options.customEndpoint;
    if (typeof endpointUrl !== 'string' || endpointUrl.length === 0) {
      throw new Error('Custom endpoint is invalid');
    }
    const queryParamsRaw = config.options.queryParams as Record<string, unknown> | undefined;
    const queryParams = queryParamsRaw
      ? Object.entries(queryParamsRaw).reduce(
          (acc, [key, value]) => {
            if (value == null) return acc;
            acc[key] = Array.isArray(value)
              ? value.map((item) => String(item)).join(',')
              : String(value);
            return acc;
          },
          {} as Record<string, string>
        )
      : undefined;
    const searchParams = new URLSearchParams(queryParams);
    const requestUrl =
      searchParams.size > 0 ? `${endpointUrl}?${searchParams.toString()}` : endpointUrl;
    const customHeaders = config.options.customHeaders as HeadersInit | undefined;
    const init: RequestInit | undefined = customHeaders ? { headers: customHeaders } : undefined;
    const data = await this.getJson(requestUrl, init);
    return await this.convertCustomToLocations(data);
  }

  private async searchOurAirports(
    config: LocationSearchConfig
  ): Promise<LocationPointProperties[]> {
    const source = getLocationDataSource('ourairports');
    const endpoint = config.options?.sourceUrl || source?.endpoints?.airports;
    if (typeof endpoint !== 'string' || endpoint.length === 0) {
      throw new Error('OurAirports endpoint not specified');
    }
    const csv = await this.getText(endpoint);
    return await parseOurAirportsCsv(csv, Date.now());
  }

  private async searchOpenFlights(
    config: LocationSearchConfig
  ): Promise<LocationPointProperties[]> {
    const source = getLocationDataSource('openflights');
    const endpoint = config.options?.sourceUrl || source?.endpoints?.airports;
    if (typeof endpoint !== 'string' || endpoint.length === 0) {
      throw new Error('OpenFlights endpoint not specified');
    }
    const csv = await this.getText(endpoint);
    return await parseOpenFlightsCsv(csv, Date.now());
  }

  private async searchWorldPortIndex(
    config: LocationSearchConfig
  ): Promise<LocationPointProperties[]> {
    const source = getLocationDataSource('world-port-index');
    const endpoint = config.options?.sourceUrl || source?.endpoints?.ports;
    if (typeof endpoint !== 'string' || endpoint.length === 0) {
      throw new Error('World Port Index endpoint not specified');
    }
    const csv = await this.getText(endpoint);
    return await parseWorldPortIndexCsv(csv, Date.now());
  }

  private getNetworkPort(): FetchNetworkPort {
    if (this.net) return this.net;
    const state = this.getState();
    this.net = createLocationNetworkPort({
      concurrent: this.config.concurrentDownloads ?? this.config.processingOptions.concurrent ?? 1,
      sessionId: String(this.nodeId),
      sessionStartedAt: state.startedAt,
    });
    return this.net;
  }

  private async getJson(url: string, init?: RequestInit): Promise<unknown> {
    const net = this.getNetworkPort();
    const res = await net.get(url, init);
    if (res.status === 401 || res.status === 403) {
      notifyPluginAuthRequired('location', {
        resource: url,
        provider: 'location',
        hint: 'Authentication required',
        status: res.status,
      });
      throw new LocationAuthRequiredError(res.status);
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
      notifyPluginAuthRequired('location', {
        resource: url,
        provider: 'location',
        hint: 'Authentication required',
        status: res.status,
      });
      throw new LocationAuthRequiredError(res.status);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return new TextDecoder().decode(buf);
  }

  private async postTextJson<T>(
    url: string,
    body: string,
    headers: Record<string, string>
  ): Promise<T> {
    const net = this.getNetworkPort();
    const res = await net.post(url, {
      body,
      headers,
    });
    if (res.status === 401 || res.status === 403) {
      notifyPluginAuthRequired('location', {
        resource: url,
        provider: 'location',
        hint: 'Authentication required',
        status: res.status,
      });
      throw new LocationAuthRequiredError(res.status);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const text = new TextDecoder().decode(buf);
    return JSON.parse(text) as T;
  }

  private buildOverpassQuery(config: LocationSearchConfig): string {
    const bbox = config.boundingBox
      ? `(${config.boundingBox[1]},${config.boundingBox[0]},${config.boundingBox[3]},${config.boundingBox[2]})`
      : '';
    const countryCode = config.countryCode?.trim().toUpperCase();
    const areaClause = countryCode
      ? `area["ISO3166-1"="${countryCode}"][admin_level=2]->.searchArea;`
      : '';
    const region = countryCode ? '(area.searchArea)' : bbox;
    let query = '[out:json];';
    if (areaClause) query += areaClause;
    query += '(';
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

  private getOSMTagForType(type: LocationType): { key: string; value: string } | null {
    const typeToTag: Partial<Record<LocationType, { key: string; value: string }>> = {
      airport: { key: 'aeroway', value: 'aerodrome' },
      railway_station: { key: 'railway', value: 'station' },
      port: { key: 'harbour', value: 'yes' },
      interchange: { key: 'highway', value: 'motorway_junction' },
    };
    return typeToTag[type] ?? null;
  }

  private async convertOSMToLocations(
    data: RawNominatimLike[]
  ): Promise<LocationPointProperties[]> {
    const points = await Promise.all(data.map((item) => this.createLocationFromOSM(item)));
    return points.filter((value): value is LocationPointProperties => value !== null);
  }

  private async convertOverpassToLocations(data: {
    elements?: RawOverpassElement[];
  }): Promise<LocationPointProperties[]> {
    if (!Array.isArray(data.elements)) return [];
    const points = await Promise.all(
      data.elements.map((item) => this.createLocationFromOverpass(item))
    );
    return points.filter((value): value is LocationPointProperties => value !== null);
  }

  private async convertCustomToLocations(_data: unknown): Promise<LocationPointProperties[]> {
    return [];
  }

  private async createLocationFromOSM(
    osmData: RawNominatimLike
  ): Promise<LocationPointProperties | null> {
    const lon = parseNumber(osmData.lon);
    const lat = parseNumber(osmData.lat);
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;
    const type = mapType(osmData.type);
    const fetchedAt = Date.now();
    return buildOsmPointProperties(osmData, type, lat, lon, fetchedAt);
  }

  private async createLocationFromOverpass(
    overpassData: RawOverpassElement
  ): Promise<LocationPointProperties | null> {
    const lon =
      typeof overpassData.lon === 'number'
        ? overpassData.lon
        : typeof overpassData.lon === 'string'
          ? parseNumber(overpassData.lon)
          : overpassData.center?.lon;
    const lat =
      typeof overpassData.lat === 'number'
        ? overpassData.lat
        : typeof overpassData.lat === 'string'
          ? parseNumber(overpassData.lat)
          : overpassData.center?.lat;
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;
    const tags = overpassData.tags ?? {};
    const mappedType = this.detectTypeFromTags(tags);
    const fetchedAt = Date.now();
    return buildOverpassPointProperties(overpassData, mappedType, lat, lon, fetchedAt);
  }

  private detectTypeFromTags(tags: Record<string, string>): LocationType {
    if (tags.aeroway === 'aerodrome') return 'airport';
    if (tags.railway === 'station') return 'railway_station';
    if (tags.harbour === 'yes') return 'port';
    if (tags.highway === 'motorway_junction') return 'interchange';
    return 'area_centroid';
  }

  private async validateAndFilterLocations(
    locations: LocationPointProperties[],
    criteria?: LocationBuildFilterCriteria
  ): Promise<LocationPointProperties[]> {
    if (!criteria) return locations;
    const normalizedCodes = criteria.countryCodes?.map((code: string) => code.toUpperCase()) ?? [];
    const normalizedNames = criteria.countryNames?.map((name: string) => name.toLowerCase()) ?? [];
    return locations.filter((location) => {
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
          if (normalizedLocationCode || normalizedLocationName) return false;
        }
      }
      if (
        criteria.excludeIds &&
        location.pointId &&
        criteria.excludeIds.includes(String(location.pointId))
      ) {
        return false;
      }
      return true;
    });
  }

  private filterLocationsByConfig(
    locations: LocationPointProperties[],
    config: LocationSearchConfig
  ): LocationPointProperties[] {
    const allowedTypes = config.types ?? [];
    const hasTypeFilter = allowedTypes.length > 0;
    const countryCode = config.countryCode?.toUpperCase();
    const countryName = config.countryName?.toLowerCase();
    const hasCountryFilter = Boolean(countryCode || countryName);
    if (!hasTypeFilter && !hasCountryFilter) return locations;
    return locations.filter((location) => {
      if (hasTypeFilter && !allowedTypes.includes(location.type as LocationType)) return false;
      if (!hasCountryFilter) return true;
      const normalizedLocationCode = location.admin0Code?.toUpperCase();
      const normalizedLocationName = location.admin0?.toLowerCase();
      const matchesCode =
        countryCode && normalizedLocationCode ? normalizedLocationCode === countryCode : false;
      const matchesName =
        countryName && normalizedLocationName ? normalizedLocationName === countryName : false;
      if (matchesCode || matchesName) return true;
      if (normalizedLocationCode || normalizedLocationName) return false;
      return true;
    });
  }

  private async normalizeCountryCodes(
    locations: LocationPointProperties[]
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
    rawName?: string
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

  async getCountryNameMap(): Promise<Map<string, string>> {
    if (this.countryNameMap) return this.countryNameMap;
    try {
      const { ensureIso3166Data, getAllCountries } = await import(
        '@hierarchidb/gen-iso3166-2/browser'
      );
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
}

function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

function requireNotAborted(signal: AbortSignal, message: string): void {
  if (signal.aborted) throw abortError(message);
}

function isAbortError(error: unknown): boolean {
  return (
    error !== null && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
  );
}

function abortError(message: string): Error {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}
