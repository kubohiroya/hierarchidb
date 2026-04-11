import type { ISO2, NodeId } from '@hierarchidb/core-types';
import type { LocationQueryAPI } from '@hierarchidb/location-api';
import type { TreeNode, TreeQueryAPI } from '@hierarchidb/tree-api';
import type {
  IdeGsmLocationRecord,
  IdeGsmRouteCoverageResult,
  RouteTileIndexRequest,
  RouteTileIndexResult,
  RouteVectorTileBuildRequest,
  RouteVectorTileBuildResult,
  RouteMutationAPI,
  RouteLineString,
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
import { ROUTE_MODES } from '@hierarchidb/route-api';
import { RouteGenerator, SearouteEngine } from '@hierarchidb/route-engine';
import type { RouteDatabaseHandle } from '@hierarchidb/route-store';
import { ephemeralDB, type EphemeralSourceCacheRecord, type EphemeralTileIdToBufferRelation } from '@hierarchidb/gis-sdk';
import { SingletonMixin, buildZoomBandRanges, normalizeZoomBandBoundaries } from '@hierarchidb/util';
import { buildIdeGsmLocationIndex } from './route/ideGsmCsvUtils.js';
import { filterIdeGsmRoutesBySelection, parseIdeGsmRouteRecords } from '@hierarchidb/route-api';
import { loadTabularTableRows } from './utils/loadTabularTableRows.js';
import { getStageProcessingClient } from './StageProcessingService.js';
import { writeVectorTileInput } from './vectorTileStageRunner.js';
import { clampZoom, haversineMeters } from './nearest/tileNearest.js';

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
  ) { }

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

    const { headers, rows } = await loadTabularTableRows('route', request.tabularSourceId);
    const locationIndex = await buildIdeGsmLocationIndex(this.locationQueryService, locationNodeIds);
    const { lineStrings, errors } = parseIdeGsmRouteRecords(headers, rows, locationIndex, request.nodeId);
    const coverage = buildCoverageByCountry(lineStrings);
    const rowCount = lineStrings.length + errors.length;
    return {
      coverageByCountryOr: coverage.or,
      coverageByCountryAnd: coverage.and,
      coverageByCountry: coverage.or,
      rowCount,
      errorCount: errors.length,
      errors,
    };
  }

  async importIdeGsmRoutes(
    request: IdeGsmRouteImportRequest,
    progress?: IdeGsmImportCallback
  ): Promise<IdeGsmRouteImportResult> {
    const emit = (payload: Omit<IdeGsmImportProgress, 'timestamp'>): void => {
      progress?.({ ...payload, timestamp: Date.now() });
    };
    try {
      emit({ phase: 'source' });

      const locationNodeIds =
        request.locationNodeIds && request.locationNodeIds.length > 0
          ? request.locationNodeIds
          : await this.resolveIdeGsmLocationNodeIds(request.nodeId);
      if (locationNodeIds.length === 0) {
        throw new Error('No related location nodes found.');
      }

      const locationIndex = await buildIdeGsmLocationIndex(
        this.locationQueryService,
        locationNodeIds
      );
      const { headers, rows } = await loadTabularTableRows('route', request.tabularSourceId);
      const { lineStrings, errors } = parseIdeGsmRouteRecords(headers, rows, locationIndex, request.nodeId);
      const filteredLineStrings = filterIdeGsmRoutesBySelection(
        lineStrings,
        request.selectionEntries ?? [],
      );
      emit({ phase: 'parse', total: filteredLineStrings.length, processed: filteredLineStrings.length });

      const generator = await getIdeGsmRouteGenerator();
      emit({ phase: 'waypoints', total: filteredLineStrings.length, processed: 0 });
      const waypointResults: RouteWaypointResult[] = [];
      for (let i = 0; i < filteredLineStrings.length; i += 1) {
        const line = filteredLineStrings[i]!;
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
        emit({ phase: 'waypoints', total: filteredLineStrings.length, processed: i + 1 });
      }

      const waypointMap = new Map(waypointResults.map((result) => [result.id, result]));
      const linesWithWaypoints = filteredLineStrings.map((line) => {
        const result = waypointMap.get(line.id);
        if (!result) return line;
        return {
          ...line,
          waypoints: result.waypoints,
          distance: result.distance,
          speed: result.speed,
        };
      });
      const sourceStageErrors = errors.map((error, index) => (
        buildRouteBuildErrorRecord({
          nodeId: request.nodeId,
          stage: 'source',
          message: error.reason,
          sourceKey: `${error.start}:${error.end}`,
          featureId: error.id,
          sequence: index,
        })
      ));
      const sourceCacheRecords: EphemeralSourceCacheRecord[] = [];
      linesWithWaypoints.forEach((line, index) => {
        const sourceKey = buildRouteFetchSourceKey(line);
        if (!sourceKey) {
          sourceStageErrors.push(
            buildRouteBuildErrorRecord({
              nodeId: request.nodeId,
              stage: 'source',
              message: 'Route line is missing start/end locationId.',
              sourceKey: line.featureId,
              featureId: String(line.id),
              sequence: errors.length + index,
            }),
          );
          return;
        }
        const coordinates = resolveRoutePoints(line);
        if (coordinates.length < 2) {
          sourceStageErrors.push(
            buildRouteBuildErrorRecord({
              nodeId: request.nodeId,
              stage: 'source',
              message: 'Route line has fewer than 2 points.',
              sourceKey,
              featureId: String(line.id),
              sequence: errors.length + index,
            }),
          );
          return;
        }
        const payload = {
          type: 'FeatureCollection' as const,
          features: [{
            type: 'Feature' as const,
            id: String(line.id),
            properties: {
              id: String(line.id),
              sourceKey,
              routeMode: line.routeMode,
              distance: line.distance ?? computeRouteDistanceMeters(coordinates),
              startLocationId: line.startLocationId ? String(line.startLocationId) : '',
              endLocationId: line.endLocationId ? String(line.endLocationId) : '',
            },
            geometry: {
              type: 'LineString' as const,
              coordinates,
            },
          }],
        };
        const data = new TextEncoder().encode(JSON.stringify(payload)).buffer;
        const now = Date.now();
        const bbox = computeLineBbox(coordinates);
        const record: EphemeralSourceCacheRecord = {
          id: `${String(request.nodeId)}:source:${sourceKey}`,
          nodeId: request.nodeId,
          domainType: 'route',
          sourceKey,
          data,
          format: 'topojson',
          compression: 'none',
          featureCount: 1,
          inputFeatureCount: 1,
          bbox,
          downloadTime: 0,
          size: data.byteLength,
          vertexCount: coordinates.length,
          polygonCount: 0,
          inputVertexCount: coordinates.length,
          inputPolygonCount: 0,
          metadata: {
            stage: 'source',
            status: 'completed',
            sourceKey,
            featureCount: 1,
            inputFeatureCount: 1,
            vertexCount: coordinates.length,
            polygonCount: 0,
            inputVertexCount: coordinates.length,
            inputPolygonCount: 0,
          },
          timestamp: now,
        };
        sourceCacheRecords.push(record);
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
      await ephemeralDB.transaction(
        'rw',
        [
          ephemeralDB.sourceCache,
          ephemeralDB.sourceCacheMeta,
          ephemeralDB.geometryCache,
          ephemeralDB.geometryCacheMeta,
          ephemeralDB.tileEmitBufferRelations,
          ephemeralDB.geometryErrors,
        ],
        async () => {
          await ephemeralDB.sourceCache.where('nodeId').equals(request.nodeId).delete();
          await ephemeralDB.sourceCacheMeta.where('nodeId').equals(request.nodeId).delete();
          await ephemeralDB.geometryCache.where('nodeId').equals(request.nodeId).delete();
          await ephemeralDB.geometryCacheMeta.where('nodeId').equals(request.nodeId).delete();
          await ephemeralDB.tileEmitBufferRelations.where('nodeId').equals(request.nodeId).delete();
          await ephemeralDB.geometryErrors.where('nodeId').equals(request.nodeId).delete();
          if (sourceCacheRecords.length > 0) {
            await ephemeralDB.sourceCache.bulkPut(sourceCacheRecords);
          }
          if (sourceStageErrors.length > 0) {
            await ephemeralDB.geometryErrors.bulkPut(sourceStageErrors);
          }
        },
      );
      await this.db.tileIndex.where('nodeId').equals(request.nodeId).delete?.();
      await this.db.vectorTiles.where('nodeId').equals(request.nodeId).delete?.();

      emit({ phase: 'completed', total: linesWithWaypoints.length, processed: saved });
      return { saved, errorCount: errors.length, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({ phase: 'failed', message });
      throw error;
    }
  }

  async buildRouteTileIndex(request: RouteTileIndexRequest): Promise<RouteTileIndexResult> {
    await this.ensureOpen();
    const [minZoom, maxZoom] = normalizeZoomRange(request.minZoom, request.maxZoom);
    const allLines = await this.db.features.where('nodeId').equals(request.nodeId).toArray();
    const lineById = new Map(allLines.map((line) => [String(line.id), line]));
    const boundaries = normalizeZoomBandBoundaries(
      request.zoomBandBoundaries ?? [minZoom, maxZoom],
      minZoom,
      maxZoom,
    );
    const ranges = buildZoomBandRanges(boundaries, minZoom, maxZoom);
    const bands = ranges.map((range, index) => ({
      bandIndex: index,
      zMin: range.min,
      zMax: index === ranges.length - 1 ? range.max : Math.max(range.min, range.max - 1),
      zBase: range.min,
    }));
    const fetchBuffers = await ephemeralDB.sourceCacheMeta.where('nodeId').equals(request.nodeId).toArray();
    const transformRecords: Array<{
      id: string;
      nodeId: NodeId;
      domainType: 'route';
      bandIndex: number;
      sourceKey: string;
      data: ArrayBuffer;
      featureCount: number;
      vertexCount: number;
      polygonCount: number;
      extractionRatio: number;
      tolerance: number;
      timestamp: number;
    }> = [];
    const relationRecords: EphemeralTileIdToBufferRelation[] = [];
    const transformErrors = await ephemeralDB.geometryErrors.where('nodeId').equals(request.nodeId).toArray();
    const tileIndex = new Map<string, Set<string>>();
    let transformErrorSequence = transformErrors.length;
    const now = Date.now();

    for (const meta of fetchBuffers) {
      const full = await ephemeralDB.sourceCache.get(meta.id);
      if (!full) continue;
      const sourceFeature = decodeRouteFeatureCollection(full.data);
      if (!sourceFeature) {
        transformErrors.push(buildRouteBuildErrorRecord({
          nodeId: request.nodeId,
          stage: 'geometry',
          message: 'Failed to decode source cache payload.',
          sourceKey: meta.sourceKey,
          sequence: transformErrorSequence,
        }));
        transformErrorSequence += 1;
        continue;
      }
      const sourceLineId = sourceFeature.id;
      const sourceLine = sourceLineId ? lineById.get(sourceLineId) : undefined;
      const original = sourceFeature.coordinates;
      const distanceMeters = sourceFeature.distanceMeters ?? computeRouteDistanceMeters(original);
      for (const band of bands) {
        const minDistance = resolveBandValue(request.minDistanceMetersByBand, band.bandIndex, 0);
        if (distanceMeters < minDistance) {
          transformErrors.push(buildRouteBuildErrorRecord({
            nodeId: request.nodeId,
            stage: 'geometry',
            message: `Dropped by minDistance rule: ${distanceMeters.toFixed(0)}m < ${minDistance.toFixed(0)}m`,
            sourceKey: meta.sourceKey,
            featureId: sourceLineId,
            sequence: transformErrorSequence,
          }));
          transformErrorSequence += 1;
          continue;
        }
        const tolerance = resolveBandValue(request.simplifyToleranceByBand, band.bandIndex, 0);
        const simplified = simplifyLine(original, tolerance);
        if (simplified.length < 2) {
          transformErrors.push(buildRouteBuildErrorRecord({
            nodeId: request.nodeId,
            stage: 'geometry',
            message: 'Simplification removed required route vertices.',
            sourceKey: meta.sourceKey,
            featureId: sourceLineId,
            sequence: transformErrorSequence,
          }));
          transformErrorSequence += 1;
          continue;
        }
        const bufferId = `${String(request.nodeId)}:geometry:${band.bandIndex}:${meta.sourceKey}`;
        const payload = {
          type: 'FeatureCollection' as const,
          features: [{
            type: 'Feature' as const,
            id: sourceLineId,
            properties: {
              id: sourceLineId,
              sourceKey: meta.sourceKey,
              routeMode: sourceFeature.routeMode,
              distance: distanceMeters,
              startLocationId: sourceFeature.startLocationId,
              endLocationId: sourceFeature.endLocationId,
            },
            geometry: {
              type: 'LineString' as const,
              coordinates: simplified,
            },
          }],
        };
        const data = new TextEncoder().encode(JSON.stringify(payload)).buffer;
        transformRecords.push({
          id: bufferId,
          nodeId: request.nodeId,
          domainType: 'route',
          bandIndex: band.bandIndex,
          sourceKey: meta.sourceKey,
          data,
          featureCount: 1,
          vertexCount: simplified.length,
          polygonCount: 0,
          extractionRatio: Math.max(0, Math.min(1, simplified.length / Math.max(1, original.length))),
          tolerance,
          timestamp: now,
        });
        const lineId = sourceLine ? String(sourceLine.id) : sourceLineId;
        const tileIds = collectRouteTileIds(simplified, band.zBase);
        tileIds.forEach((tileId) => {
          relationRecords.push({
            id: `${String(request.nodeId)}:${band.bandIndex}:${tileId}:${bufferId}`,
            nodeId: request.nodeId,
            domainType: 'route',
            bandIndex: band.bandIndex,
            tileId,
            bufferId,
            featureCount: 1,
            cacheTimestamp: now,
            createdAt: now,
          });
        });
        if (lineId) {
          for (let i = 0; i < simplified.length - 1; i += 1) {
            const start = simplified[i]!;
            const end = simplified[i + 1]!;
            for (let zoom = band.zMin; zoom <= band.zMax; zoom += 1) {
              const range = resolveTileRangeForSegment(start, end, zoom);
              for (let x = range.x1; x <= range.x2; x += 1) {
                for (let y = range.y1; y <= range.y2; y += 1) {
                  const key = buildTileKey(request.nodeId, zoom, x, y);
                  const existing = tileIndex.get(key) ?? new Set<string>();
                  existing.add(lineId);
                  tileIndex.set(key, existing);
                }
              }
            }
          }
        }
      }
    }

    const records = Array.from(tileIndex.entries()).map(([key, lineIds]) => {
      const { nodeId, z, x, y } = parseTileKey(key);
      return {
        id: key,
        nodeId,
        z,
        x,
        y,
        lineIds: Array.from(lineIds),
        updatedAt: now,
      };
    });
    await ephemeralDB.transaction(
      'rw',
      [
        ephemeralDB.geometryCache,
        ephemeralDB.geometryCacheMeta,
        ephemeralDB.tileEmitBufferRelations,
        ephemeralDB.geometryErrors,
      ],
      async () => {
        await ephemeralDB.geometryCache.where('nodeId').equals(request.nodeId).delete();
        await ephemeralDB.geometryCacheMeta.where('nodeId').equals(request.nodeId).delete();
        await ephemeralDB.tileEmitBufferRelations.where('nodeId').equals(request.nodeId).delete();
        if (transformRecords.length > 0) {
          await ephemeralDB.geometryCache.bulkPut(transformRecords);
        }
        if (relationRecords.length > 0) {
          await ephemeralDB.tileEmitBufferRelations.bulkPut(relationRecords);
        }
        if (transformErrors.length > 0) {
          await ephemeralDB.geometryErrors.bulkPut(transformErrors);
        }
      },
    );
    await this.db.tileIndex.where('nodeId').equals(request.nodeId).delete?.();
    if (records.length > 0) {
      await this.db.tileIndex.bulkPut?.(records);
    }
    return {
      tileCount: records.length,
      lineCount: allLines.length,
      minZoom,
      maxZoom,
    };
  }

  async generateRouteVectorTiles(
    request: RouteVectorTileBuildRequest
  ): Promise<RouteVectorTileBuildResult> {
    await this.ensureOpen();
    const [minZoom, maxZoom] = normalizeZoomRange(request.minZoom, request.maxZoom);
    await this.db.vectorTiles.where('nodeId').equals(request.nodeId).delete?.();
    const stage = await getStageProcessingClient();
    const boundaries = normalizeZoomBandBoundaries(
      request.zoomBandBoundaries ?? [minZoom, maxZoom],
      minZoom,
      maxZoom,
    );
    const ranges = buildZoomBandRanges(boundaries, minZoom, maxZoom);
    const bands = ranges.map((range, index) => ({
      bandIndex: index,
      zMin: range.min,
      zMax: index === ranges.length - 1 ? range.max : Math.max(range.min, range.max - 1),
    }));
    const metas = await ephemeralDB.geometryCacheMeta.where('nodeId').equals(request.nodeId).toArray();
    let tilesGenerated = 0;
    let totalBytes = 0;
    for (const band of bands) {
      const bandMetas = metas.filter((meta) => meta.bandIndex === band.bandIndex);
      if (bandMetas.length === 0) continue;
      const buffers = await ephemeralDB.geometryCache.bulkGet(bandMetas.map((meta) => meta.id));
      const features = buffers
        .flatMap((buffer) => (buffer ? decodeRouteFeaturesFromTransform(buffer.data) : []));
      if (features.length === 0) continue;
      const collection = {
        type: 'FeatureCollection' as const,
        features,
      };
      const encoded = new TextEncoder().encode(JSON.stringify(collection)).buffer;
      const bufferId = `${String(request.nodeId)}-route-tile-emit-band-${band.bandIndex}`;
      await writeVectorTileInput(bufferId, encoded, {
        inputFormat: request.inputFormat ?? 'geojson',
        inputCompression: request.inputCompression ?? 'none',
        nodeId: request.nodeId,
        tileId: bufferId,
        chunkStoreName: 'hidb-chunks',
      });
      const result = await stage.tileEmit.generateTiles(bufferId, {
        format: 'mvt',
        compression: 'gzip',
        minZoom: band.zMin,
        maxZoom: band.zMax,
        inputFormat: request.inputFormat ?? 'geojson',
        inputCompression: request.inputCompression ?? 'none',
        buffer: request.bufferSize,
        targetNodeId: request.nodeId,
        targetNodeType: 'route',
      });
      tilesGenerated += result.tilesGenerated;
      totalBytes += result.totalBytes;
    }
    return {
      tilesGenerated,
      totalBytes,
      zoomMin: minZoom,
      zoomMax: maxZoom,
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

type DecodedRouteFeature = {
  id?: string;
  sourceKey: string;
  routeMode?: string;
  distanceMeters?: number;
  startLocationId?: string;
  endLocationId?: string;
  coordinates: [number, number][];
};

const buildRouteFetchSourceKey = (line: RouteLineString): string | null => {
  const startId = line.startLocationId ? String(line.startLocationId) : '';
  const endId = line.endLocationId ? String(line.endLocationId) : '';
  if (!startId || !endId) return null;
  const routeMode = String(line.routeMode ?? '').trim();
  if (!routeMode) return null;
  if (isBidirectionalRoute(line)) {
    const swap = shouldSwapBidirectionalEndpoints(line);
    const from = swap ? endId : startId;
    const to = swap ? startId : endId;
    return `${routeMode}:${from}:${to}`;
  }
  return `${routeMode}:${startId}:${endId}`;
};

const shouldSwapBidirectionalEndpoints = (line: RouteLineString): boolean => {
  const start = line.startPoint;
  const end = line.endPoint;
  if (!start || !end) {
    const startId = line.startLocationId ? String(line.startLocationId) : '';
    const endId = line.endLocationId ? String(line.endLocationId) : '';
    return startId.localeCompare(endId) > 0;
  }
  const lonDelta = start.longitude - end.longitude;
  if (lonDelta !== 0) {
    return lonDelta > 0;
  }
  const latDelta = start.latitude - end.latitude;
  if (latDelta !== 0) {
    return latDelta > 0;
  }
  const startId = line.startLocationId ? String(line.startLocationId) : '';
  const endId = line.endLocationId ? String(line.endLocationId) : '';
  return startId.localeCompare(endId) > 0;
};

const isBidirectionalRoute = (line: RouteLineString): boolean => {
  const metadata = line.metadata ?? {};
  const bidirectionalRaw = metadata.bidirectional;
  if (bidirectionalRaw !== undefined) {
    return normalizeBooleanValue(bidirectionalRaw, false);
  }
  const oneWayRaw = metadata.oneway;
  if (oneWayRaw !== undefined) {
    return !normalizeBooleanValue(oneWayRaw, true);
  }
  return false;
};

const normalizeBooleanValue = (raw: unknown, fallback: boolean): boolean => {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'bidirectional', 'both', 'two-way', 'two_way'].includes(value)) return true;
  if (['false', '0', 'no', 'n', 'off', 'oneway', 'one-way', 'one_way'].includes(value)) return false;
  return fallback;
};

const computeLineBbox = (coords: [number, number][]): [number, number, number, number] => {
  if (coords.length === 0) return [0, 0, 0, 0];
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  coords.forEach(([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  });
  return [minLon, minLat, maxLon, maxLat];
};

const computeRouteDistanceMeters = (coords: [number, number][]): number => {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const [startLon, startLat] = coords[i]!;
    const [endLon, endLat] = coords[i + 1]!;
    total += haversineMeters(startLat, startLon, endLat, endLon);
  }
  return total;
};

const resolveBandValue = (values: number[] | undefined, bandIndex: number, fallback: number): number => {
  if (!values || values.length === 0) return fallback;
  const raw = values[Math.min(values.length - 1, Math.max(0, bandIndex))];
  return Number.isFinite(raw) ? Number(raw) : fallback;
};

const simplifyLine = (coords: [number, number][], tolerance: number): [number, number][] => {
  if (coords.length <= 2) return coords;
  if (!Number.isFinite(tolerance) || tolerance <= 0) return coords;
  const kept = douglasPeucker(coords, tolerance);
  if (kept.length < 2) return coords;
  return kept;
};

const douglasPeucker = (coords: [number, number][], tolerance: number): [number, number][] => {
  const squaredTolerance = tolerance * tolerance;
  const keep = new Array<boolean>(coords.length).fill(false);
  keep[0] = true;
  keep[coords.length - 1] = true;

  const simplifySegment = (startIndex: number, endIndex: number): void => {
    if (endIndex - startIndex <= 1) return;
    let maxDistance = 0;
    let index = -1;
    for (let i = startIndex + 1; i < endIndex; i += 1) {
      const distance = pointSegmentDistanceSquared(coords[i]!, coords[startIndex]!, coords[endIndex]!);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index > -1 && maxDistance > squaredTolerance) {
      keep[index] = true;
      simplifySegment(startIndex, index);
      simplifySegment(index, endIndex);
    }
  };

  simplifySegment(0, coords.length - 1);
  const result: [number, number][] = [];
  for (let i = 0; i < coords.length; i += 1) {
    if (keep[i]) result.push(coords[i]!);
  }
  return result;
};

const pointSegmentDistanceSquared = (
  point: [number, number],
  start: [number, number],
  end: [number, number],
): number => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    const deltaX = point[0] - start[0];
    const deltaY = point[1] - start[1];
    return deltaX * deltaX + deltaY * deltaY;
  }
  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)),
  );
  const projectedX = start[0] + t * dx;
  const projectedY = start[1] + t * dy;
  const deltaX = point[0] - projectedX;
  const deltaY = point[1] - projectedY;
  return deltaX * deltaX + deltaY * deltaY;
};

