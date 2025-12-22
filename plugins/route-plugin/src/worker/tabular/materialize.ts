import type { NodeId } from '@hierarchidb/common-types';
import type { TabularDataResult } from '@hierarchidb/ui-tabular';
import { RouteDatabase } from '../../services/database/RouteDatabase.js';
import type { RouteEntity } from '../../common/entities/RouteEntity.js';
import type { ProgressReporter } from '@hierarchidb/plugin-service-api';

const toNumber = (val: unknown): number | null => (typeof val === 'number' ? val : null);
const toStringVal = (val: unknown): string | undefined => (typeof val === 'string' ? val : undefined);

export async function materializeRouteSegmentsFromTabular(
  nodeId: NodeId,
  rows: TabularDataResult,
  reportProgress?: ProgressReporter
): Promise<void> {
  const db = new RouteDatabase();
  await db.open();
  const now = Date.now();

  const segments = rows.rows
    .map((row) => row as Record<string, unknown>)
    .map((r, idx) => {
      const lat = toNumber(r.lat) ?? toNumber(r.latitude);
      const lon = toNumber(r.lon) ?? toNumber(r.longitude);
      if (lat === null || lon === null) return null;
      const seq = toNumber(r.seq) ?? idx;
      const name = toStringVal(r.name) ?? `Segment ${seq}`;
      return { seq, lat, lon, name, payload: r };
    })
    .filter((x): x is { seq: number; lat: number; lon: number; name: string; payload: Record<string, unknown> } => Boolean(x));

  const lineGeometry = segments.map((s) => [s.lon, s.lat] as [number, number]);
  const updated: Partial<RouteEntity> = {
    lineGeometry,
    updatedAt: now,
  };
  await db.routes.update(nodeId as any as string, updated as any);

  await db.transaction('rw', db.routeResults, async () => {
    await db.routeResults.where('routeId').equals(nodeId).delete();
    let processed = 0;
    const total = segments.length || 1;
    for (const seg of segments) {
      await db.routeResults.add({
        id: crypto.randomUUID(),
        routeId: nodeId,
        sessionId: 'tabular-extract',
        taskId: seg.seq.toString(),
        method: 'tabular-import',
        createdAt: now,
        result: {
          name: seg.name,
          coordinates: [seg.lon, seg.lat],
          payload: seg.payload,
        },
      });
      processed += 1;
      if (reportProgress && processed % 50 === 0) {
        reportProgress({ stage: 'materialize-route', completed: processed, total, updatedAt: Date.now() });
      }
    }
  });

  if (reportProgress) {
    reportProgress({ stage: 'materialize-route', completed: segments.length, total: segments.length || 1, updatedAt: Date.now() });
  }

  await db.close();
}
