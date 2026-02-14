import type { NodeId } from '@hierarchidb/core-types';
import type { LocationFeatureId } from '@hierarchidb/location-api';
import type { RouteLineString, RouteMode, RoutePoint } from './routeTypes.js';
import { ROUTE_MODES } from './routeTypes.js';
import type { IdeGsmRouteSelectionEntry } from './ideGsmRouteTypes.js';

export type IdeGsmRouteError = {
  id: string;
  rowNumber: number;
  start: string;
  end: string;
  reason: string;
};

export type IdeGsmCsvError = IdeGsmRouteError;

export type IdeGsmLocationRecord = {
  locationFeatureId: LocationFeatureId;
  locationNodeId: NodeId;
  name: string;
  latitude: number;
  longitude: number;
  pointId?: string;
  admin0Name?: string;
  admin1Name?: string;
  admin2Name?: string;
  admin0Code?: string;
  admin1Code?: string;
  admin2Code?: string;
};

const IDE_GSM_HEADERS = [
  'Start',
  'End',
  'Name',
  'Distance',
  'Speed',
  'Border',
  'Overhead',
  'Loading',
  'Mode',
  'Quality',
  'Oneway',
  'Freight',
  'Country1',
  'Region1',
  'Country2',
  'Region2',
] as const;

type IdeGsmRow = {
  start: string;
  end: string;
  name: string;
  distance?: number;
  speed?: number;
  mode: RouteMode;
  country1?: string;
  region1?: string;
  country2?: string;
  region2?: string;
  metadata: Record<string, string | number | boolean>;
};

type TabularRowRecord = Record<string, unknown>;

const buildRowValues = (headers: string[], row: TabularRowRecord): string[] =>
  headers.map((header) => {
    const value = row[header];
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  });

