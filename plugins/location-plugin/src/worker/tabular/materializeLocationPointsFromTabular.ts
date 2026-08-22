import type { NodeId } from '@hierarchidb/core-types';
import { buildLocationPointIdFromLatLon, buildTileIdByZoom } from '@hierarchidb/location-store';
import type { TabularDataResult } from '@hierarchidb/ui-tabular';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import { replaceLocationPoints } from '~/services/pointRepository';

type ProgressReporter = (progress: {
  stage?: string;
  completed?: number;
  total?: number;
  updatedAt?: number;
}) => void;

const toNumber = (val: unknown): number | null => (typeof val === 'number' ? val : null);
const toStringVal = (val: unknown): string | undefined =>
  typeof val === 'string' ? val : undefined;
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
const toMetadata = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, normalizeMetadataValue(v)]));

export async function materializeLocationPointsFromTabular(
  nodeId: NodeId,
  rows: TabularDataResult,
  reportProgress?: ProgressReporter
): Promise<void> {
  const normalized: LocationPointProperties[] = [];
  const total = rows.rows.length || 1;
  let processed = 0;
  for (const row of rows.rows) {
    const r = row as Record<string, unknown>;
    const lat = toNumber(r.lat) ?? toNumber(r.latitude);
    const lon = toNumber(r.lon) ?? toNumber(r.longitude);
    const name = toStringVal(r.name);
    if (lat === null || lon === null || !name) continue;

    const featureClass = toStringVal(r.featureClass);
    const featureCode = toStringVal(r.featureCode);
    const type = featureCode ?? featureClass ?? 'poi';
    const admin0Code = toStringVal(r.admin0Code) ?? toStringVal(r.countryCode) ?? '';
    const admin1 = toStringVal(r.admin1) ?? toStringVal(r.adminCode1);
    const admin2 = toStringVal(r.admin2) ?? toStringVal(r.adminCode2);
    const admin0 =
      toStringVal(r.admin0) ??
      toStringVal(r.admin0Name) ??
      toStringVal(r.countryName) ??
      toStringVal(r.country);

    normalized.push({
      schemaVersion: 2,
      pointId: await buildLocationPointIdFromLatLon(lat, lon),
      name,
      latitude: lat,
      longitude: lon,
      type,
      admin0Code,
      admin0,
      admin1,
      admin2,
      ...buildTileIdByZoom(lon, lat),
      metadata: toMetadata(r),
    });
    processed += 1;
    if (reportProgress && processed % 50 === 0) {
      reportProgress({
        stage: 'materialize-location',
        completed: processed,
        total,
        updatedAt: Date.now(),
      });
    }
  }

  await replaceLocationPoints(nodeId, normalized);
  if (reportProgress) {
    reportProgress({
      stage: 'materialize-location',
      completed: normalized.length,
      total: total,
      updatedAt: Date.now(),
    });
  }
}
