import {
  type CanonicalPluginBuildAPI,
  type CanonicalPluginBuildStartRequest,
  isLegacyCanonicalPluginBuildStartRequest,
  type LegacyCanonicalPluginBuildStartRequest,
} from '@hierarchidb/build-api';
import {
  createCanonicalBuildRuntimeAdapter,
  createLiveCanonicalPluginBuildSubscriptions,
} from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import type { LocationQueryAPI } from '@hierarchidb/location-api';
import {
  ROUTE_MODES,
  type RouteBuildRouteInput,
  type RouteCanonicalBuildInputResolverPorts,
  type RouteMode,
} from '@hierarchidb/route-api';
import type { TreeNode, TreeQueryAPI } from '@hierarchidb/tree-api';
import { getBuildDatabasePrefix } from '@hierarchidb/util';
import { buildIdeGsmLocationIndex } from '~/services/ide-gsm/ideGsmCsvUtils.js';
import { RouteBuildSessionOrchestrator } from '~/services/RouteBuildSessionOrchestrator.js';
import { resolveRouteCanonicalBuildInput } from '~/services/resolveRouteCanonicalBuildInput.js';
import { PLUGIN_NODE_TYPE } from '../plugin-manifest.js';
import { getBuildTasks } from './getBuildTasks.js';
import { requireRouteBuildConfig } from './requireRouteBuildConfig.js';
import { loadRouteTabularTableRows } from './tabular/loadRouteTabularTableRows.js';

const manager = new RouteBuildSessionOrchestrator();
const subscriptions = createLiveCanonicalPluginBuildSubscriptions();
const ROUTE_MODE_VALUES = new Set<RouteMode>(Object.values(ROUTE_MODES));
let routeCanonicalBuildInputResolverPorts: RouteCanonicalBuildInputResolverPorts | null = null;

export type RouteCanonicalBuildInputResolverDeps = {
  treeQueryAPI: Pick<TreeQueryAPI, 'getNode' | 'listChildren' | 'listDescendants'>;
  locationQueryAPI: Pick<LocationQueryAPI, 'listLocationGroups'>;
  dbPrefix?: string;
};

export const configureRouteCanonicalBuildInputResolver = (
  deps: RouteCanonicalBuildInputResolverDeps
): void => {
  routeCanonicalBuildInputResolverPorts = {
    loadIdeGsmRouteRows: (tabularSourceId) =>
      loadRouteTabularTableRows(
        'route',
        tabularSourceId,
        deps.dbPrefix ?? getBuildDatabasePrefix()
      ),
    resolveIdeGsmLocationNodeIds: (nodeId, explicitNodeIds) =>
      resolveIdeGsmLocationNodeIds(deps.treeQueryAPI, nodeId, explicitNodeIds),
    buildIdeGsmLocationIndex: (nodeIds) =>
      buildIdeGsmLocationIndex(deps.locationQueryAPI as LocationQueryAPI, nodeIds),
  };
};

export const setRouteCanonicalBuildInputResolverPortsForTests = (
  ports: RouteCanonicalBuildInputResolverPorts | null
): void => {
  routeCanonicalBuildInputResolverPorts = ports;
};

