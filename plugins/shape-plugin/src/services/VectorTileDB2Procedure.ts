// build-index.ts
import { bbox, bboxClip, bboxPolygon, booleanIntersects } from '@turf/turf';
import { readFile } from 'node:fs/promises';
import type { TileIndexRow, VectorTileDbBase } from '@hierarchidb/vectortile-store';
import { enumerateTilesForBBox, tileBBox } from './utils/tiles-util.ts';
import type {
  Feature,
  FeatureCollection,
  GeoJsonObject,
  Geometry,
  MultiPolygon,
  Polygon,
} from 'geojson';

type CountryInput = { id: string; filePath: string };

export async function vectorTileDB2Procedure(
  db: VectorTileDbBase,
  range: { zMin: number; zMax: number },
  inputs: CountryInput[],
): Promise<void> {
  await db.meta.put({ key: 'zoomRange', value: range });

  for (const src of inputs) {
    const raw = JSON.parse(await readFile(src.filePath, 'utf8')) as GeoJsonObject;
    if (!isBboxInput(raw)) continue;
    const target = raw as FeatureCollection | Feature | Geometry;
    const [minLon, minLat, maxLon, maxLat] = bbox(target);

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
  const rows = await db.tileIndex.where('[z+tileId]').equals([z, tileId]).toArray();
  // sourceId重複除去
  return [...new Set((rows as TileIndexRow[]).map((row) => row.sourceId))];
}

export async function assembleTileGeoJSON(
  db: VectorTileDbBase,
  z: number,
  x: number,
  y: number,
  sourceIds: string[],
): Promise<FeatureCollection<Polygon | MultiPolygon>> {
  const b = tileBBox(z, x, y);
  const tilePoly = bboxPolygon(b);

  const features: Array<Feature<Polygon | MultiPolygon>> = [];

  const toPolygonFeatures = (
    geojson: FeatureCollection | Feature | Geometry,
  ): Array<Feature<Polygon | MultiPolygon>> => {
    if (geojson.type === 'FeatureCollection') {
      const collection = geojson as FeatureCollection;
      return collection.features.filter(
        (feature): feature is Feature<Polygon | MultiPolygon> =>
          Boolean(
            feature
            && feature.type === 'Feature'
            && (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon'),
          ),
      );
    }
    if (geojson.type === 'Feature') {
      const feature = geojson as Feature;
      if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') {
        return [feature as Feature<Polygon | MultiPolygon>];
      }
      return [];
    }
    if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
      return [{
        type: 'Feature',
        geometry: geojson,
        properties: {},
      } as Feature<Polygon | MultiPolygon>];
    }
    return [];
  };

  for (const id of sourceIds) {
    const src = await db.sources.get(id);
    if (!src) continue;

    const raw = JSON.parse(await readFile(src.filePath, 'utf8')) as GeoJsonObject;
    if (!isBboxInput(raw)) continue;
    const candidates = toPolygonFeatures(raw);

    // bboxレベルでさらに弾く（軽い）
    for (const candidate of candidates) {
      if (!booleanIntersects(tilePoly, candidate)) continue;

      // タイルbboxでクリップ（ポリゴン多いと重いが z<=8 ならまだ現実的）
      const clippedFeature = bboxClip(candidate, b);
      if (clippedFeature) {
        features.push(clippedFeature as Feature<Polygon | MultiPolygon>);
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

const isFeatureCollection = (value: GeoJsonObject): value is FeatureCollection =>
  value.type === 'FeatureCollection' && Array.isArray((value as FeatureCollection).features);

const isFeature = (value: GeoJsonObject): value is Feature =>
  value.type === 'Feature' && typeof (value as Feature).geometry === 'object';

const isGeometry = (value: GeoJsonObject): value is Geometry =>
  value.type !== 'Feature' && value.type !== 'FeatureCollection';

const isBboxInput = (value: GeoJsonObject): value is FeatureCollection | Feature | Geometry =>
  isFeatureCollection(value) || isFeature(value) || isGeometry(value);
