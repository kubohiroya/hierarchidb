import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type vtPbfNS = require('@maplibre/vt-pbf');

export type VectorTileFormat = 'mvt' | 'pbf' | 'geojson';

export type VectorTileContent =
  | { format: 'mvt' | 'pbf'; data: Uint8Array; contentType: string }
  | { format: 'geojson'; data: FeatureCollection; contentType: 'application/geo+json' };

export type EncodeMvtOptions = {
  /** MVT spec version */
  version?: 1 | 2;
};

const loadVtPbf = async (): Promise<typeof vtPbfNS> => {
  const mod = await import('@maplibre/vt-pbf');
  const candidate = mod as { default?: typeof vtPbfNS } & typeof vtPbfNS;
  return candidate.default ?? candidate;
};

/**
 * Encode layers produced by geojson-vt into Mapbox Vector Tile (pbf bytes).
 *
 * NOTE: We treat 'mvt' and 'pbf' as the same on-the-wire bytes.
 */
export async function encodeMvtFromGeojsonVt(
  layers: Record<string, Tile>,
  options: EncodeMvtOptions = {},
): Promise<Uint8Array> {
  const vtpbf = await loadVtPbf();
  const version = options.version ?? 2;
  const layersArg = layers;
  const typedLayers = layersArg as unknown as Tile[];
  const pbf = vtpbf.fromGeojsonVt(typedLayers, {
    version,
    extent: 4096,
  });
  return pbf;
}

export function normalizeVectorTileFormat(format?: string | null): VectorTileFormat {
  if (format === 'mvt' || format === 'pbf' || format === 'geojson') return format;
  // historical usage: undefined is treated as mvt
  if (!format) return 'mvt';
  return 'mvt';
}

export function vectorTileContentType(format: VectorTileFormat): string {
  switch (format) {
    case 'geojson':
      return 'application/geo+json';
    case 'mvt':
    case 'pbf':
    default:
      return 'application/vnd.mapbox-vector-tile';
  }
}

export type PlainFeature = {
  type: 'Feature';
  geometry: Geometry;
  properties: GeoJsonProperties;
};