export const canonicalBuildRuntimeAdapter = createCanonicalBuildRuntimeAdapter({
  nodeType: PLUGIN_NODE_TYPE,
  inventory: manager,
});

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[route canonical build API] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const requireNodeId = (value: unknown, label: string): NodeId => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[route canonical build API] ${label} must be a non-empty string`);
  }
  return value as NodeId;
};

const requireCoordinate = (value: unknown, label: string): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`[route canonical build API] ${label} must be a longitude/latitude pair`);
  }
  const [longitude, latitude] = value;
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
    throw new Error(`[route canonical build API] ${label} contains invalid coordinates`);
  }
  return [longitude, latitude];
};

const requireRouteMode = (value: unknown, label: string): RouteMode => {
  if (!ROUTE_MODE_VALUES.has(value as RouteMode)) {
    throw new Error(`[route canonical build API] ${label} is unsupported: ${String(value)}`);
  }
  return value as RouteMode;
};

const requireResolvedRouteInput = (value: unknown, index: number): RouteBuildRouteInput => {
  const route = requireRecord(value, `payload.routeBuildInput.routes[${String(index)}]`);
  return {
    startLocationId: requireNodeId(
      route.startLocationId,
      `payload.routeBuildInput.routes[${String(index)}].startLocationId`
    ),
    endLocationId: requireNodeId(
      route.endLocationId,
      `payload.routeBuildInput.routes[${String(index)}].endLocationId`
    ),
    startCoordinates: requireCoordinate(
      route.startCoordinates,
      `payload.routeBuildInput.routes[${String(index)}].startCoordinates`
    ),
    endCoordinates: requireCoordinate(
      route.endCoordinates,
      `payload.routeBuildInput.routes[${String(index)}].endCoordinates`
    ),
    routeMode: requireRouteMode(
      route.routeMode,
      `payload.routeBuildInput.routes[${String(index)}].routeMode`
    ),
    ...(route.metadata === undefined
      ? {}
      : {
          metadata: requireRouteMetadata(
            route.metadata,
            `payload.routeBuildInput.routes[${String(index)}].metadata`
          ),
        }),
  };
};

const requireRouteMetadata = (
  value: unknown,
  label: string
): NonNullable<RouteBuildRouteInput['metadata']> => {
  const record = requireRecord(value, label);
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean') {
      throw new Error(`[route canonical build API] ${label}.${key} must be a primitive value`);
    }
  }
  return record as NonNullable<RouteBuildRouteInput['metadata']>;
};

const resolveStartPayload = (
  request: CanonicalPluginBuildStartRequest | LegacyCanonicalPluginBuildStartRequest
): unknown =>
  isLegacyCanonicalPluginBuildStartRequest(request) ? request.draftData : request.input.payload;

const resolveIdeGsmLocationNodeIds = async (
  treeQueryAPI: Pick<TreeQueryAPI, 'getNode' | 'listChildren' | 'listDescendants'>,
  nodeId: NodeId,
  explicitNodeIds?: NodeId[]
): Promise<NodeId[]> => {
  if (explicitNodeIds !== undefined) {
    if (explicitNodeIds.length === 0) {
      throw new Error('[route canonical input resolver] locationNodeIds must not be empty');
    }
    return explicitNodeIds;
  }

  const routeNode = await treeQueryAPI.getNode(nodeId);
  const parentId = routeNode?.parentId ?? null;
  if (!parentId) return [];

  const parentNode = await treeQueryAPI.getNode(parentId);
  if (parentNode && isInvisibleFolder(parentNode)) {
    return [];
  }

  const siblings = await treeQueryAPI.listChildren(parentId);
  const ordered = orderSiblingsByProximity(siblings, routeNode ?? null);
  const seen = new Set<NodeId>();
  const results: NodeId[] = [];

  for (const sibling of ordered) {
    if (sibling.id === nodeId) continue;
    if (isInvisibleFolder(sibling)) continue;
    if (isLocationNodeType(sibling.nodeType)) {
      pushUniqueIds(results, seen, [sibling]);
      continue;
    }
    if (!isFolderNodeType(sibling.nodeType)) continue;
    const descendants = await treeQueryAPI.listDescendants(sibling.id);
    if (descendants.length === 0) continue;
    const descendantIndex = new Map<NodeId, TreeNode>();
    for (const node of descendants) {
      descendantIndex.set(node.id, node);
    }
    const invisibleFolders = new Set<NodeId>(
      descendants.filter((node) => isInvisibleFolder(node)).map((node) => node.id)
    );
    const filtered = descendants.filter((node) => {
      if (isInvisibleFolder(node)) return false;
      let cursor = node.parentId as NodeId | null | undefined;
      while (cursor) {
        if (invisibleFolders.has(cursor)) return false;
        const parent = descendantIndex.get(cursor);
        if (!parent) break;
        cursor = parent.parentId as NodeId | null | undefined;
      }
      return true;
    });
    const locationNodes = filtered
      .filter((node) => isLocationNodeType(node.nodeType))
      .sort((a, b) => {
        const depthDelta =
          (a.depth ?? 0) - (sibling.depth ?? 0) - ((b.depth ?? 0) - (sibling.depth ?? 0));
        return depthDelta !== 0 ? depthDelta : compareByName(a, b);
      });
    pushUniqueIds(results, seen, locationNodes);
  }

  return results;
};

const isFolderNodeType = (nodeType?: string | null): boolean => {
  if (!nodeType) return false;
  const normalized = String(nodeType).trim();
  return normalized === 'folder' || /folder$/i.test(normalized);
};

const isLocationNodeType = (nodeType?: string | null): boolean => {
  if (!nodeType) return false;
  const normalized = String(nodeType).trim();
  return normalized === 'location' || /location$/i.test(normalized);
};

const isNodeVisible = (node: TreeNode): boolean => {
  if (typeof node.visible === 'boolean') return node.visible;
  return true;
};

const isInvisibleFolder = (node: TreeNode): boolean =>
  !isNodeVisible(node) && isFolderNodeType(node.nodeType);

const getNodeName = (node: TreeNode): string => {
  const name = node.metadata?.name ?? node.draftMetadata?.name ?? '';
  return typeof name === 'string' ? name : String(name ?? '');
};

const compareByName = (a: TreeNode, b: TreeNode): number =>
  getNodeName(a).localeCompare(getNodeName(b), 'en', { numeric: true, sensitivity: 'base' });

const compareNameToValue = (node: TreeNode, value: string): number =>
  getNodeName(node).localeCompare(value, 'en', { numeric: true, sensitivity: 'base' });

const orderSiblingsByProximity = (siblings: TreeNode[], routeNode: TreeNode | null): TreeNode[] => {
  const sorted = [...siblings].sort(compareByName);
  if (sorted.length === 0) return sorted;

  let pivotIndex = -1;
  if (routeNode) {
    pivotIndex = sorted.findIndex((node) => node.id === routeNode.id);
    if (pivotIndex < 0) {
      const routeName = getNodeName(routeNode);
      pivotIndex = sorted.findIndex((node) => compareNameToValue(node, routeName) > 0);
      if (pivotIndex < 0) {
        pivotIndex = sorted.length;
      }
    }
  } else {
    pivotIndex = 0;
  }

  return sorted
    .map((node, index) => ({ node, index, distance: Math.abs(index - pivotIndex) }))
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return compareByName(a.node, b.node);
    })
    .map((entry) => entry.node);
};

const pushUniqueIds = (target: NodeId[], seen: Set<NodeId>, nodes: TreeNode[]) => {
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    target.push(node.id as NodeId);
  }
};

export const canonicalBuildAPI = {
  startBuildSession: async (request) => {
    const { nodeId } = request;
    const draft = requireRecord(resolveStartPayload(request), 'payload');
    if (!Object.hasOwn(draft, 'buildConfig')) {
      throw new Error('[route canonical build API] payload.buildConfig is required');
    }
    const buildConfig = requireRouteBuildConfig(draft.buildConfig);
    const startInput = await resolveRouteCanonicalBuildInput(
      nodeId,
      draft,
      routeCanonicalBuildInputResolverPorts ?? undefined
    );
    const routes = startInput.routes.map((route, index) => requireResolvedRouteInput(route, index));
    await manager.prepareSession(nodeId, buildConfig, { routes });
    return manager.startBuildSession(nodeId);
  },
  getBuildSessionStatus: (nodeId) => manager.getBuildSessionStatus(nodeId),
  pauseBuildSession: (nodeId, reason) => manager.pauseBuildSession(nodeId, reason),
  cancelQueuedBuildSession: (nodeId, reason) => manager.cancelQueuedBuildSession(nodeId, reason),
  getBuildTasks,
  ...subscriptions,
} satisfies CanonicalPluginBuildAPI;
