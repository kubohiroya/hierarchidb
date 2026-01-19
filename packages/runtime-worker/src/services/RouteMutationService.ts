import { DexieChunkStore } from '@hierarchidb/chunk-store';
import type { NodeId } from '@hierarchidb/common-types';
import { FetchNetworkPort, getCorsProxyBaseURL } from '@hierarchidb/download';
import type { LocationQueryAPI } from '@hierarchidb/location-store';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmImportCallback,
  type IdeGsmImportProgress,
  type IdeGsmRouteImportRequest,
  type IdeGsmRouteImportResult,
  type RouteWaypointInput,
  type RouteWaypointResult,
} from '@hierarchidb/plugin-service-api';
import { RouteGenerator, SearouteEngine } from '@hierarchidb/route-engine';
import type { RouteDatabaseHandle, RouteMutationAPI } from '@hierarchidb/route-store';
import { SingletonMixin } from '@hierarchidb/util';
import { buildIdeGsmLocationIndex, parseIdeGsmCsv } from './route/ideGsmCsv.js';

export class RouteMutationService implements RouteMutationAPI {
  static async getSingleton(
    db: RouteDatabaseHandle,
    locationQueryService: LocationQueryAPI
  ): Promise<RouteMutationService> {
    return SingletonMixin.getSingleton(
      'RouteMutationService',
      async () => new RouteMutationService(db, locationQueryService)
    );
  }

  constructor(
    private db: RouteDatabaseHandle,
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

  async importIdeGsmRoutes(
    request: IdeGsmRouteImportRequest,
    progress?: IdeGsmImportCallback
  ): Promise<IdeGsmRouteImportResult> {
    const emit = (payload: Omit<IdeGsmImportProgress, 'timestamp'>): void => {
      progress?.({ ...payload, timestamp: Date.now() });
    };
    try {
      emit({ phase: 'fetch' });

      if (request.locationNodeIds.length === 0) {
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
        request.locationNodeIds
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
}

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
