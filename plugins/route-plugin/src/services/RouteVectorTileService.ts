import { BatchService } from '@hierarchidb/batch';
import type { NodeId } from '@hierarchidb/common-types';
import { digestSha256Hex } from '@hierarchidb/util';
import { TabularWriter } from '@hierarchidb/tabular-store';
import { getRouteRuntimeWorkerClient } from './batch/adapters/RuntimeWorkerClient.js';
import { encodeFlatGeobufFromFeatureCollection } from '@hierarchidb/gis-sdk';
import { writeVectorTileInput } from '@hierarchidb/runtime-worker';
import {
  clearExpiredVectorTiles,
  clearVectorTilesForSession,
  getEphemeralRouteDB,
  type RouteSessionRecord,
  type RouteVectorTileRecord,
} from '../database/EphemeralRouteDB.js';

export interface RouteTileSettings {
  minZoom: number;
  maxZoom: number;
  tileWorkers?: number;
  inputFormat?: 'geojson' | 'flatgeobuf';
  inputCompression?: 'gzip' | 'none';
}

export interface RouteVectorTileSummary {
  sessionId: string;
  nodeId: NodeId;
  zoomMin: number;
  zoomMax: number;
  bbox: [number, number, number, number];
  totalLines: number;
  tableId?: string;
}

const VECTOR_TILE_TTL = 7 * 24 * 60 * 60 * 1000;
const MIN_LANE_CONCURRENCY = 1;
const MAX_LANE_CONCURRENCY = 32;

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const toFeatureCollection = (lines: [number, number][][]) => {
  const features = lines.map((coords, index) => ({
    type: 'Feature' as const,
    id: index,
    properties: {
      index,
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: coords,
    },
  }));
  const bbox = computeBbox(lines);
  return { type: 'FeatureCollection' as const, features, bbox };
};

