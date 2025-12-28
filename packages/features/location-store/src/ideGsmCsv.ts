import { generateId } from '@hierarchidb/util';
import { ensureIso3166Data, getAllCountries, getCountry } from '@hierarchidb/gen-iso3166-2/browser';
import type { IdeGsmSelectionEntry } from '@hierarchidb/plugin-service-api';
import type { LocationPointId, LocationPointProperties, LocationType } from './index.js';
import { parseCsvTable } from './csvUtils.js';

const DEFAULT_CSV_URL = '/iso3166-2-level1.csv';

export type IdeGsmParseResult = {
  points: LocationPointProperties[];
  rowCount: number;
};

const toPointId = (): LocationPointId => generateId() as LocationPointId;

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

const toLocationKind = (name: string, isAdminCenter: boolean): LocationType => {
  if (isAdminCenter) return 'area_centroid';
  const trimmed = name.trim();
  if (trimmed.startsWith('Airport ')) return 'airport';
  if (trimmed.startsWith('Port ')) return 'port';
  if (trimmed.startsWith('Stn.')) return 'railway_station';
  return 'interchange';
};

let countryNameToCode: Map<string, string> | null = null;
const subdivisionCache = new Map<string, { code: string; subdivisionEn: string; subdivisionLocal: string }[]>();

const getCountryCodeByName = async (countryName?: string): Promise<string> => {
  if (!countryName) return '';
  if (!countryNameToCode) {
    await ensureIso3166Data({ csvUrl: DEFAULT_CSV_URL });
    const countries = await getAllCountries();
    countryNameToCode = new Map(
      countries.map((country) => [country.countryEn.toLowerCase(), country.alpha2]),
    );
  }
  return countryNameToCode.get(countryName.toLowerCase()) ?? '';
};

const normalizeAdminName = (value?: string) => value?.trim().toLowerCase() ?? '';

const resolveAdmin1Code = async (countryCode?: string, admin1?: string): Promise<string | undefined> => {
  const alpha2 = countryCode?.trim().toUpperCase();
  if (!alpha2 || !admin1) return undefined;
  if (!subdivisionCache.has(alpha2)) {
    const { subdivisions } = await getCountry(alpha2);
    const rows = subdivisions?.map((row) => ({
      code: row.code?.toUpperCase(),
      subdivisionEn: row.subdivisionEn ?? '',
      subdivisionLocal: row.subdivisionLocal ?? '',
    })) ?? [];
    subdivisionCache.set(alpha2, rows);
  }
  const normalized = normalizeAdminName(admin1);
  if (!normalized) return undefined;
  const rows = subdivisionCache.get(alpha2) ?? [];
  const match = rows.find((row) => {
    const en = normalizeAdminName(row.subdivisionEn);
    const local = normalizeAdminName(row.subdivisionLocal);
    return en === normalized || local === normalized;
  });
  return match?.code;
};

export const parseIdeGsmCsv = async (csvText: string): Promise<IdeGsmParseResult> => {
  const points: LocationPointProperties[] = [];
  const { headers, rows } = parseCsvTable(csvText, { delimiter: ',', hasHeader: true });
  rows.forEach((row, index) => {
    const name = row[0]?.trim() ?? '';
    const lat = Number(row[1]);
    const lon = Number(row[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const admin1 = row[3]?.trim() || undefined;
    const countryName = row[4]?.trim() || undefined;
    const adminCenterFlag = row[5]?.trim() ?? '0';
    const isAdminCenter = adminCenterFlag === '1';
    const kind = toLocationKind(name, isAdminCenter);
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
      pointId: toPointId(),
      name: name || `IDE-GSM ${index + 1}`,
      latitude: lat,
      longitude: lon,
      kind,
      countryCode: '',
      countryName,
      admin1,
      admin2: undefined,
      metadata,
    });
  });

  if (!points.length) return { points, rowCount: rows.length };
  const countryCodeCache = new Map<string, string>();
  for (const point of points) {
    const key = point.countryName ?? '';
    if (key) {
      if (!countryCodeCache.has(key)) {
        countryCodeCache.set(key, await getCountryCodeByName(key));
      }
      point.countryCode = countryCodeCache.get(key) ?? '';
    }
    if (point.admin1) {
      point.admin1Code = await resolveAdmin1Code(point.countryCode, point.admin1);
    }
  }

  return { points, rowCount: rows.length };
};

export const filterIdeGsmPointsBySelection = (
  points: LocationPointProperties[],
  entries: IdeGsmSelectionEntry[],
): LocationPointProperties[] => {
  if (entries.length === 0) return points;
  const countrySet = new Set(entries.map((entry) => entry.countryCode));
  const countryNameSet = new Set(entries.map((entry) => entry.countryName.toLowerCase()));
  const typeSet = new Set(entries.flatMap((entry) => entry.types));
  return points.filter((point) => {
    const normalizedCode = point.countryCode?.toUpperCase();
    const normalizedName = point.countryName?.toLowerCase();
    const matchesCountry =
      (!normalizedCode && !normalizedName)
      || (normalizedCode && countrySet.has(normalizedCode))
      || (normalizedName && countryNameSet.has(normalizedName));
    const matchesType = typeSet.size === 0 || typeSet.has(point.kind as LocationType);
    return matchesCountry && matchesType;
  });
};
