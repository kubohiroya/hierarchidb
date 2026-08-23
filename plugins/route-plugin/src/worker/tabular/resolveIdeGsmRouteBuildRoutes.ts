import type { NodeId } from '@hierarchidb/core-types';
import {
  buildIdeGsmRouteSelectionEntries,
  filterIdeGsmRoutesBySelection,
  parseIdeGsmRouteRecords,
  RouteCanonicalBuildInputResolverError,
  type RouteBuildRouteInput,
  type RouteCanonicalBuildInputResolverPorts,
  type RouteLineString,
} from '@hierarchidb/route-api';

export type ResolveIdeGsmRouteBuildRoutesRequest = {
  nodeId: NodeId;
  tabularSourceId: string;
  selectedArrayByCountries: unknown;
  locationNodeIds?: NodeId[];
  ports: RouteCanonicalBuildInputResolverPorts;
};

export const resolveIdeGsmRouteBuildRoutes = async (
  request: ResolveIdeGsmRouteBuildRoutesRequest
): Promise<RouteBuildRouteInput[]> => {
  const selectionEntries = buildIdeGsmRouteSelectionEntries(request.selectedArrayByCountries);
  const locationNodeIds = await request.ports.resolveIdeGsmLocationNodeIds(
    request.nodeId,
    request.locationNodeIds
  );
  if (locationNodeIds.length === 0) {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_LOCATION_SOURCE_MISSING',
      '[route canonical input resolver] No related location nodes found'
    );
  }

  const { headers, rows } = await request.ports.loadIdeGsmRouteRows(request.tabularSourceId);
  const locationIndex = await request.ports.buildIdeGsmLocationIndex(locationNodeIds);
  const { lineStrings, errors } = parseIdeGsmRouteRecords(
    headers,
    rows,
    locationIndex,
    request.nodeId
  );
  if (errors.length > 0) {
    const first = errors[0];
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_ENDPOINT_UNRESOLVED',
      `[route canonical input resolver] IDE-GSM route source has ${String(errors.length)} invalid row(s); first row ${String(first?.rowNumber ?? 'unknown')}: ${first?.reason ?? 'unknown error'}`
    );
  }
  if (lineStrings.length === 0) {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_EMPTY_RESULT',
      '[route canonical input resolver] IDE-GSM route source contains no resolved route rows'
    );
  }

  const selectedLineStrings = filterIdeGsmRoutesBySelection(lineStrings, selectionEntries);
  if (selectedLineStrings.length === 0) {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_EMPTY_RESULT',
      '[route canonical input resolver] selectedArrayByCountries matched no IDE-GSM route rows'
    );
  }
  return selectedLineStrings
    .sort(compareRouteLineStringsForPlanning)
    .map((line) => toRouteBuildRouteInput(line));
};

const compareRouteLineStringsForPlanning = (
  left: RouteLineString,
  right: RouteLineString
): number =>
  buildRouteLineStringPlanningKey(left).localeCompare(buildRouteLineStringPlanningKey(right), 'en');

const buildRouteLineStringPlanningKey = (line: RouteLineString): string =>
  [
    line.routeMode,
    line.startLocationId ?? '',
    line.endLocationId ?? '',
    line.featureId,
    line.name,
  ].join('\u0000');

const toRouteBuildRouteInput = (line: RouteLineString): RouteBuildRouteInput => ({
  startLocationId: requireLineLocationId(line.startLocationId, line.featureId, 'startLocationId'),
  endLocationId: requireLineLocationId(line.endLocationId, line.featureId, 'endLocationId'),
  startCoordinates: requireLineCoordinates(line.startPoint, line.featureId, 'startPoint'),
  endCoordinates: requireLineCoordinates(line.endPoint, line.featureId, 'endPoint'),
  routeMode: line.routeMode,
  metadata: normalizeRouteMetadata(line.metadata, line.featureId),
});

const normalizeRouteMetadata = (
  metadata: RouteLineString['metadata'],
  featureId: string
): RouteBuildRouteInput['metadata'] => {
  if (metadata === undefined) return undefined;
  const normalized: NonNullable<RouteBuildRouteInput['metadata']> = { ...metadata };
  if (Object.hasOwn(normalized, 'oneway')) {
    normalized.oneway = requireOnewayMetadata(normalized.oneway, featureId);
  }
  return normalized;
};

const requireOnewayMetadata = (value: unknown, featureId: string): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 0) return false;
  if (value === 1) return true;
  throw new RouteCanonicalBuildInputResolverError(
    'ROUTE_INPUT_INVALID_SELECTION',
    `[route canonical input resolver] resolved route ${featureId} has invalid metadata.oneway`
  );
};

const requireLineLocationId = (
  value: NodeId | undefined,
  featureId: string,
  label: string
): NodeId => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_ENDPOINT_UNRESOLVED',
      `[route canonical input resolver] resolved route ${featureId} is missing ${label}`
    );
  }
  return value;
};

const requireLineCoordinates = (
  value: RouteLineString['startPoint'],
  featureId: string,
  label: string
): [number, number] => {
  const longitude = value.longitude;
  const latitude = value.latitude;
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_ENDPOINT_UNRESOLVED',
      `[route canonical input resolver] resolved route ${featureId} has invalid ${label} coordinates`
    );
  }
  return [longitude, latitude];
};
