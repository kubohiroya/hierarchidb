import { DexieChunkStore } from '@hierarchidb/chunk-store';
import type { NodeId } from '@hierarchidb/core-types';
import { FetchNetworkPort, getCorsProxyBaseURL } from '@hierarchidb/download';
import type { LocationQueryAPI } from '@hierarchidb/location-api';
import type { TreeNode, TreeQueryAPI } from '@hierarchidb/tree-api';
import type {
  IdeGsmLocationRecord,
  RouteMutationAPI,
  RouteWaypointInput,
  RouteWaypointResult,
} from '@hierarchidb/route-api';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmImportCallback,
  type IdeGsmImportProgress,
  type IdeGsmRouteImportRequest,
  type IdeGsmRouteImportResult,
} from '@hierarchidb/route-api';
import { RouteGenerator, SearouteEngine } from '@hierarchidb/route-engine';
import type { RouteDatabaseHandle } from '@hierarchidb/route-store';
import { SingletonMixin } from '@hierarchidb/util';
import { buildIdeGsmLocationIndex, parseIdeGsmCsv } from './route/ideGsmCsv.js';

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

  async importIdeGsmRoutes(
    request: IdeGsmRouteImportRequest,
    progress?: IdeGsmImportCallback
  ): Promise<IdeGsmRouteImportResult> {
    const emit = (payload: Omit<IdeGsmImportProgress, 'timestamp'>): void => {
      progress?.({ ...payload, timestamp: Date.now() });
    };
    try {
      emit({ phase: 'fetch' });

      const locationNodeIds =
        request.locationNodeIds && request.locationNodeIds.length > 0
          ? request.locationNodeIds
          : await this.resolveIdeGsmLocationNodeIds(request.nodeId);
      if (locationNodeIds.length === 0) {
        throw new Error('No related location nodes found.');
      }

      const store = createRouteTextStore();
      const cacheKey = buildCacheKey('route-ide-gsm', request.sourceUrl);
      const entry = await store.getOrFetchForNode(request.nodeId, request.sourceUrl, {
        accept: 'text/csv',
        cacheKey,
      });
      const csvText = entry.value;

      const locationIndex = await buildIdeGsmLocationIndex(
        this.locationQueryService,
        locationNodeIds
      );
      const { lineStrings, errors } = parseIdeGsmCsv(csvText, locationIndex, request.nodeId);
      emit({ phase: 'parse', total: lineStrings.length, processed: lineStrings.length });

      const generator = await getIdeGsmRouteGenerator();
      emit({ phase: 'waypoints', total: lineStrings.length, processed: 0 });
      const waypointResults: RouteWaypointResult[] = [];
      for (let i = 0; i < lineStrings.length; i += 1) {
        const line = lineStrings[i]!;
        const result = await buildWaypoints(
          {
            id: line.id,
            routeMode: line.routeMode,
            startPoint: line.startPoint,
            endPoint: line.endPoint,
            distance: line.distance,
            speed: line.speed,
          },
          generator
        );
        waypointResults.push(result);
        emit({ phase: 'waypoints', total: lineStrings.length, processed: i + 1 });
      }

      const waypointMap = new Map(waypointResults.map((result) => [result.id, result]));
      const linesWithWaypoints = lineStrings.map((line) => {
        const result = waypointMap.get(line.id);
        if (!result) return line;
        return {
          ...line,
          waypoints: result.waypoints,
          distance: result.distance,
          speed: result.speed,
        };
      });

      await this.ensureOpen();
      await this.db.features.where('nodeId').equals(request.nodeId).delete?.();
      const chunkSize = request.chunkSize ?? IDE_GSM_BULK_CHUNK_SIZE;
      let saved = 0;
      let chunkIndex = 0;
      emit({ phase: 'save', total: linesWithWaypoints.length, processed: 0, chunkSize });
      for (let i = 0; i < linesWithWaypoints.length; i += chunkSize) {
        chunkIndex += 1;
        const slice = linesWithWaypoints.slice(i, i + chunkSize);
        await this.db.features.bulkPut?.(slice);
        saved += slice.length;
        emit({
          phase: 'save',
          total: linesWithWaypoints.length,
          processed: saved,
          chunk: chunkIndex,
          chunkSize,
        });
      }

      emit({ phase: 'completed', total: linesWithWaypoints.length, processed: saved });
      return { saved, errorCount: errors.length, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({ phase: 'failed', message });
      throw error;
    }
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
  const method = resolveIdeGsmMethod(line.routeMode);
  const start = line.startPoint?.coordinates;
  const end = line.endPoint?.coordinates;
  if (!method || !start || !end) {
    return {
      id: line.id,
      waypoints: undefined,
      distance: line.distance,
      speed: line.speed,
    };
  }

  const result = await generator.generate([start, end], { method });
  const distance = result.distance ?? line.distance;
  const speed = result.duration && result.distance ? result.distance / result.duration : undefined;
  return {
    id: line.id,
    waypoints: result.lineGeometry,
    distance,
    speed,
  };
}

function resolveIdeGsmMethod(routeMode?: string): 'great_circle' | 'searoute' | null {
  if (routeMode === 'airway') return 'great_circle';
  if (routeMode === 'waterway') return 'searoute';
  return null;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const buildCacheKey = (prefix: string, url: string): string => `${prefix}:${hashString(url)}`;

const hashString = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
};

const createRouteTextStore = (): DexieChunkStore<string> => {
  const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
  const net = new FetchNetworkPort({
    perHostConcurrency: 4,
    corsProxyBaseURL,
    auth: { scope: 'route' },
  });
  return new DexieChunkStore<string>({
    dbName: 'hidb-chunks',
    serializer: (value) => textEncoder.encode(value).buffer,
    deserializer: (buffer) => textDecoder.decode(new Uint8Array(buffer)),
    networkPort: net,
  });
};