const decodeRouteFeatureCollection = (buffer: ArrayBuffer): DecodedRouteFeature | null => {
  try {
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer))) as {
      features?: Array<{
        id?: string | number;
        properties?: Record<string, unknown>;
        geometry?: { type?: string; coordinates?: unknown };
      }>;
    };
    const feature = Array.isArray(json.features) ? json.features[0] : undefined;
    if (!feature || feature.geometry?.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) return null;
    const coordinates = feature.geometry.coordinates
      .map((point) => (
        Array.isArray(point) && point.length >= 2
          ? [Number(point[0]), Number(point[1])] as [number, number]
          : null
      ))
      .filter((point): point is [number, number] => Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1])));
    if (coordinates.length < 2) return null;
    const props = feature.properties ?? {};
    return {
      id: feature.id != null ? String(feature.id) : undefined,
      sourceKey: typeof props.sourceKey === 'string' ? props.sourceKey : '',
      routeMode: typeof props.routeMode === 'string' ? props.routeMode : undefined,
      distanceMeters: typeof props.distance === 'number' ? props.distance : undefined,
      startLocationId: typeof props.startLocationId === 'string' ? props.startLocationId : undefined,
      endLocationId: typeof props.endLocationId === 'string' ? props.endLocationId : undefined,
      coordinates,
    };
  } catch {
    return null;
  }
};

