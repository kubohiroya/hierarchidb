// build-index.ts
import { bbox, bboxClip, bboxPolygon, booleanIntersects } from "@turf/turf";
import { readFile } from "node:fs/promises";
import type { VectorTileDbBase } from '@hierarchidb/vectortile-store';
import { enumerateTilesForBBox, tileBBox } from './utils/tiles-util.ts';
import type { Feature, MultiPolygon } from 'geojson';

type CountryInput = { id: string; filePath: string };

export async function vectorTileDB2Procedure(db: VectorTileDbBase, range: { zMin: number; zMax: number }, inputs: CountryInput[]) {
  await db.meta.put({ key: "zoomRange", value: range });

  for (const src of inputs) {
    const gj = JSON.parse(await readFile(src.filePath, "utf8"));
    const [minLon, minLat, maxLon, maxLat] = bbox(gj);

    await db.sources.put({ id: src.id, filePath: src.filePath, minLon, minLat, maxLon, maxLat });

    const rows = [];
    for (let z = range.zMin; z <= range.zMax; z++) {
      for (const t of enumerateTilesForBBox([minLon, minLat, maxLon, maxLat], z)) {
        rows.push({ z, tileId: t.tileId, sourceId: src.id });
      }
    }
    await db.tileIndex.bulkPut(rows);
  }
}

export async function getSourceIdsForTile(db: VectorTileDbBase, z: number, tileId: number): Promise<string[]> {
  const rows = await db.tileIndex.where("[z+tileId]").equals([z, tileId]).toArray();
  // sourceId重複除去
  return [...new Set(rows.map(r => r.sourceId))];
}

export async function assembleTileGeoJSON(
  db: VectorTileDbBase,
  z: number,
  x: number,
  y: number,
  sourceIds: string[]
) {
  const b = tileBBox(z, x, y);
  const tilePoly = bboxPolygon(b);

  const features: Feature<MultiPolygon>[] = [];

  for (const id of sourceIds) {
    const src = await db.sources.get(id);
    if (!src) continue;

    const gj = JSON.parse(await readFile(src.filePath, "utf8"));

    // bboxレベルでさらに弾く（軽い）
    if (!booleanIntersects(tilePoly, gj)) continue;

    // タイルbboxでクリップ（ポリゴン多いと重いが z<=8 ならまだ現実的）
    const clippedFeature = bboxClip(gj, b);
    if (clippedFeature) {
      features.push(clippedFeature as Feature<MultiPolygon>);
    }
  }

  return { type: "FeatureCollection", features };
}
