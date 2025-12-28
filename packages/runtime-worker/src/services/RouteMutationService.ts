import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import { getPluginDownloadService } from '@hierarchidb/download';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmImportCallback,
  type IdeGsmImportProgress,
  type IdeGsmRouteImportRequest,
  type IdeGsmRouteImportResult,
  type RouteWaypointInput,
  type RouteWaypointResult,
} from '@hierarchidb/plugin-service-api';
import type { LocationQueryAPI } from '@hierarchidb/location-store';
import type { RouteMutationAPI } from '@hierarchidb/route-store';
import { buildIdeGsmLocationIndex, parseIdeGsmCsv } from './route/ideGsmCsv.js';
import { RouteGenerator } from './route/RouteGenerator.js';

type DexieCollection = {
  delete?: () => Promise<number>;
};

type DexieWhere = {
  equals(value: unknown): DexieCollection;
};

type DexieTable = {
  where(key: string): DexieWhere;
  delete?: (id: string) => Promise<void>;
  bulkPut?: (items: unknown[]) => Promise<unknown>;
};

type RouteDatabaseLike = {
  open?: () => Promise<unknown>;
  lineStrings: DexieTable;
};

export class RouteMutationService implements RouteMutationAPI {
  static async getSingleton(db: RouteDatabaseLike, locationQueryService: LocationQueryAPI): Promise<RouteMutationService> {
    return SingletonMixin.getSingleton(
      'RouteMutationService',
      async () => new RouteMutationService(db, locationQueryService),
    );
  }

  constructor(private db: RouteDatabaseLike, private locationQueryService: LocationQueryAPI) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  async deleteRouteLineStrings(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.lineStrings.where('nodeId').equals(nodeId).delete?.();
  }

  async clearRouteArtifacts(nodeId: NodeId): Promise<void> {
    await this.deleteRouteLineStrings(nodeId);
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
    progress?: IdeGsmImportCallback,
  ): Promise<IdeGsmRouteImportResult> {
    const emit = (payload: Omit<IdeGsmImportProgress, 'timestamp'>): void => {
      progress?.({ ...payload, timestamp: Date.now() });
    };
    try {
      emit({ phase: 'fetch' });

      if (request.locationNodeIds.length === 0) {
        throw new Error('No related location nodes found.');
      }

      const { service, readAll } = await getPluginDownloadService('route', { perHostConcurrency: 4 });
      const fileId = `route-ide-gsm:${crypto.randomUUID()}`;
      await service.download(request.sourceUrl, fileId);
      const buffer = await readAll(fileId);
      const csvText = new TextDecoder().decode(buffer);

      const locationIndex = await buildIdeGsmLocationIndex(this.locationQueryService, request.locationNodeIds);
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
          generator,
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
      await this.db.lineStrings.where('nodeId').equals(request.nodeId).delete?.();
      const chunkSize = request.chunkSize ?? IDE_GSM_BULK_CHUNK_SIZE;
      let saved = 0;
      let chunkIndex = 0;
      emit({ phase: 'save', total: linesWithWaypoints.length, processed: 0, chunkSize });
      for (let i = 0; i < linesWithWaypoints.length; i += chunkSize) {
        chunkIndex += 1;
        const slice = linesWithWaypoints.slice(i, i + chunkSize);
        await this.db.lineStrings.bulkPut?.(slice);
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
      return new RouteGenerator();
    })();
  }
  return ideGsmGeneratorPromise;
}

async function buildWaypoints(
  line: RouteWaypointInput,
  generator: RouteGenerator,
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