const decodeRouteFeaturesFromTransform = (buffer: ArrayBuffer) => {
  const decoded = decodeRouteFeatureCollection(buffer);
  if (!decoded) return [];
  return [{
    type: 'Feature' as const,
    id: decoded.id,
    properties: {
      id: decoded.id,
      sourceKey: decoded.sourceKey,
      routeMode: decoded.routeMode,
      distance: decoded.distanceMeters,
      startLocationId: decoded.startLocationId,
      endLocationId: decoded.endLocationId,
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: decoded.coordinates,
    },
  }];
};

const collectRouteTileIds = (coords: [number, number][], zBase: number): string[] => {
  const ids = new Set<string>();
  for (let i = 0; i < coords.length - 1; i += 1) {
    const start = coords[i]!;
    const end = coords[i + 1]!;
    const range = resolveTileRangeForSegment(start, end, zBase);
    for (let x = range.x1; x <= range.x2; x += 1) {
      for (let y = range.y1; y <= range.y2; y += 1) {
        ids.add(`${zBase}/${x}/${y}`);
      }
    }
  }
  return Array.from(ids);
};

const buildRouteBuildErrorRecord = (params: {
  nodeId: NodeId;
  stage: 'source' | 'geometry' | 'tileEmit';
  message: string;
  sourceKey?: string;
  featureId?: string;
  sequence: number;
}) => ({
  id: `${String(params.nodeId)}:route-error:${params.stage}:${params.sequence}`,
  nodeId: params.nodeId,
  domainType: 'route' as const,
  taskId: `${String(params.nodeId)}:${params.stage}`,
  stage: params.stage,
  issueStage: params.stage,
  issueKind: 'route-build',
  sourceKey: params.sourceKey,
  featureId: params.featureId,
  polygonCount: 0,
  ringCount: 0,
  polygonErrorCount: 0,
  ringErrorCount: 0,
  message: params.message,
  createdAt: Date.now(),
  lineFeatures: {
    type: 'FeatureCollection' as const,
    features: [],
  },
});

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
  lineStrings: RouteLineString[],
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
    end: [number, number],
  ) => ReturnType<RouteGenerator['generate']>;
};

