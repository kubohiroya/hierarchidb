import type { NodeId } from '@hierarchidb/common-types';
import type { TabularDataResult } from '@hierarchidb/ui-tabular';
import type { LocationPointProperties } from '../../common/entities/LocationPoint.js';
import { replaceLocationPoints } from '../../services/pointRepository.js';
type ProgressReporter = (progress: {
  stage?: string;
  completed?: number;
  total?: number;
  updatedAt?: number;
}) => void;

const toNumber = (val: unknown): number | null => (typeof val === 'number' ? val : null);
const toStringVal = (val: unknown): string | undefined => (typeof val === 'string' ? val : undefined);

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
    const kind = featureCode ?? featureClass ?? 'poi';
    const gid0 = toStringVal(r.countryCode) ?? '';

    normalized.push({
      schemaVersion: 1,
      pid: crypto.randomUUID(),
      name,
      latitude: lat,
      longitude: lon,
      kind,
      gid0,
      payload: r,
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
