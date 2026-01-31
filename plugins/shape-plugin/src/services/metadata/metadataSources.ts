import {
  buildShapeCacheKey,
  createShapeChunkStoreWithNetworkPort,
  createShapeNetworkPort,
  jsonDeserializer,
  jsonSerializer,
  textDeserializer,
  textSerializer,
} from '../utils/chunkStore.js';
import type { CountryMetadata } from '../../common/types/index.js';
import {
  DEFAULT_ISO3166_CSV_URL,
  type ContinentCode,
  normalizeCountryCodeFormat,
  resolveCountryContinentCode,
  resolveCountryContinentName,
} from '../utils/iso3166.js';
import type { NodeId } from '@hierarchidb/core-types';
import { GEOBOUNDARIES_ALL_METADATA_URL } from '../utils/geoboundariesEndpoints.js';

type GeoBoundariesRecord = Record<string, unknown>;

const isOffline = (): boolean => (
  typeof navigator !== 'undefined' && navigator.onLine === false
);

const GADM_MAPS_URL = 'https://gadm.org/maps.html';

const parseAdminLevel = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const admMatch = text.match(/ADM\s*([0-6])/i);
  if (admMatch?.[1]) return Number.parseInt(admMatch[1], 10);
  const levelMatch = text.match(/level\s*-?\s*(\d+)/i);
  if (levelMatch?.[1]) return Number.parseInt(levelMatch[1], 10);
  return null;
};

const readFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const determineDataQuality = (levels: number[]): 'high' | 'medium' | 'low' => {
  const count = levels.length;
  if (count >= 4) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
};

const decodeHtmlEntities = (value: string): string => (
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
);

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const parseGeoBoundariesItems = (payload: unknown): GeoBoundariesRecord[] => {
  if (Array.isArray(payload)) return payload as GeoBoundariesRecord[];
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as GeoBoundariesRecord[];
  }
  return [];
};

const resolveGeoBoundariesContinent = (
  rawContinent: string,
  resolvedContinentCode: ContinentCode,
  resolvedContinentName: string,
): string => {
  if (resolvedContinentCode !== 'XX') return resolvedContinentName;
  const trimmed = rawContinent.trim();
  if (trimmed) return trimmed;
  return 'N/A';
};

export async function fetchGeoBoundariesMetadata(nodeId: NodeId): Promise<CountryMetadata[]> {
  const store = createShapeChunkStoreWithNetworkPort(
    jsonSerializer,
    jsonDeserializer,
    createShapeNetworkPort(),
  );
  const cacheKey = buildShapeCacheKey('geoboundaries:metadata:all', GEOBOUNDARIES_ALL_METADATA_URL);
  const entry = isOffline()
    ? await store.get(cacheKey)
    : await store.getOrFetchForNode(nodeId, GEOBOUNDARIES_ALL_METADATA_URL, {
      accept: 'application/json',
      cacheKey,
    });
  if (!entry) {
    throw new Error('Offline: geoboundaries metadata cache is missing.');
  }

  const items = parseGeoBoundariesItems(entry.value);
  const entries = new Map<string, { iso3: string; name?: string; continent?: string; levels: Set<number> }>();

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as GeoBoundariesRecord;
    const iso3 = readFirstString(record, [
      'boundaryISO',
      'iso3',
      'ISO3',
      'countryCode',
      'countryISO',
      'shapeISO',
    ]);
    if (!iso3) continue;
    const level = parseAdminLevel(readFirstString(record, [
      'boundaryType',
      'boundaryLevel',
      'adm',
      'ADM',
    ]));
    const name = readFirstString(record, [
      'boundaryName',
      'shapeName',
      'countryName',
      'name',
      'shapeGroup',
    ]);
    const continent = readFirstString(record, [
      'Continent',
      'continent',
    ]);
    const key = iso3.toUpperCase();
    const entry = entries.get(key) ?? { iso3: key, levels: new Set<number>() };
    if (name && !entry.name) entry.name = name;
    if (continent && !entry.continent) entry.continent = continent;
    if (typeof level === 'number') entry.levels.add(level);
    entries.set(key, entry);
  }

  const results: CountryMetadata[] = [];
  // let missingContinentCount = 0;
  const missingSamples: Array<{ iso2?: string; iso3: string; metadata: string | null }> = [];
  for (const entry of entries.values()) {
    const iso2 = await normalizeCountryCodeFormat(entry.iso3, 'iso2', {
      csvUrl: DEFAULT_ISO3166_CSV_URL,
    });
    const normalizedIso2 = iso2.length === 2 ? iso2 : undefined;
    const levels = Array.from(entry.levels).sort((a, b) => a - b);
    const fallbackContinent = await resolveCountryContinentName(normalizedIso2 ?? entry.iso3, {
      csvUrl: DEFAULT_ISO3166_CSV_URL,
    });
    const resolvedContinentCode = await resolveCountryContinentCode(normalizedIso2 ?? entry.iso3, {
      csvUrl: DEFAULT_ISO3166_CSV_URL,
    });
    const rawContinent = (entry.continent ?? '').trim();
    const resolvedContinent = resolveGeoBoundariesContinent(rawContinent, resolvedContinentCode, fallbackContinent);
    if (!rawContinent && resolvedContinentCode === 'XX') {
      // missingContinentCount += 1;
      if (missingSamples.length < 5) {
        missingSamples.push({ iso2: normalizedIso2, iso3: entry.iso3, metadata: rawContinent || null });
      }
    }
    results.push({
      countryCode: normalizedIso2 ?? entry.iso3,
      countryName: entry.name ?? entry.iso3,
      continent: resolvedContinent,
      availableAdminLevels: levels,
      iso2: normalizedIso2,
      iso3: entry.iso3,
      dataQuality: determineDataQuality(levels),
    });
  }
  return results;
}


