import type { BBox, FeatureCollection, MapSourcePort, TileCoord } from '../ports.js';
import Dexie, { Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';

const logDexieShapeWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[DexieShapePort]', message, error);
};

type RawBuffer = {
  id: string;
  sessionId: string;
  nodeId: string;
  data: string;
  featureCount: number;
  bbox?: [number, number, number, number];
  timestamp: number
};

class ShapeEphemeralDB extends Dexie {
  rawBuffers!: Table<RawBuffer, string>;

  constructor(name: string = getDBName('shape-ephemeral-db')) {
    super(name);
    this.version(1).stores({ rawBuffers: '&id, sessionId, nodeId, timestamp' });
  }
}

export class DexieShapePort implements MapSourcePort {
  private db: ShapeEphemeralDB;

  constructor(dbName?: string) {
    this.db = new ShapeEphemeralDB(dbName);
  }

  async queryByBBox(bbox: BBox, _zoom?: number, _filters?: Record<string, any>): Promise<FeatureCollection> {
    // naive union over all rawBuffers, filter in-memory by bbox
    const items = await this.db.rawBuffers.toArray();
    const feats: any[] = [];
    for (const it of items) {
      try {
        const fc = JSON.parse(it.data);
        if (fc?.type !== 'FeatureCollection') continue;
        for (const f of fc.features) if (intersectsBBox(f, bbox)) feats.push(f);
      } catch (error) {
        logDexieShapeWarning(`Failed to parse buffered geojson for session ${it.sessionId}`, error);
      }
    }
    return { type: 'FeatureCollection', features: feats };
  }

  async queryByTile(tile: TileCoord, filters?: Record<string, any>): Promise<FeatureCollection> {
    const bbox = tileToBBox(tile);
    return this.queryByBBox(bbox, tile.z, filters);
  }

  async getMetadata(): Promise<{ bounds?: BBox; featureCount?: number; updatedAt?: number }> {
    const items = await this.db.rawBuffers.toArray();
    let fc = 0;
    let bounds: BBox | undefined;
    let updatedAt = 0;
    for (const it of items) {
      fc += it.featureCount || 0;
      if (it.bbox) bounds = union(bounds, arrToBBox(it.bbox));
      updatedAt = Math.max(updatedAt, it.timestamp || 0);
    }
    return { bounds, featureCount: fc, updatedAt };
  }
}

function arrToBBox(a: [number, number, number, number]): BBox {
  return { minX: a[0], minY: a[1], maxX: a[2], maxY: a[3] };
}

function union(a: BBox | undefined, b: BBox): BBox {
  if (!a) return b;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function intersectsBBox(f: any, bbox: BBox): boolean {
  const fb = featureBBox(f);
  if (!fb) return false;
  return !(fb.minX > bbox.maxX || fb.maxX < bbox.minX || fb.minY > bbox.maxY || fb.maxY < bbox.minY);
}

function featureBBox(f: any): BBox | undefined {
  const c = f?.geometry?.coordinates;
  if (!c) return undefined;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (p: any) => {
    if (typeof p?.[0] === 'number') {
      const x = p[0], y = p[1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    } else for (const q of p) visit(q);
  };
  visit(c);
  if (minX === Infinity) return undefined;
  return { minX, minY, maxX, maxY };
}

function tileToBBox({ z, x, y }: TileCoord): BBox {
  const n = Math.pow(2, z);
  const lon1 = x / n * 360 - 180;
  const lon2 = (x + 1) / n * 360 - 180;
  const lat1 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))));
  const lat2 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
}

function toDeg(r: number) {
  return r * 180 / Math.PI;
}