export function parseIdeGsmRouteTable(
  headers: string[],
  rows: string[][],
  locationIndex: Map<string, IdeGsmLocationRecord>,
  nodeId: NodeId
): { lineStrings: RouteLineString[]; errors: IdeGsmRouteError[] } {
  if (rows.length === 0) {
    return { lineStrings: [], errors: [] };
  }

  const headerIndex = createHeaderIndex(headers);

  const lineStrings: RouteLineString[] = [];
  const errors: IdeGsmRouteError[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const cols = rows[i];
    if (!cols) continue;
    const rowNumber = i + 1;
    try {
      const parsed = parseIdeGsmRow(cols, headerIndex);
      const startLocation = locationIndex.get(parsed.start);
      const endLocation = locationIndex.get(parsed.end);
      if (!startLocation || !endLocation) {
        errors.push({
          id: `row-${rowNumber}`,
          rowNumber,
          start: parsed.start,
          end: parsed.end,
          reason:
            !startLocation && !endLocation
              ? 'Start/End location not found'
              : !startLocation
                ? 'Start location not found'
                : 'End location not found',
        });
        continue;
      }

      const startPoint = buildRoutePoint(startLocation, parsed.country1, parsed.region1);
      const endPoint = buildRoutePoint(endLocation, parsed.country2, parsed.region2);
      const featureId = `${startPoint.pointId ?? startLocation.locationFeatureId}+${
        endPoint.pointId ?? endLocation.locationFeatureId
      }`;

      const now = Date.now();
      const lineString: RouteLineString = {
        id: crypto.randomUUID() as NodeId,
        nodeId,
        type: 'route-line-string',
        version: 1,
        createdAt: now,
        updatedAt: now,
        name: parsed.name,
        startLocationId: startLocation.locationNodeId,
        endLocationId: endLocation.locationNodeId,
        startPoint,
        endPoint,
        featureId,
        routeMode: parsed.mode,
        distance: parsed.distance,
        speed: parsed.speed,
        metadata: parsed.metadata,
      };
      lineStrings.push(lineString);
    } catch (error) {
      errors.push({
        id: `row-${rowNumber}`,
        rowNumber,
        start: '',
        end: '',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { lineStrings, errors };
}

export function parseIdeGsmRouteRecords(
  headers: string[],
  rows: TabularRowRecord[],
  locationIndex: Map<string, IdeGsmLocationRecord>,
  nodeId: NodeId
): { lineStrings: RouteLineString[]; errors: IdeGsmRouteError[] } {
  const normalizedHeaders = headers.map((header) => header.trim()).filter((header) => header.length > 0);
  if (normalizedHeaders.length === 0) {
    return { lineStrings: [], errors: [] };
  }
  const values = rows.map((row) => buildRowValues(normalizedHeaders, row));
  return parseIdeGsmRouteTable(normalizedHeaders, values, locationIndex, nodeId);
}

export function parseIdeGsmRouteCsv(
  csvText: string,
  locationIndex: Map<string, IdeGsmLocationRecord>,
  nodeId: NodeId
): { lineStrings: RouteLineString[]; errors: IdeGsmRouteError[] } {
  const rows = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) {
    return { lineStrings: [], errors: [] };
  }

  const header = rows[0]?.split(',').map((h) => h.trim()) ?? [];
  const body = rows.slice(1).map((row) => splitCsvLine(row));
  return parseIdeGsmRouteTable(header, body, locationIndex, nodeId);
}

function createHeaderIndex(header: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  const normalized = header.map((h) => h.trim());
  for (const expected of IDE_GSM_HEADERS) {
    const found = normalized.findIndex((h) => h.toLowerCase() === expected.toLowerCase());
    if (found < 0) {
      throw new Error(`IDE-GSM header missing: ${expected}`);
    }
    index[expected] = found;
  }
  return index;
}

function parseIdeGsmRow(cols: string[], index: Record<string, number>): IdeGsmRow {
  const start = readString(cols, index.Start);
  const end = readString(cols, index.End);
  const name = readString(cols, index.Name);
  const distance = readNumber(cols, index.Distance);
  const speed = readNumber(cols, index.Speed);
  const modeRaw = readString(cols, index.Mode);
  const mode = mapMode(modeRaw);

  const metadata: Record<string, string | number | boolean> = {};
  setMetadata(metadata, 'border', readOptional(cols, index.Border));
  setMetadata(metadata, 'overhead', readOptional(cols, index.Overhead));
  setMetadata(metadata, 'loading', readOptional(cols, index.Loading));
  setMetadata(metadata, 'quality', readOptional(cols, index.Quality));
  setMetadata(metadata, 'oneway', readOptional(cols, index.Oneway));
  setMetadata(metadata, 'freight', readOptional(cols, index.Freight));

  return {
    start,
    end,
    name,
    distance,
    speed,
    mode,
    country1: readOptional(cols, index.Country1),
    region1: readOptional(cols, index.Region1),
    country2: readOptional(cols, index.Country2),
    region2: readOptional(cols, index.Region2),
    metadata: normalizeMetadata(metadata),
  };
}

function buildRoutePoint(
  location: IdeGsmLocationRecord,
  admin0Name?: string,
  admin1Name?: string
): RoutePoint {
  const pointId = location.pointId ?? crypto.randomUUID();
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    admin0Name: admin0Name ?? location.admin0Name ?? location.admin0Code ?? '',
    admin0Code: location.admin0Code,
    admin1Name: admin1Name ?? location.admin1Name ?? location.admin1Code ?? '',
    admin1Code: location.admin1Code,
    admin2Name: location.admin2Name ?? location.admin2Code,
    admin2Code: location.admin2Code,
    locationFeatureId: location.locationFeatureId,
    locationId: location.locationNodeId,
    pointId,
    name: location.name ?? '',
    locationName: location.name ?? '',
  };
}

function mapMode(raw: string): RouteMode {
  const value = Number(raw);
  switch (value) {
    case 0:
      return ROUTE_MODES.ROAD;
    case 1:
      return ROUTE_MODES.WATERWAY;
    case 2:
      return ROUTE_MODES.AIRWAY;
    case 3:
      return ROUTE_MODES.RAILWAY;
    case 4:
      return ROUTE_MODES.H_RAILWAY;
    default:
      throw new Error(`Unsupported mode: ${raw}`);
  }
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map((v) => v.trim());
}

function readString(cols: string[], index?: number): string {
  if (typeof index !== 'number') {
    throw new Error('Required column is missing');
  }
  const value = cols[index]?.trim() ?? '';
  if (!value) {
    throw new Error('Required field is empty');
  }
  return value;
}

function readOptional(cols: string[], index?: number): string | undefined {
  if (typeof index !== 'number') return undefined;
  const value = cols[index]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readNumber(cols: string[], index?: number): number | undefined {
  const value = readOptional(cols, index);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function setMetadata(
  metadata: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | undefined
): void {
  if (value === undefined) return;
  metadata[key] = value;
}

function normalizeMetadata(
  metadata: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const normalized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) continue;
      const numeric = Number(trimmed);
      normalized[key] = Number.isFinite(numeric) ? numeric : trimmed;
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

const normalizeCountryCode = (value?: string): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

export const filterIdeGsmRoutesBySelection = (
  lineStrings: RouteLineString[],
  entries: IdeGsmRouteSelectionEntry[],
): RouteLineString[] => {
  if (entries.length === 0) return lineStrings;
  const selectionByCountry = new Map<string, { orModes: Set<RouteMode>; andModes: Set<RouteMode> }>();
  entries.forEach((entry) => {
    const countryCode = normalizeCountryCode(entry.countryCode);
    if (!countryCode) return;
    const existing = selectionByCountry.get(countryCode) ?? {
      orModes: new Set<RouteMode>(),
      andModes: new Set<RouteMode>(),
    };
    entry.orModes.forEach((mode) => existing.orModes.add(mode));
    entry.andModes.forEach((mode) => existing.andModes.add(mode));
    selectionByCountry.set(countryCode, existing);
  });
  if (selectionByCountry.size === 0) return lineStrings;

  return lineStrings.filter((line) => {
    const mode = line.routeMode;
    const startCountry = normalizeCountryCode(line.startPoint?.admin0Code);
    const endCountry = normalizeCountryCode(line.endPoint?.admin0Code);
    const matchedOr = [startCountry, endCountry]
      .filter((country): country is string => Boolean(country))
      .some((country) => {
        const selection = selectionByCountry.get(country);
        return Boolean(selection && selection.orModes.has(mode));
      });
    if (matchedOr) return true;
    if (!startCountry || !endCountry || startCountry !== endCountry) return false;
    const selection = selectionByCountry.get(startCountry);
    return Boolean(selection && selection.andModes.has(mode));
  });
};