const ROUTE_FETCH_STRATEGIES: RouteFetchStrategy[] = [
  {
    id: 'air-great-circle',
    supports: (routeMode) => routeMode === ROUTE_MODES.AIRWAY,
    generate: (generator, start, end) => generator.generate([start, end], { method: 'great_circle' }),
  },
  {
    id: 'sea-searoute',
    supports: (routeMode) => routeMode === ROUTE_MODES.WATERWAY,
    generate: (generator, start, end) => generator.generate([start, end], { method: 'searoute' }),
  },
  {
    id: 'land-direct',
    supports: (routeMode) => (
      routeMode === ROUTE_MODES.RAILWAY
      || routeMode === ROUTE_MODES.H_RAILWAY
      || routeMode === ROUTE_MODES.ROAD
      || routeMode === ROUTE_MODES.HIGHWAY
    ),
    generate: (generator, start, end) => generator.generate([start, end], { method: 'direct' }),
  },
];

const resolveRouteFetchStrategy = (routeMode?: string): RouteFetchStrategy | null => {
  const strategy = ROUTE_FETCH_STRATEGIES.find((candidate) => candidate.supports(routeMode));
  return strategy ?? null;
};

const resolveRoutePoints = (line: RouteLineString): [number, number][] => {
  if (Array.isArray(line.waypoints) && line.waypoints.length >= 2) {
    return line.waypoints;
  }
  if (line.startPoint && line.endPoint) {
    return [
      [line.startPoint.longitude, line.startPoint.latitude],
      [line.endPoint.longitude, line.endPoint.latitude],
    ];
  }
  return [];
};

