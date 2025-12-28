import type { NodeId } from '@hierarchidb/common-types';
import type {
  IdeGsmRouteError,
  LocationGroupItemData,
} from '@hierarchidb/plugin-service-api';
import {
  ROUTE_MODES,
  type RouteLineString,
  type RouteMode,
  type RoutePoint,
} from '@hierarchidb/route-store';
import type { LocationPointId, LocationQueryAPI } from '@hierarchidb/location-store';

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

type LocationLookup = Map<string, LocationGroupItemData & { id: NodeId }>;

export async function buildIdeGsmLocationIndex(
  api: LocationQueryAPI,
  nodeIds: NodeId[],
): Promise<LocationLookup> {
  const index = new Map<string, LocationGroupItemData & { id: NodeId }>();
  for (const nodeId of nodeIds) {
    const items = await api.listLocationGroups(nodeId);
    for (const item of items) {
      const data = item.data as LocationGroupItemData | undefined;
      if (!data?.name) continue;
      if (!index.has(data.name)) {
        index.set(data.name, { ...data, id: item.id as NodeId });
      }
    }
  }
  return index;
}

export function parseIdeGsmCsv(
  csvText: string,
  locationIndex: LocationLookup,
  nodeId: NodeId,
): { lineStrings: RouteLineString[]; errors: IdeGsmRouteError[] } {
  const rows = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) {
    return { lineStrings: [], errors: [] };
  }

  const header = rows[0]!.split(',').map((h) => h.trim());
  const headerIndex = createHeaderIndex(header);

  const lineStrings: RouteLineString[] = [];
  const errors: IdeGsmRouteError[] = [];

  for (let i = 1; i < rows.length; i++) {
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
          reason: !startLocation && !endLocation
            ? 'Start/End location not found'
            : !startLocation
              ? 'Start location not found'
              : 'End location not found',
        });
        continue;
      }

      const startPoint = buildRoutePoint(startLocation, parsed.country1, parsed.region1);
      const endPoint = buildRoutePoint(endLocation, parsed.country2, parsed.region2);
      const featureId = `${startPoint.pointId}+${endPoint.pointId}`;

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
  location: LocationGroupItemData & { id: NodeId },
  admin0Name?: string,
  admin1Name?: string,
): RoutePoint {
  const pointId = ((location as { pointId?: LocationPointId }).pointId
    ?? (location as { pid?: string }).pid
    ?? crypto.randomUUID()) as LocationPointId;
  return {
    coordinates: [location.longitude, location.latitude],
    admin0Name: admin0Name ?? location.countryName ?? location.countryCode ?? '',
    admin1Name: admin1Name ?? location.admin1 ?? location.admin1Code ?? '',
    admin2Name: location.admin2 ?? location.admin2Code,
    locationId: location.id,
    pointId,
    name: location.name ?? '',
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
  return value ? value : undefined;
}

function readNumber(cols: string[], index?: number): number | undefined {
  if (typeof index !== 'number') return undefined;
  const value = cols[index]?.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeMetadata(
  input: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === '') continue;
    const resolved = value as string | number | boolean;
    const parsed = typeof resolved === 'string' ? Number(resolved) : undefined;
    if (typeof resolved === 'string' && typeof parsed === 'number' && Number.isFinite(parsed)) {
      out[key] = parsed;
    } else {
      out[key] = resolved;
    }
  }
  return out;
}

function setMetadata(
  target: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | undefined,
): void {
  if (value === undefined || value === '') return;
  target[key] = value as string | number | boolean;
}
