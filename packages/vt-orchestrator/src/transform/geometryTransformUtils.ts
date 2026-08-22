import { buildBoundaryFeature } from './geometry/buildBoundaryFeature.js';
import { decodeGeometryStageCache, loadGeojsonVt } from './geometry/decodeGeometryStageCache.js';
import {
  type SimplifyIssue,
  type SimplifyIssueKind,
  type SimplifyIssueStage,
  type SimplifyOptions,
  simplifyFeatureCollection,
} from './geometry/simplifyFeatureCollection.js';
import { simplifyGeometryInMercator, snapGeometryToGrid } from './geometry/snapUtils.js';

export {
  buildBoundaryFeature,
  simplifyGeometryInMercator,
  simplifyFeatureCollection,
  snapGeometryToGrid,
};
export type { SimplifyIssue, SimplifyIssueKind, SimplifyIssueStage, SimplifyOptions };

export { decodeGeometryStageCache, loadGeojsonVt };
