import type { NodeId } from '@hierarchidb/common-types';
import type { RouteLineString, RouteMode, RoutePoint } from './routeTypes.js';
import { ROUTE_MODES } from './routeTypes.js';

export type IdeGsmRouteError = {
  id: string;
  rowNumber: number;
  start: string;
  end: string;
  reason: string;
};

export type IdeGsmCsvError = IdeGsmRouteError;

export type IdeGsmLocationRecord = {
  id: NodeId;
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

export function parseIdeGsmRouteCsv(
  csvText: string,
  locationIndex: Map<string, IdeGsmLocationRecord>,
  nodeId: NodeId
): { lineStrings: RouteLineString[]; errors: IdeGsmRouteError[] } {
  const rows = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) {
    return { lineStrings: [], errors: [] };
  }

  const header = rows[0]!.split(',').map((h) => h.trim());
  const headerIndex = createHeaderIndex(header);

  const lineStrings: RouteLineString[] = [];
  const errors: IdeGsmRouteError[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const raw = rows[i]!;
    const cols = splitCsvLine(raw);
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
      const featureId = `${startPoint.pointId ?? startLocation.id}+${endPoint.pointId ?? endLocation.id}`;

      const now = Date.now();
      const lineString: RouteLineString = {
        id: crypto.randomUUID() as NodeId,
        nodeId,
        type: 'route-line-string',
        version: 1,
        createdAt: now,
        updatedAt: now,
        name: parsed.name,
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
    admin1Name: admin1Name ?? location.admin1Name ?? location.admin1Code ?? '',
    admin2Name: location.admin2Name ?? location.admin2Code,
    locationId: location.id,
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
