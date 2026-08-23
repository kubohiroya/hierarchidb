import type {
  LocationMvtBuildConfig,
  LocationMvtZoomBandConfig,
} from '~/common/entities/LocationEntity.js';

export const LOCATION_MVT_SOURCE_LAYER = 'location_points' as const;
export const LOCATION_MVT_ENCODER_VERSION = 'location-mvt-v1' as const;

export const LOCATION_MVT_ZOOM_BANDS: LocationMvtZoomBandConfig[] = [
  {
    id: 'global',
    minZoom: 0,
    maxZoom: 5,
    types: ['airport', 'port', 'railway_station', 'interchange', 'area_centroid'],
    maxRenderRank: 2,
    minImportance: 0.7,
  },
  {
    id: 'regional',
    minZoom: 6,
    maxZoom: 10,
    types: ['airport', 'port', 'railway_station', 'interchange', 'area_centroid'],
    maxRenderRank: 4,
    minImportance: 0.35,
  },
  {
    id: 'local',
    minZoom: 11,
    maxZoom: 14,
    types: ['airport', 'port', 'railway_station', 'interchange', 'area_centroid'],
    maxRenderRank: 8,
    minImportance: 0,
  },
] as const satisfies LocationMvtZoomBandConfig[];

export const createDefaultLocationMvtBuildConfig = (): LocationMvtBuildConfig => ({
  schemaVersion: 1,
  sourceLayer: LOCATION_MVT_SOURCE_LAYER,
  encoderVersion: LOCATION_MVT_ENCODER_VERSION,
  zoomBands: LOCATION_MVT_ZOOM_BANDS.map((band) => ({
    ...band,
    types: [...band.types],
  })),
  tileEmitConfig: {
    invalidGeometryFilter: {
      area: false,
      lineLength: false,
      maxEdgeLength: false,
      selfIntersection: false,
      triangleRingRatio: false,
    },
    enableTopojsonSimplify: false,
    tolerance: 0,
    extent: 8192,
    buffer: 128,
    bufferSize: 128,
    boundaryDedupe: false,
    indexMaxPoints: 100000,
    layerSetName: LOCATION_MVT_SOURCE_LAYER,
    promoteId: 'pointId',
    tileSize: 256,
    inputFormat: 'flatgeobuf',
    inputCompression: 'none',
    tileExpandFactor: 1,
    tileExpandMargin: 0,
    format: 'mvt',
    compression: 'gzip',
    debug: {
      enabled: false,
      tiles: [],
      features: [],
    },
    maxConcurrent: 1,
  },
});
