import type { NodeId } from '@hierarchidb/core-types';
import type { RouteFeature, RouteGenerationConfig, RouteMode } from './ROUTE_MODES.js';

export type RouteBuildError = {
  id: string;
  stage: 'source' | 'geometry' | 'tileEmit';
  message: string;
  sourceKey?: string;
  featureId?: string;
  createdAt: number;
};

export type RouteBuildRouteInput = {
  startLocationId: NodeId;
  endLocationId: NodeId;
  startCoordinates: [number, number];
  endCoordinates: [number, number];
  routeMode: RouteMode;
  metadata?: RouteFeature['metadata'];
  method?: RouteGenerationConfig['method'];
  methodOptions?: RouteGenerationConfig['options'];
};

export type RouteBuildStartInput =
  | { kind: 'direct-route' }
  | { kind: 'selection-driven'; routes: RouteBuildRouteInput[] };

export type RouteDirectBuildExternalInput = {
  routeBuildInput?: { kind: 'direct-route' };
  startLocationId?: NodeId;
  endLocationId?: NodeId;
  lineGeometry?: unknown;
  routeMode?: RouteMode;
};

export type RouteSelectionDrivenBuildExternalInput = {
  routeBuildInput?: { kind: 'selection-driven' };
  tabularSourceId: string;
  selectedArrayByCountries: unknown;
  locationNodeIds?: NodeId[];
};

export type RouteCanonicalBuildExternalInput =
  | RouteDirectBuildExternalInput
  | RouteSelectionDrivenBuildExternalInput;
