import { ensureIso3166Data, getAllCountries, getCountry, resolveIso3166CsvUrl } from '@hierarchidb/gen-iso3166-2/browser';
import type { IdeGsmSelectionEntry, LocationFeatureProperties, LocationType } from './locationTypes.js';
import { buildLocationPointIdFromLatLon } from './locationPointId.js';
import { buildTileIdByZoom } from './morton.js';
import { parseCsvTable } from './csvUtils.js';

const DEFAULT_CSV_URL = resolveIso3166CsvUrl();

export type IdeGsmParseResult = {
  points: LocationFeatureProperties[];
  rowCount: number;
};

const normalizeMetadataValue = (value: unknown): string | number | null => {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const toLocationType = (name: string, isAdminCenter: boolean): LocationType => {
  if (isAdminCenter) return 'area_centroid';
  const trimmed = name.trim();
  if (trimmed.startsWith('Airport ')) return 'airport';
  if (trimmed.startsWith('Port ')) return 'port';
  if (trimmed.startsWith('Stn.')) return 'railway_station';
  return 'interchange';
};

type CountryEntry = { countryEn: string; alpha2: string; alpha3?: string };
type SubdivisionEntry = { code: string; subdivisionEn: string; subdivisionLocal: string };

let countryNameToCode: Map<string, string> | null = null;
const subdivisionCache = new Map<string, SubdivisionEntry[]>();

const normalizeCountryKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const COUNTRY_CODE_ALIASES = new Map<string, string>([
  ['日本', 'JP'],
  ['日本国', 'JP'],
]);

const normalizeHeaderKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const findHeaderIndex = (headers: string[], candidates: string[]): number => {
  const normalized = headers.map(normalizeHeaderKey);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(normalizeHeaderKey(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
};

const getCountryCodeByName = async (countryName?: string): Promise<string> => {
  if (!countryName) return '';
  const raw = countryName.trim();
  if (raw) {
    const alias = COUNTRY_CODE_ALIASES.get(raw) ?? COUNTRY_CODE_ALIASES.get(raw.toLowerCase());
    if (alias) return alias;
  }
  if (!countryNameToCode) {
    await ensureIso3166Data({ csvUrl: DEFAULT_CSV_URL });
    const countries = (await getAllCountries()) as CountryEntry[];
    countryNameToCode = new Map(
      countries.flatMap((country: CountryEntry) => {
        const entries: Array<[string, string]> = [];
        entries.push([normalizeCountryKey(country.countryEn), country.alpha2]);
        if (country.alpha2) entries.push([country.alpha2.toLowerCase(), country.alpha2]);
        if (country.alpha3) entries.push([country.alpha3.toLowerCase(), country.alpha2]);
        return entries;
      }),
    );
  }
  const normalized = normalizeCountryKey(countryName);
  if (!normalized) return '';
  return countryNameToCode.get(normalized) ?? '';
};

const normalizeAdminName = (value?: string) => value?.trim().toLowerCase() ?? '';

const resolveAdmin1Code = async (countryCode?: string, admin1?: string): Promise<string | undefined> => {
  const alpha2 = countryCode?.trim().toUpperCase();
  if (!alpha2 || !admin1) return undefined;
  if (!subdivisionCache.has(alpha2)) {
    const { subdivisions } = await getCountry(alpha2);
    const rows: SubdivisionEntry[] = subdivisions?.map((row: SubdivisionEntry) => ({
      code: row.code?.toUpperCase(),
      subdivisionEn: row.subdivisionEn ?? '',
      subdivisionLocal: row.subdivisionLocal ?? '',
    })) ?? [];
    subdivisionCache.set(alpha2, rows);
  }
  const normalized = normalizeAdminName(admin1);
  if (!normalized) return undefined;
  const rows = subdivisionCache.get(alpha2) ?? [];
  const match = rows.find((row: SubdivisionEntry) => {
    const en = normalizeAdminName(row.subdivisionEn);
    const local = normalizeAdminName(row.subdivisionLocal);
    return en === normalized || local === normalized;
  });
  return match?.code;
};

export const parseIdeGsmCsv = async (csvText: string): Promise<IdeGsmParseResult> => {
  const points: LocationFeatureProperties[] = [];
  const { headers, rows } = parseCsvTable(csvText, { delimiter: ',', hasHeader: true });
  const nameIndex = findHeaderIndex(headers, ['name', 'location', 'place']);
  const latIndex = findHeaderIndex(headers, ['lat', 'latitude']);
  const lonIndex = findHeaderIndex(headers, ['lon', 'lng', 'longitude', 'long']);
  const countryIndex = findHeaderIndex(headers, [
    'country',
    'countryname',
    'admin0',
    'admin0name',
  ]);
  const admin1Index = findHeaderIndex(headers, [
    'admin1',
    'admin1name',
    'region',
    'state',
    'province',
  ]);
  const adminCenterIndex = findHeaderIndex(headers, [
    'admincenter',
    'admincenterflag',
    'admin_center',
    'isadmincenter',
    'isadmin',
  ]);
  const countryCodeIndex = findHeaderIndex(headers, [
    'countrycode',
    'country_code',
    'iso2',
    'alpha2',
    'iso3',
    'alpha3',
  ]);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) continue;
    const name = row?.[nameIndex >= 0 ? nameIndex : 0]?.trim() ?? '';
    const lat = Number(row?.[latIndex >= 0 ? latIndex : 1]);
    const lon = Number(row?.[lonIndex >= 0 ? lonIndex : 2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const admin0Name =
      row[countryIndex >= 0 ? countryIndex : 3]?.trim() || undefined;
    const admin1Name =
      row[admin1Index >= 0 ? admin1Index : 4]?.trim() || undefined;
    const adminCenterFlag = row[adminCenterIndex >= 0 ? adminCenterIndex : 5]?.trim() ?? '0';
    const isAdminCenter = adminCenterFlag === '1';
    const type = toLocationType(name, isAdminCenter);
    const rawCountryCode =
      row[countryCodeIndex >= 0 ? countryCodeIndex : -1]?.trim() || undefined;
    const normalizedCode = rawCountryCode
      ? rawCountryCode.trim().toUpperCase()
      : undefined;
    const metadata = headers.reduce<Record<string, string | number | null>>((acc, header, colIdx) => {
      if (colIdx < 6) return acc;
      const key = header?.trim();
      if (!key) return acc;
      const value = normalizeMetadataValue(row[colIdx]);
      acc[key] = value;
      return acc;
    }, {});

    points.push({
      schemaVersion: 2,
      pointId: await buildLocationPointIdFromLatLon(lat, lon),
      name: name || `IDE-GSM ${index + 1}`,
      latitude: lat,
      longitude: lon,
      type,
      ...buildTileIdByZoom(lon, lat),
      admin0Name,
      admin1Name,
      admin0Code: normalizedCode?.length === 2 ? normalizedCode : undefined,
      metadata,
    });
  }

  if (!points.length) return { points, rowCount: rows.length };
  const countryCodeCache = new Map<string, string>();
  for (const point of points) {
    if (point.admin0Code) {
      const normalized = point.admin0Code.toUpperCase();
      point.admin0Code = normalized;
    }
    const key = point.admin0Name ?? '';
    if (key) {
      if (!countryCodeCache.has(key)) {
        countryCodeCache.set(key, await getCountryCodeByName(key));
      }
      point.admin0Code = countryCodeCache.get(key) ?? '';
    }
    if (point.admin1Code) {
      point.admin1Code = await resolveAdmin1Code(point.admin0Code, point.admin1Code);
    }
  }

  return { points, rowCount: rows.length };
};

export const filterIdeGsmPointsBySelection = (
  points: LocationFeatureProperties[],
  entries: IdeGsmSelectionEntry[],
): LocationFeatureProperties[] => {
  if (entries.length === 0) return points;
  const countrySet = new Set(entries.map((entry) => entry.countryCode));
  const countryNameSet = new Set(entries.map((entry) => entry.countryName.toLowerCase()));
  const typeSet = new Set(entries.flatMap((entry) => entry.types));
  return points.filter((point) => {
    const normalizedCode = point.admin0Code?.toUpperCase();
    const normalizedName = point.admin0Name?.toLowerCase();
    const matchesCountry =
      (!normalizedCode && !normalizedName)
      || (normalizedCode && countrySet.has(normalizedCode))
      || (normalizedName && countryNameSet.has(normalizedName));
    const matchesType = typeSet.size === 0 || typeSet.has(point.type as LocationType);
    return matchesCountry && matchesType;
  });
};