type GadmCountryEntry = {
  iso3: string;
  name: string;
  url: string;
};

const parseGadmCountryEntries = (html: string): GadmCountryEntry[] => {
  const entries = new Map<string, GadmCountryEntry>();
  const linkRegex = /<a\s+[^>]*href="([^"]*maps\/([A-Za-z]{3})\.html[^"]*)"[^>]*>(.*?)<\/a>/gi;

  // Biome: avoid assignment inside expressions.
  let match: RegExpExecArray | null = linkRegex.exec(html);
  while (match !== null) {
    const href = match[1];
    const iso3 = match[2]?.toUpperCase();
    const rawName = match[3]?.replace(/<[^>]+>/g, '') ?? '';
    if (iso3 && href) {
      const name = normalizeWhitespace(decodeHtmlEntities(rawName)) || iso3;
      const url = new URL(href, 'https://gadm.org/').toString();
      if (!entries.has(iso3)) {
        entries.set(iso3, { iso3, name, url });
      }
    }

    match = linkRegex.exec(html);
  }
  return Array.from(entries.values());
};

const parseGadmLevelsFromHtml = (html: string): number[] => {
  const lower = html.toLowerCase();
  const idx = lower.indexOf('geojson');
  if (idx < 0) return [];
  const window = html.slice(idx, idx + 400);
  const matches = window.matchAll(/level\s*-?\s*(\d+)/gi);
  const levels = new Set<number>();
  for (const match of matches) {
    const value = Number.parseInt(match[1] ?? '', 10);
    if (Number.isFinite(value)) levels.add(value);
  }
  return Array.from(levels).sort((a, b) => a - b);
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(mapper));
    results.push(...chunkResults);
  }
  return results;
};

export async function fetchGadmMetadata(nodeId: NodeId): Promise<CountryMetadata[]> {
  const store = createShapeChunkStoreWithNetworkPort(
    textSerializer,
    textDeserializer,
    createShapeNetworkPort(),
  );
  const htmlEntry = await store.getOrFetchForNode(nodeId, GADM_MAPS_URL, {
    accept: 'text/html',
    cacheKey: buildShapeCacheKey('gadm:maps', GADM_MAPS_URL),
  });
  const html = htmlEntry.value;
  const entries = parseGadmCountryEntries(html);
  if (entries.length === 0) {
    throw new Error('GADM maps page did not include country entries.');
  }

  let gadmMissingCount = 0;
  const gadmMissingSamples: Array<{ iso3: string; metadata: string | null }> = [];
  const results = await mapWithConcurrency<GadmCountryEntry, CountryMetadata | undefined>(entries, 6, async (entry) => {
    try {
      const countryEntry = await store.getOrFetchForNode(nodeId, entry.url, {
        accept: 'text/html',
        cacheKey: buildShapeCacheKey(`gadm:country:${entry.iso3}`, entry.url),
      });
      const countryHtml = countryEntry.value;
      const levels = parseGadmLevelsFromHtml(countryHtml);
      const iso2 = await normalizeCountryCodeFormat(entry.iso3, 'iso2', {
        csvUrl: DEFAULT_ISO3166_CSV_URL,
      });
      const normalizedIso2 = iso2.length === 2 ? iso2 : undefined;
      const continent = await resolveCountryContinentName(normalizedIso2 ?? entry.iso3, {
        csvUrl: DEFAULT_ISO3166_CSV_URL,
      });

      // CountryMetadata.countryCode は ISO2 必須。
      if (!normalizedIso2) return undefined;

      gadmMissingCount += 1;
      if (gadmMissingSamples.length < 5) {
        gadmMissingSamples.push({ iso3: entry.iso3, metadata: null });
      }

      return {
        countryCode: normalizedIso2,
        countryName: entry.name,
        continent,
        availableAdminLevels: levels,
        iso2: normalizedIso2,
        iso3: entry.iso3,
        dataQuality: determineDataQuality(levels),
      } satisfies CountryMetadata;
    } catch (error) {
      console.warn('[MetadataLoader] failed to parse GADM levels', {
        iso3: entry.iso3,
        url: entry.url,
        error,
      });
      const iso2 = await normalizeCountryCodeFormat(entry.iso3, 'iso2', {
        csvUrl: DEFAULT_ISO3166_CSV_URL,
      });
      const normalizedIso2 = iso2.length === 2 ? iso2 : undefined;
      const continent = await resolveCountryContinentName(normalizedIso2 ?? entry.iso3, {
        csvUrl: DEFAULT_ISO3166_CSV_URL,
      });

      if (!normalizedIso2) return undefined;

      gadmMissingCount += 1;
      if (gadmMissingSamples.length < 5) {
        gadmMissingSamples.push({ iso3: entry.iso3, metadata: null });
      }

      return {
        countryCode: normalizedIso2,
        countryName: entry.name,
        continent,
        availableAdminLevels: [],
        iso2: normalizedIso2,
        iso3: entry.iso3,
        dataQuality: 'low',
      } satisfies CountryMetadata;
    }
  });

  // 変換できなかった行は除外（型も揃える）
  const filtered = results.filter((v): v is CountryMetadata => v != null);
  if (gadmMissingCount > 0) {
    console.warn('[shape-plugin][gadm] continent metadata missing (fallback to ISO3166)', {
      missing: gadmMissingCount,
      missingSamples: gadmMissingSamples,
    });
  }
  return filtered;
}

export async function fetchNaturalEarthMetadata(_nodeId: NodeId): Promise<CountryMetadata[]> {
  return [{
    countryCode: 'WW',
    countryName: 'Worldwide',
    continent: 'N/A',
    availableAdminLevels: [0, 1],
    iso2: 'WW',
    dataQuality: 'medium',
  }];
}
