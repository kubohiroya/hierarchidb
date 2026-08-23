import type { ISO2, NodeId } from '@hierarchidb/core-types';
import type { LocationQueryAPI } from '@hierarchidb/location-api';
import type {
  IdeGsmLocationRecord,
  IdeGsmRouteCoverageResult,
  IdeGsmRouteImportRequest,
  RouteLineString,
  RouteMutationAPI,
  RouteWaypointInput,
  RouteWaypointResult,
} from '@hierarchidb/route-api';
import { parseIdeGsmRouteRecords, ROUTE_MODES } from '@hierarchidb/route-api';
import { RouteGenerator, SearouteEngine } from '@hierarchidb/route-engine';
import type { RouteDatabaseHandle } from '@hierarchidb/route-store';
import type { TreeNode, TreeQueryAPI } from '@hierarchidb/tree-api';
import { getBuildDatabasePrefix, SingletonMixin } from '@hierarchidb/util';
import { buildIdeGsmLocationIndex } from './route/ideGsmCsvUtils.js';
import { loadTabularTableRows } from './utils/loadTabularTableRows.js';

export class RouteMutationService implements RouteMutationAPI {
  static async getSingleton(
    db: RouteDatabaseHandle,
    treeQueryService: TreeQueryAPI,
    locationQueryService: LocationQueryAPI
  ): Promise<RouteMutationService> {
    return SingletonMixin.getSingleton(
      'RouteMutationService',
      async () => new RouteMutationService(db, treeQueryService, locationQueryService)
    );
  }

  constructor(
    private db: RouteDatabaseHandle,
    private treeQueryService: TreeQueryAPI,
    private locationQueryService: LocationQueryAPI
  ) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  async deleteRouteLineStrings(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.features.where('nodeId').equals(nodeId).delete?.();
  }

  async clearRouteArtifacts(nodeId: NodeId): Promise<void> {
    await this.deleteRouteLineStrings(nodeId);
    await this.db.vectorTiles.where('nodeId').equals(nodeId).delete?.();
    // Legacy nearest-search cache cleanup; canonical tile lineage is in EphemeralDB.
    await this.db.tileIndex.where('nodeId').equals(nodeId).delete?.();
  }

  async applyIdeGsmWaypoints(lines: RouteWaypointInput[]): Promise<RouteWaypointResult[]> {
    if (lines.length === 0) return [];
    const generator = await getIdeGsmRouteGenerator();
    const results: RouteWaypointResult[] = [];
    for (const line of lines) {
      results.push(await buildWaypoints(line, generator));
    }
    return results;
  }

  async resolveIdeGsmLocationIndex(nodeId: NodeId): Promise<Record<string, IdeGsmLocationRecord>> {
    const locationNodeIds = await this.resolveIdeGsmLocationNodeIds(nodeId);
    const index = await buildIdeGsmLocationIndex(this.locationQueryService, locationNodeIds);
    return Object.fromEntries(index);
  }

  async resolveIdeGsmRouteCoverage(
    request: IdeGsmRouteImportRequest
  ): Promise<IdeGsmRouteCoverageResult> {
    const locationNodeIds =
      request.locationNodeIds && request.locationNodeIds.length > 0
        ? request.locationNodeIds
        : await this.resolveIdeGsmLocationNodeIds(request.nodeId);
    if (locationNodeIds.length === 0) {
      throw new Error('No related location nodes found.');
    }

    const { headers, rows } = await loadTabularTableRows(
      'route',
      request.tabularSourceId,
      getBuildDatabasePrefix()
    );
    const locationIndex = await buildIdeGsmLocationIndex(
      this.locationQueryService,
      locationNodeIds
    );
    const { lineStrings, errors } = parseIdeGsmRouteRecords(
      headers,
      rows,
      locationIndex,
      request.nodeId
    );
    const coverage = buildCoverageByCountry(lineStrings);
    const rowCount = lineStrings.length + errors.length;
    return {
      coverageByCountryOr: coverage.or,
      coverageByCountryAnd: coverage.and,
      rowCount,
      errorCount: errors.length,
      errors,
    };
  }

  private async resolveIdeGsmLocationNodeIds(nodeId: NodeId): Promise<NodeId[]> {
    const routeNode = await this.treeQueryService.getNode(nodeId);
    const parentId = routeNode?.parentId ?? null;
    if (!parentId) return [];

    const parentNode = await this.treeQueryService.getNode(parentId);
    if (parentNode && isInvisibleFolder(parentNode)) {
      return [];
    }

    const siblings = await this.treeQueryService.listChildren(parentId);
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
      const descendants = await this.treeQueryService.listDescendants(sibling.id);
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
  }
}

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

