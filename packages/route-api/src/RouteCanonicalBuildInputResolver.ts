import type { NodeId } from '@hierarchidb/core-types';
import type { IdeGsmLocationRecord } from './ideGsmRouteCsv.js';
import type { RouteBuildRouteInput, RouteBuildStartInput } from './routeBuildTypes.js';
import type { RouteLineString } from './ROUTE_MODES.js';

export type RouteCanonicalBuildInputResolverErrorCode =
  | 'ROUTE_INPUT_MIXED_DIRECT_AND_SELECTION'
  | 'ROUTE_INPUT_MISSING_KIND'
  | 'ROUTE_INPUT_INVALID_DIRECT_ROUTE'
  | 'ROUTE_INPUT_INVALID_SELECTION'
  | 'ROUTE_INPUT_TABULAR_SOURCE_MISSING'
  | 'ROUTE_INPUT_LOCATION_SOURCE_MISSING'
  | 'ROUTE_INPUT_ENDPOINT_UNRESOLVED'
  | 'ROUTE_INPUT_EMPTY_RESULT';

export class RouteCanonicalBuildInputResolverError extends Error {
  readonly code: RouteCanonicalBuildInputResolverErrorCode;

  constructor(code: RouteCanonicalBuildInputResolverErrorCode, message: string) {
    super(message);
    this.name = 'RouteCanonicalBuildInputResolverError';
    this.code = code;
  }
}

export type RouteCanonicalTabularRows = {
  headers: string[];
  rows: Array<Record<string, unknown>>;
};

export type RouteCanonicalBuildInputResolverPorts = {
  loadIdeGsmRouteRows(tabularSourceId: string): Promise<RouteCanonicalTabularRows>;
  resolveIdeGsmLocationNodeIds(nodeId: NodeId, explicitNodeIds?: NodeId[]): Promise<NodeId[]>;
  buildIdeGsmLocationIndex(nodeIds: NodeId[]): Promise<Map<string, IdeGsmLocationRecord>>;
};

export type RouteCanonicalBuildInputResolver = {
  resolve(nodeId: NodeId, payload: unknown): Promise<RouteBuildStartInput>;
};

export type RouteSelectionDrivenRouteMaterializer = (
  request: RouteSelectionDrivenRouteMaterializerRequest
) => Promise<RouteBuildRouteInput[]>;

export type RouteSelectionDrivenRouteMaterializerRequest = {
  nodeId: NodeId;
  tabularSourceId: string;
  selectedArrayByCountries: unknown;
  locationNodeIds?: NodeId[];
  ports: RouteCanonicalBuildInputResolverPorts;
};

export type RouteLineStringToBuildInput = (line: RouteLineString) => RouteBuildRouteInput;
