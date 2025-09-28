import type { BBox, FeatureCollection, MapSourcePort, TileCoord } from '../ports.js';

interface Cell {
  feats: any[];
}

export class FeatureCollectionGridIndex implements MapSourcePort {
  private grid = new Map<string, Cell>();
  private cellSizeDeg: number;
  private bounds?: BBox;
  private featureCount = 0;

  constructor(cellSizeDeg: number = 1) {
    this.cellSizeDeg = cellSizeDeg;
  }

  build(fc: FeatureCollection): void {
    this.featureCount = fc.features.length;
    for (const f of fc.features) {
      const b = featureBBox(f);
      if (!b) continue;
      this.bounds = union(this.bounds, b);
      const [minI, maxI, minJ, maxJ] = cellsForBBox(b, this.cellSizeDeg);
      for (let i = minI; i <= maxI; i++) for (let j = minJ; j <= maxJ; j++) {
        const key = `${i},${j}`;
        let cell = this.grid.get(key);
        if (!cell) {
          cell = { feats: [] };
          this.grid.set(key, cell);
        }
        cell.feats.push(f);
      }
    }
  }

  async queryByBBox(bbox: BBox, _zoom?: number): Promise<FeatureCollection> {
    const [minI, maxI, minJ, maxJ] = cellsForBBox(bbox, this.cellSizeDeg);
    const out: any[] = [];
    for (let i = minI; i <= maxI; i++) for (let j = minJ; j <= maxJ; j++) {
      const cell = this.grid.get(`${i},${j}`);
      if (!cell) continue;
      for (const f of cell.feats) if (intersectsBBox(f, bbox)) out.push(f);
    }
    return { type: 'FeatureCollection', features: out } as FeatureCollection;
  }

  async queryByTile(tile: TileCoord): Promise<FeatureCollection> {
    return this.queryByBBox(tileToBBox(tile));
  }

  async getMetadata(): Promise<{ bounds?: BBox; featureCount?: number; updatedAt?: number }> {
    return { bounds: this.bounds, featureCount: this.featureCount, updatedAt: Date.now() };
  }
}

function cellsForBBox(b: BBox, step: number): [number, number, number, number] {
  const minI = Math.floor((b.minX + 180) / step);
  const maxI = Math.floor((b.maxX + 180) / step);
  const minJ = Math.floor((b.minY + 90) / step);
  const maxJ = Math.floor((b.maxY + 90) / step);
  return [minI, maxI, minJ, maxJ];
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

function intersectsBBox(f: any, bbox: BBox): boolean {
  const fb = featureBBox(f);
  if (!fb) return false;
  return !(fb.minX > bbox.maxX || fb.maxX < bbox.minX || fb.minY > bbox.maxY || fb.maxY < bbox.minY);
}

function union(a: BBox | undefined, b: BBox): BBox {
  return !a ? b : {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function tileToBBox({ z, x, y }: TileCoord): BBox {
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180, lon2 = (x + 1) / n * 360 - 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const lat1 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))));
  const lat2 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
}

