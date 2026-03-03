import { buildBoundaryFeature } from './geometry/buildBoundaryFeature.js';
import { decodeTransformByBandCache, loadGeojsonVt } from './geometry/io.js';
import { snapGeometryToGrid, simplifyGeometryInMercator } from './geometry/snap.js';
import {
  simplifyFeatureCollection,
  type SimplifyIssue,
  type SimplifyIssueKind,
  type SimplifyIssueStage,
  type SimplifyOptions,
} from './geometry/simplifyFeatureCollection.js';

export { buildBoundaryFeature, simplifyGeometryInMercator, simplifyFeatureCollection, snapGeometryToGrid };
export type { SimplifyIssue, SimplifyIssueKind, SimplifyIssueStage, SimplifyOptions };

export { decodeTransformByBandCache, loadGeojsonVt };