const normalizeZoomRange = (min: number, max: number): [number, number] => {
  const minZoom = clampZoom(min);
  const maxZoom = clampZoom(max);
  if (minZoom <= maxZoom) return [minZoom, maxZoom];
  return [maxZoom, minZoom];
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

const buildTileKey = (nodeId: NodeId, z: number, x: number, y: number): string =>
  `${String(nodeId)}:${z}:${x}:${y}`;

const parseTileKey = (key: string): { nodeId: NodeId; z: number; x: number; y: number } => {
  const [nodeIdRaw, zRaw, xRaw, yRaw] = key.split(':');
  return {
    nodeId: nodeIdRaw as NodeId,
    z: Number(zRaw),
    x: Number(xRaw),
    y: Number(yRaw),
  };
};

const resolveTileRangeForSegment = (
  start: [number, number],
  end: [number, number],
  z: number
): { x1: number; x2: number; y1: number; y2: number } => {
  const minLon = Math.min(start[0], end[0]);
  const maxLon = Math.max(start[0], end[0]);
  const minLat = Math.min(start[1], end[1]);
  const maxLat = Math.max(start[1], end[1]);
  const maxIndex = 2 ** z - 1;
  const x1 = clampTileIndex(lonToTileX(minLon, z), maxIndex);
  const x2 = clampTileIndex(lonToTileX(maxLon, z), maxIndex);
  const y1 = clampTileIndex(latToTileY(maxLat, z), maxIndex);
  const y2 = clampTileIndex(latToTileY(minLat, z), maxIndex);
  return {
    x1: Math.min(x1, x2),
    x2: Math.max(x1, x2),
    y1: Math.min(y1, y2),
    y2: Math.max(y1, y2),
  };
};

const lonToTileX = (lon: number, z: number): number => {
  const scale = 2 ** z;
  return Math.floor(((lon + 180) / 360) * scale);
};

const latToTileY = (lat: number, z: number): number => {
  const scale = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale);
};

const clampTileIndex = (value: number, maxIndex: number): number => (
  Math.min(maxIndex, Math.max(0, value))
);
