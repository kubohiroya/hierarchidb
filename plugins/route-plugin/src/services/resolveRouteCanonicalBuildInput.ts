import type { NodeId } from '@hierarchidb/core-types';
import {
  RouteCanonicalBuildInputResolverError,
  type RouteBuildStartInput,
  type RouteCanonicalBuildInputResolverPorts,
} from '@hierarchidb/route-api';
import { resolveIdeGsmRouteBuildRoutes } from '~/worker/tabular/resolveIdeGsmRouteBuildRoutes.js';

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_MISSING_KIND',
      `[route canonical input resolver] ${label} must be an object`
    );
  }
  return value as Record<string, unknown>;
};

const hasDirectRouteInput = (draft: Record<string, unknown>): boolean =>
  Object.hasOwn(draft, 'startLocationId') ||
  Object.hasOwn(draft, 'endLocationId') ||
  Object.hasOwn(draft, 'lineGeometry') ||
  Object.hasOwn(draft, 'routeMode');

const hasSelectionDrivenInput = (draft: Record<string, unknown>): boolean =>
  Object.hasOwn(draft, 'tabularSourceId') || Object.hasOwn(draft, 'selectedArrayByCountries');

const requireTabularSourceId = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_TABULAR_SOURCE_MISSING',
      '[route canonical input resolver] selection-driven input requires tabularSourceId'
    );
  }
  return value;
};

const requireLocationNodeIds = (value: unknown): NodeId[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_INVALID_SELECTION',
      '[route canonical input resolver] locationNodeIds must be an array'
    );
  }
  const nodeIds: NodeId[] = [];
  for (const [index, nodeId] of value.entries()) {
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      throw new RouteCanonicalBuildInputResolverError(
        'ROUTE_INPUT_INVALID_SELECTION',
        `[route canonical input resolver] locationNodeIds[${String(index)}] must be a non-empty string`
      );
    }
    nodeIds.push(nodeId as NodeId);
  }
  return nodeIds;
};

export const resolveRouteCanonicalBuildInput = async (
  nodeId: NodeId,
  payload: unknown,
  ports?: RouteCanonicalBuildInputResolverPorts
): Promise<RouteBuildStartInput> => {
  const draft = requireRecord(payload, 'payload');
  const direct = hasDirectRouteInput(draft);
  const selection = hasSelectionDrivenInput(draft);
  if (direct && selection) {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_MIXED_DIRECT_AND_SELECTION',
      '[route canonical input resolver] route build start cannot mix direct-route and selection-driven inputs'
    );
  }

  const routeBuildInput =
    draft.routeBuildInput === undefined
      ? undefined
      : requireRecord(draft.routeBuildInput, 'payload.routeBuildInput');
  const kind = routeBuildInput?.kind;
  if (kind !== undefined && kind !== 'direct-route' && kind !== 'selection-driven') {
    throw new RouteCanonicalBuildInputResolverError(
      'ROUTE_INPUT_MISSING_KIND',
      `[route canonical input resolver] payload.routeBuildInput.kind is unsupported: ${String(kind)}`
    );
  }

  if (kind === 'direct-route') {
    if (selection) {
      throw new RouteCanonicalBuildInputResolverError(
        'ROUTE_INPUT_MIXED_DIRECT_AND_SELECTION',
        '[route canonical input resolver] direct-route input must not include selection-driven fields'
      );
    }
    return { kind: 'direct-route' };
  }

  if (kind === 'selection-driven' || selection) {
    if (direct) {
      throw new RouteCanonicalBuildInputResolverError(
        'ROUTE_INPUT_MIXED_DIRECT_AND_SELECTION',
        '[route canonical input resolver] selection-driven input must not include direct-route fields'
      );
    }
    if (routeBuildInput && Object.hasOwn(routeBuildInput, 'routes')) {
      throw new RouteCanonicalBuildInputResolverError(
        'ROUTE_INPUT_INVALID_SELECTION',
        '[route canonical input resolver] payload.routeBuildInput.routes is internal-only; provide tabularSourceId and selectedArrayByCountries'
      );
    }
    if (ports === undefined) {
      throw new RouteCanonicalBuildInputResolverError(
        'ROUTE_INPUT_INVALID_SELECTION',
        '[route canonical input resolver] canonical input resolver ports are not configured'
      );
    }
    const routes = await resolveIdeGsmRouteBuildRoutes({
      nodeId,
      tabularSourceId: requireTabularSourceId(draft.tabularSourceId),
      selectedArrayByCountries: draft.selectedArrayByCountries,
      locationNodeIds: requireLocationNodeIds(draft.locationNodeIds),
      ports,
    });
    return { kind: 'selection-driven', routes };
  }

  if (direct) {
    return { kind: 'direct-route' };
  }

  throw new RouteCanonicalBuildInputResolverError(
    'ROUTE_INPUT_MISSING_KIND',
    '[route canonical input resolver] route build start requires either direct-route or selection-driven input'
  );
};