export class RouteVectorTileService {
  async startSession(
    nodeId: NodeId,
    lines: [number, number][][],
    settings: RouteTileSettings,
  ): Promise<RouteVectorTileSummary> {
    if (!lines.length) {
      throw new Error('No route geometries provided for vector tile generation');
    }
    const sessionId = `route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const db = getEphemeralRouteDB();
    try {
      await clearVectorTilesForSession(sessionId);
      await clearExpiredVectorTiles(VECTOR_TILE_TTL);
    } catch (error) {
      console.warn('[RouteVectorTileService] failed to clear previous vector tiles', error);
    }
    const fc = toFeatureCollection(lines);
    const inputFormat = settings.inputFormat ?? 'geojson';
    const inputCompression = settings.inputCompression ?? 'none';
    const bytes = inputFormat === 'flatgeobuf'
      ? await encodeFlatGeobufFromFeatureCollection(fc)
      : new TextEncoder().encode(JSON.stringify(fc)).buffer;
    await writeVectorTileInput(sessionId, bytes, {
      inputFormat,
      inputCompression,
      chunkStoreName: 'hidb-chunks',
      nodeId,
    });

    const client = await getRouteRuntimeWorkerClient();
    const vectorTileClient = client?.vectortile;
    if (!vectorTileClient) {
      throw new Error('Runtime worker vectortile client is unavailable');
    }
    await vectorTileClient.generateTiles(sessionId, {
      format: 'mvt',
      compression: 'none',
      minZoom: settings.minZoom,
      maxZoom: settings.maxZoom,
      inputFormat,
      inputCompression,
      targetNodeId: nodeId,
      targetNodeType: 'route',
    });
    const tiles = await vectorTileClient.listTiles(nodeId, 'route');
    const laneConcurrency = clamp(settings.tileWorkers ?? tiles.length, MIN_LANE_CONCURRENCY, MAX_LANE_CONCURRENCY);
    const batch = new BatchService();
    await batch.mapChunks<typeof tiles[number], void>(tiles, async (tile) => {
      const u8 = await vectorTileClient.getTile(nodeId, tile.z, tile.x, tile.y, 'route');
      if (!u8) return;
      const copy = new Uint8Array(u8);
      const data: ArrayBuffer = copy.buffer.slice(0);
      const id = `route-mvt-${sessionId}-${tile.z}-${tile.x}-${tile.y}`;
      const hash = await digestSha256Hex(copy);
      await db.vectorTiles.put({
        id,
        sessionId,
        nodeId,
        z: tile.z,
        x: tile.x,
        y: tile.y,
        data,
        size: data.byteLength,
        hash,
        timestamp: tile.timestamp ?? Date.now(),
        contentType: 'application/vnd.mapbox-vector-tile',
      } satisfies RouteVectorTileRecord);
    }, { concurrency: laneConcurrency });

    const tableId = await this.persistMetadata(lines);
    const summary: RouteVectorTileSummary = {
      sessionId,
      nodeId,
      zoomMin: settings.minZoom,
      zoomMax: settings.maxZoom,
      bbox: fc.bbox,
      totalLines: lines.length,
      tableId,
    };
    await db.sessions.put({
      sessionId,
      nodeId,
      bbox: summary.bbox,
      zoomMin: summary.zoomMin,
      zoomMax: summary.zoomMax,
      totalLines: summary.totalLines,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'completed',
      tableId,
    } satisfies RouteSessionRecord);
    return summary;
  }

  async getSessionSummary(sessionId: string): Promise<{
    exists: boolean;
    layers: string[];
    zoomRange?: [number, number];
    tiles: number;
    sizeBytes: number;
    bbox?: [number, number, number, number];
    tableId?: string;
  }> {
    const db = getEphemeralRouteDB();
    const list = await db.vectorTiles.where('sessionId').equals(sessionId).toArray();
    if (list.length === 0) return { exists: false, layers: [], tiles: 0, sizeBytes: 0 };
    const zmin = Math.min(...list.map((r) => r.z));
    const zmax = Math.max(...list.map((r) => r.z));
    const size = list.reduce((s, r) => s + r.size, 0);
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const r of list) {
      const west = tile2lon(r.x, r.z);
      const east = tile2lon(r.x + 1, r.z);
      const north = tile2lat(r.y, r.z);
      const south = tile2lat(r.y + 1, r.z);
      if (west < minLon) minLon = west;
      if (south < minLat) minLat = south;
      if (east > maxLon) maxLon = east;
      if (north > maxLat) maxLat = north;
    }
    const sessions = await db.sessions.get(sessionId);
    return {
      exists: true,
      layers: ['route_lines'],
      zoomRange: [zmin, zmax],
      tiles: list.length,
      sizeBytes: size,
      bbox: [minLon, minLat, maxLon, maxLat],
      tableId: sessions?.tableId,
    };
  }

  private async persistMetadata(lines: [number, number][][]): Promise<string | undefined> {
    if (!lines.length) return undefined;
    try {
      const writer = new TabularWriter('route');
      await writer.begin({
        filename: `route-lines-${Date.now().toString(36)}.json`,
        columns: ['id', 'startLon', 'startLat', 'endLon', 'endLat', 'distanceMeters', 'vertexCount'],
      });
      const rows = lines.map((coords, idx) => {
        const [startLon, startLat] = coords[0] ?? [0, 0];
        const [endLon, endLat] = coords[coords.length - 1] ?? [0, 0];
        return {
          id: idx,
          startLon,
          startLat,
          endLon,
          endLat,
          distanceMeters: computeLength(coords),
          vertexCount: coords.length,
        };
      });
      await writer.writeRows(rows);
      const { tableId } = await writer.commit();
      return tableId;
    } catch (error) {
      console.warn('[RouteVectorTileService] failed to persist metadata', error);
      return undefined;
    }
  }
}

function computeBbox(lines: [number, number][][]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const coords of lines) {
    for (const [lon, lat] of coords) {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat) || !Number.isFinite(maxLon) || !Number.isFinite(maxLat)) {
    return [0, 0, 0, 0];
  }
  return [minLon, minLat, maxLon, maxLat];
}

function computeLength(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const [lon1, lat1] = coords[i]!;
    const [lon2, lat2] = coords[i + 1]!;
    total += haversine(lat1, lon1, lat2, lon2);
  }
  return total;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function tile2lon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
