/**
 * @file LocationBuildSession.ts
 * @description Location build session extending AbstractBuildSession.
 */

import { AbstractBuildSession } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import type {
    LocationBuildConfig,
    LocationBuildFilterCriteria,
    LocationSearchConfig,
    LocationType,
} from '~/common/entities/LocationEntity';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import { mapType, parseNumber } from './download/mapperUtils.js';
import { buildOsmPointProperties, buildOverpassPointProperties } from './pointFactoryUtils.js';
import { parseOpenFlightsCsv, parseOurAirportsCsv, parseWorldPortIndexCsv } from './download/csvSourceConstants.js';
import { appendLocationPoints, replaceLocationPoints } from './pointRepository.js';
import type { RawNominatimResult, RawOverpassElement } from './download/rawTypes.js';
import { getLocationDataSource } from '~/common/datasources/LocationDataSourceDefinitions';
import { FetchNetworkPort, getCorsProxyBaseURL, notifyPluginAuthRequired, postJson } from '@hierarchidb/download';
import { resolveIso3166CsvUrl } from '@hierarchidb/gen-iso3166-2/browser';

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
    return (latType === 'string' || latType === 'number')
        && (lonType === 'string' || lonType === 'number');
};

const isRawNominatimArray = (value: unknown): value is RawNominatimLike[] => (
    Array.isArray(value) && value.every((item) => isRawNominatimLike(item))
);

const ISO3166_CSV_URL = resolveIso3166CsvUrl();

export class LocationBuildSession extends AbstractBuildSession<LocationBuildConfig> {
    private net: FetchNetworkPort | null = null;
    countryNameMap: Map<string, string> | null = null;

    constructor(nodeId: NodeId, config: LocationBuildConfig) {
        super(nodeId, config);
    }

    protected async processBatch(signal: AbortSignal): Promise<void> {
        const { searchConfigs, processingOptions } = this.config;
        const total = searchConfigs.length;
        let completed = 0;
        let failed = 0;

        this.updateProgress({ total, completed, failed }, 'source');

        const concurrent = typeof processingOptions.concurrent === 'number'
            ? processingOptions.concurrent
            : 1;

        const batches = createBatches(searchConfigs, concurrent);

        for (const batch of batches) {
            if (signal.aborted) throw abortError('Location build aborted');

            await Promise.all(batch.map(async (searchConfig) => {
                try {
                    const results = await this.searchLocations(searchConfig);
                    const validated = await this.validateAndFilterLocations(results, this.config.filterCriteria);
                    await this.persistLocationPoints(this.nodeId, validated);
                    completed += 1;
                } catch (error) {
                    failed += 1;
                    logLocationBuildWarning('Location search task failed', error);
                }
                this.updateProgress({ total, completed, failed }, 'source');
            }));
        }

        if (failed > 0) {
            throw new Error(`Location build completed with ${failed} failures`);
        }
    }

    private async persistLocationPoints(
        nodeId: NodeId,
        points: LocationPointProperties[],
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
        config: LocationBuildConfig,
    ): Promise<LocationPointProperties[]> {
        const concurrent = typeof config.processingOptions.concurrent === 'number'
            ? config.processingOptions.concurrent
            : 1;
        const batches = createBatches(config.searchConfigs, concurrent);
        const collected: LocationPointProperties[] = [];

        for (const batch of batches) {
            await Promise.all(batch.map(async (searchConfig) => {
                const results = await this.searchLocations(searchConfig);
                const validated = await this.validateAndFilterLocations(results, config.filterCriteria);
                collected.push(...validated);
            }));
        }

        await this.persistLocationPoints(this.nodeId, collected, 'replace');
        return collected;
    }

    private async searchLocations(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
        try {
            const { getLocationStrategy } = await import('./download/strategyRegistryUtils.js');
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
        if (config.limit && filtered.length > config.limit) {
            return filtered.slice(0, config.limit);
        }
        return filtered;
    }

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

    private async searchGeoNames(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
        console.log('GeoNames search:', config);
        return [];
    }

    private async searchWikidata(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
        console.log('Wikidata search:', config);
        return [];
    }

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

    private buildOverpassQuery(config: LocationSearchConfig): string {
        const bbox = config.boundingBox
            ? `(${config.boundingBox[1]},${config.boundingBox[0]},${config.boundingBox[3]},${config.boundingBox[2]})`
            : '';
        const countryCode = config.countryCode?.trim().toUpperCase();
        const areaClause = countryCode ? `area["ISO3166-1"="${countryCode}"][admin_level=2]->.searchArea;` : '';
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

    private async convertOSMToLocations(data: RawNominatimLike[]): Promise<LocationPointProperties[]> {
        const points = await Promise.all(data.map((item) => this.createLocationFromOSM(item)));
        return points.filter((value): value is LocationPointProperties => value !== null);
    }

    private async convertOverpassToLocations(data: { elements?: RawOverpassElement[] }): Promise<LocationPointProperties[]> {
        if (!Array.isArray(data.elements)) return [];
        const points = await Promise.all(data.elements.map((item) => this.createLocationFromOverpass(item)));
        return points.filter((value): value is LocationPointProperties => value !== null);
    }

    private async convertCustomToLocations(_data: unknown): Promise<LocationPointProperties[]> {
        return [];
    }

    private async createLocationFromOSM(osmData: RawNominatimLike): Promise<LocationPointProperties | null> {
        const lon = parseNumber(osmData.lon);
        const lat = parseNumber(osmData.lat);
        if (typeof lon !== 'number' || typeof lat !== 'number') return null;
        const type = mapType(osmData.type);
        const fetchedAt = Date.now();
        return buildOsmPointProperties(osmData, type, lat, lon, fetchedAt);
    }

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
        criteria?: LocationBuildFilterCriteria,
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
                const matchesCode = normalizedLocationCode ? normalizedCodes.includes(normalizedLocationCode) : false;
                const matchesName = normalizedLocationName ? normalizedNames.includes(normalizedLocationName) : false;
                if (!matchesCode && !matchesName) {
                    if (normalizedLocationCode || normalizedLocationName) return false;
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
            if (hasTypeFilter && !allowedTypes.includes(location.type as LocationType)) return false;
            if (!hasCountryFilter) return true;
            const normalizedLocationCode = location.admin0Code?.toUpperCase();
            const normalizedLocationName = location.admin0?.toLowerCase();
            const matchesCode = countryCode && normalizedLocationCode ? normalizedLocationCode === countryCode : false;
            const matchesName = countryName && normalizedLocationName ? normalizedLocationName === countryName : false;
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

    async getCountryNameMap(): Promise<Map<string, string>> {
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
}

function createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    return batches;
}

function abortError(message: string): Error {
    if (typeof DOMException === 'function') {
        return new DOMException(message, 'AbortError');
    }
    const error = new Error(message);
    (error as Error & { name: string }).name = 'AbortError';
    return error;
}