const buildCoverageByCountry = (
  lineStrings: RouteLineString[]
): {
  or: Record<ISO2, RouteLineString['routeMode'][]>;
  and: Record<ISO2, RouteLineString['routeMode'][]>;
} => {
  const coverageOr = new Map<ISO2, Set<RouteLineString['routeMode']>>();
  const coverageAnd = new Map<ISO2, Set<RouteLineString['routeMode']>>();
  for (const line of lineStrings) {
    const startCode = line.startPoint?.admin0Code;
    const endCode = line.endPoint?.admin0Code;
    if (startCode) {
      const existing = coverageOr.get(startCode as ISO2) ?? new Set();
      existing.add(line.routeMode);
      coverageOr.set(startCode as ISO2, existing);
    }
    if (endCode) {
      const existing = coverageOr.get(endCode as ISO2) ?? new Set();
      existing.add(line.routeMode);
      coverageOr.set(endCode as ISO2, existing);
    }
    if (startCode && endCode && startCode === endCode) {
      const existing = coverageAnd.get(startCode as ISO2) ?? new Set();
      existing.add(line.routeMode);
      coverageAnd.set(startCode as ISO2, existing);
    }
  }
  const resultOr: Record<ISO2, RouteLineString['routeMode'][]> = {} as Record<
    ISO2,
    RouteLineString['routeMode'][]
  >;
  for (const [country, modes] of coverageOr.entries()) {
    resultOr[country] = Array.from(modes);
  }
  const resultAnd: Record<ISO2, RouteLineString['routeMode'][]> = {} as Record<
    ISO2,
    RouteLineString['routeMode'][]
  >;
  for (const [country, modes] of coverageAnd.entries()) {
    resultAnd[country] = Array.from(modes);
  }
  return { or: resultOr, and: resultAnd };
};

let ideGsmGeneratorPromise: Promise<RouteGenerator> | null = null;

async function getIdeGsmRouteGenerator(): Promise<RouteGenerator> {
  if (!ideGsmGeneratorPromise) {
    ideGsmGeneratorPromise = (async () => {
      return new RouteGenerator({ searoute: new SearouteEngine() });
    })();
  }
  return ideGsmGeneratorPromise;
}

async function buildWaypoints(
  line: RouteWaypointInput,
  generator: RouteGenerator
): Promise<RouteWaypointResult> {
  const strategy = resolveRouteFetchStrategy(line.routeMode);
  const start = line.startPoint?.coordinates ?? resolveLegacyCoordinates(line.startPoint);
  const end = line.endPoint?.coordinates ?? resolveLegacyCoordinates(line.endPoint);
  if (!strategy || !start || !end) {
    return {
      id: line.id,
      waypoints: undefined,
      distance: line.distance,
      speed: line.speed,
    };
  }

  const result = await strategy.generate(generator, start, end);
  const distance = result.distance ?? line.distance;
  const speed = result.duration && result.distance ? result.distance / result.duration : undefined;
  return {
    id: line.id,
    waypoints: result.lineGeometry,
    distance,
    speed,
  };
}

type RouteFetchStrategy = {
  id: string;
  supports: (routeMode?: string) => boolean;
  generate: (
    generator: RouteGenerator,
    start: [number, number],
    end: [number, number]
  ) => ReturnType<RouteGenerator['generate']>;
};

const ROUTE_FETCH_STRATEGIES: RouteFetchStrategy[] = [
  {
    id: 'air-great-circle',
    supports: (routeMode) => routeMode === ROUTE_MODES.AIRWAY,
    generate: (generator, start, end) =>
      generator.generate([start, end], { method: 'great_circle' }),
  },
  {
    id: 'sea-searoute',
    supports: (routeMode) => routeMode === ROUTE_MODES.WATERWAY,
    generate: (generator, start, end) => generator.generate([start, end], { method: 'searoute' }),
  },
  {
    id: 'land-direct',
    supports: (routeMode) =>
      routeMode === ROUTE_MODES.RAILWAY ||
      routeMode === ROUTE_MODES.H_RAILWAY ||
      routeMode === ROUTE_MODES.ROAD ||
      routeMode === ROUTE_MODES.HIGHWAY,
    generate: (generator, start, end) => generator.generate([start, end], { method: 'direct' }),
  },
];

const resolveRouteFetchStrategy = (routeMode?: string): RouteFetchStrategy | null => {
  const strategy = ROUTE_FETCH_STRATEGIES.find((candidate) => candidate.supports(routeMode));
  return strategy ?? null;
};

const resolveLegacyCoordinates = (
  point?: RouteWaypointInput['startPoint']
): [number, number] | undefined => {
  if (!point) return undefined;
  const legacy = point as { longitude?: number; latitude?: number };
  if (typeof legacy.longitude === 'number' && typeof legacy.latitude === 'number') {
    return [legacy.longitude, legacy.latitude];
  }
  return undefined;
};
