export type TileBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type InputFeatureStats = {
  bbox: TileBBox;
  vertexCount: number;
  polygonCount: number;
  lineStringCount: number;
  bufferId: string;
  featureId?: string;
  geojsonByteSize?: number;
  countryCode?: string;
  featureAreaSqMeters?: number;
};

export const VT_PARENT_INPUT_SUMMARY_METADATA_KEY = 'vtParentInputSummary';

export type VtParentInputSummaryMetadata = {
  parentTile: {
    z: number;
    x: number;
    y: number;
  };
  intersectingFeatureCount: number;
  intersectingGeojsonByteSize: number;
  topCountriesByIntersectingArea: Array<{
    countryCode: string;
    intersectingAreaSqMeters: number;
  }>;
};
