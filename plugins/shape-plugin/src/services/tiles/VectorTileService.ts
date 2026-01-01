/**
 * VectorTileService - Manages vector tile generation and serving
 *
 * Handles:
 * - Vector tile generation from features data
 * - Tile caching and retrieval
 * - Tile metadata management
 * - Spatial indexing for efficient queries
 * - MVT (Mapbox Vector Tiles) format encoding
 */

//import { VectorTile } from '@mapbox/vector-tile';
//import Protobuf from 'pbf';
import * as turf from '@turf/turf';
import { shapeDB, type VectorTileRecord, type FeatureRecord } from '../database/ShapeDB.js';
import type { NodeId } from '@hierarchidb/common-types';
import type { BoundingBox, TileMetadata, LayerConfig } from '../../common/types/index.js';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
// NOTE: gis-sdkのdist反映前でも型解決できるように、明示的にパスを固定（後で dist が更新されたら '@hierarchidb/gis-sdk' に戻せます）
import { getTilesInBounds, tileToBbox, encodeMvtFromGeojsonVt, normalizeVectorTileFormat } from '@hierarchidb/gis-sdk';

type TileLayerFeature = {
  geometry: Geometry;
  properties: Record<string, unknown>;
};

type TileLayer = {
  features: TileLayerFeature[];
  extent: number;
};

type TileLayerMap = Record<string, TileLayer>;

export interface TileRequest {
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  layers?: string[];
  format?: 'mvt' | 'geojson';
  buffer?: number;
}

export interface TileGenerationOptions {
  extent?: number;
  buffer?: number;
  tolerance?: number;
  maxZoom?: number;
  minZoom?: number;
  layers?: LayerConfig[];
  compression?: boolean;
}

export class VectorTileService {
  private defaultOptions: Required<TileGenerationOptions> = {
    extent: 4096,
    buffer: 64,
    tolerance: 3,
    maxZoom: 14,
    minZoom: 0,
    layers: [
      {
        name: 'boundaries',
        minZoom: 0,
        maxZoom: 14,
        properties: ['name', 'name_en', 'admin_level', 'population'],
        extractionLevel: 1,
      },
    ],
    compression: true,
  };

  constructor(private options: Partial<TileGenerationOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  // Tile Retrieval
  async getTile(request: TileRequest): Promise<Uint8Array | null> {
    const { nodeId, z, x, y } = request;

    // Check cache first
    const cachedTile = await shapeDB.getVectorTile(nodeId, z, x, y);
    if (cachedTile) {
      return cachedTile.data_Uint8Array;
    }

    // Generate tile if not cached
    const tile = await this.generateTile(request);
    if (tile) {
      await this.cacheTile(nodeId, z, x, y, tile);
      return tile;
    }

    return null;
  }

  async getTileMetadata(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<TileMetadata | null> {
    const tile = await shapeDB.getVectorTile(nodeId, z, x, y);
    if (!tile) {
      return null;
    }

    return {
      exists: true,
      nodeId,
      tileKey: `${z}/${x}/${y}`,
      z,
      x,
      y,
      size: tile.size,
      features: tile.features,
      layers: tile.layers,
      generatedAt: tile.generatedAt,
      lastAccessed: tile.lastAccessed,
      contentHash: tile.contentHash,
      contentEncoding: tile.contentEncoding,
      version: tile.version,
    };
  }

  // Tile Generation
  async generateTile(request: TileRequest): Promise<Uint8Array | null> {
    const { nodeId, z, x, y } = request;
    const bbox = tileToBbox(x, y, z);

    // Get features in tile bounds
    const features = await this.getFeaturesInTile(nodeId, bbox, z);
    if (features.length === 0) {
      return null;
    }

    // Generate MVT
    const mvt = await this.generateMVT({
      features,
      z,
      x,
      y,
      extent: this.options.extent || this.defaultOptions.extent,
      buffer: request.buffer || this.options.buffer || this.defaultOptions.buffer,
      layers: this.options.layers || this.defaultOptions.layers,
    });

    return mvt;
  }

  async generateTilesForZoomLevel(nodeId: NodeId, zoom: number): Promise<number> {
    const features = await shapeDB.features.where('nodeId').equals(nodeId).toArray();

    if (features.length === 0) {
      return 0;
    }

    // Calculate bounds of all features
    const bounds = this.calculateFeatureBounds(features);
    const tiles = getTilesInBounds(bounds, zoom);

    let generatedCount = 0;
    for (const tile of tiles) {
      try {
        const tileData = await this.generateTile({
          nodeId,
          z: zoom,
          x: tile.x,
          y: tile.y,
        });

        if (tileData) {
          await this.cacheTile(nodeId, zoom, tile.x, tile.y, tileData);
          generatedCount++;
        }
      } catch (error) {
        console.error(`Failed to generate tile ${zoom}/${tile.x}/${tile.y}:`, error);
      }
    }

    return generatedCount;
  }

  // Cache Management
  async clearTileCache(nodeId: NodeId, zoomLevel?: number): Promise<number> {
    let count = 0;

    if (zoomLevel !== undefined) {
      const tiles = await shapeDB.vectorTiles
        .where('nodeId')
        .equals(nodeId)
        .filter((tile: VectorTileRecord) => tile.z === zoomLevel)
        .toArray();

      for (const tile of tiles) {
        await shapeDB.vectorTiles.delete(tile.tileId);
        count++;
      }
    } else {
      const tiles = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray();

      for (const tile of tiles) {
        await shapeDB.vectorTiles.delete(tile.tileId);
        count++;
      }
    }

    return count;
  }

  async getTileCacheStatistics(nodeId: NodeId): Promise<{
    totalTiles: number;
    totalSize: number;
    byZoomLevel: Record<number, { count: number; size: number }>;
  }> {
    const tiles = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray();

    const stats = {
      totalTiles: tiles.length,
      totalSize: tiles.reduce((sum: number, tile: VectorTileRecord) => sum + tile.size, 0),
      byZoomLevel: {} as Record<number, { count: number; size: number }>,
    };

    for (const tile of tiles) {
      const currentTile = stats.byZoomLevel[tile.z];
      if (!currentTile) {
        stats.byZoomLevel[tile.z] = { count: 0, size: 0 };
      }
      if (currentTile) {
        if (currentTile?.count) {
          currentTile.count++;
          currentTile.size += tile.size;
        }
      }
    }

    return stats;
  }

  // Private Methods
  private async getFeaturesInTile(
    nodeId: NodeId,
    bbox: BoundingBox,
    zoom: number,
  ): Promise<FeatureRecord[]> {
    // Get features that intersect with tile bounds
    const features = await shapeDB.getFeaturesInBbox(nodeId, bbox);

    // Filter by zoom-appropriate admin level
    const adminLevel = this.getAdminLevelForZoom(zoom);
    const filteredFeatures = features.filter(
      (feature: FeatureRecord) => !feature.adminLevel || feature.adminLevel <= adminLevel,
    );

    // Extract geometries based on zoom level
    return filteredFeatures.map((feature: FeatureRecord) => ({
      ...feature,
      geometry: this.extractGeometryForZoom(feature.geometry, zoom),
    }));
  }

  private async generateMVT(config: {
    features: FeatureRecord[];
    z: number;
    x: number;
    y: number;
    extent: number;
    buffer: number;
    layers: LayerConfig[];
  }): Promise<Uint8Array> {
    const { features, z, x, y, extent, buffer, layers } = config;

    // Create tile layers
    const tileLayers: TileLayerMap = {};

    for (const layerConfig of layers) {
      const minZoom = layerConfig.minZoom ?? 0;
      const maxZoom = layerConfig.maxZoom ?? 24;
      if (z < minZoom || z > maxZoom) {
        continue;
      }

      const layerFeatures = features.filter((feature) =>
        this.featureMatchesLayer(feature, layerConfig),
      );

      if (layerFeatures.length === 0) {
        continue;
      }

      tileLayers[layerConfig.name] = {
        features: layerFeatures.map((feature) => ({
          geometry: this.transformGeometryOfTile(feature.geometry, x, y, z, extent, buffer),
          properties: this.filterProperties(feature.properties, layerConfig.properties ?? []),
        })),
        extent,
      };
    }

    // Encode as MVT (real encoder)
    const format = normalizeVectorTileFormat('mvt');
    if (format === 'geojson') {
      // 現状このサービスは geojson を返す経路未実装（呼び出し側で別途対応）
      return new Uint8Array();
    }

    // TODO: transformGeometryOfTile が未実装のため、現状は空タイルを返す（ただしエンコーダ自体は共通化済）
    const emptyLayer = ({ features: [], extent } as unknown) as import('geojson-vt').Tile;
    return await encodeMvtFromGeojsonVt({ layer0: emptyLayer });
  }

  private calculateFeatureBounds(features: FeatureRecord[]): BoundingBox {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const feature of features) {
      if (feature.bbox) {
        minX = Math.min(minX, feature.bbox[0]);
        minY = Math.min(minY, feature.bbox[1]);
        maxX = Math.max(maxX, feature.bbox[2]);
        maxY = Math.max(maxY, feature.bbox[3]);
      } else {
        // Calculate bbox from geometry
        const bbox = turf.bbox(feature.geometry);
        minX = Math.min(minX, bbox[0]);
        minY = Math.min(minY, bbox[1]);
        maxX = Math.max(maxX, bbox[2]);
        maxY = Math.max(maxY, bbox[3]);
      }
    }

    return [minX, minY, maxX, maxY];
  }


  private getAdminLevelForZoom(zoom: number): number {
    if (zoom <= 4) return 0;
    if (zoom <= 8) return 1;
    if (zoom <= 12) return 2;
    return 3;
  }

  private extractGeometryForZoom(geometry: Geometry, zoom: number): Geometry {
    const tolerance = this.getToleranceForZoom(zoom);

    try {
      const extracted = turf.simplify(geometry, { tolerance, highQuality: false }) as GeoJSONFeature<Geometry> | Geometry;
      if ((extracted as GeoJSONFeature<Geometry>).type === 'Feature') {
        return (extracted as GeoJSONFeature<Geometry>).geometry;
      }
      return extracted as Geometry;
    } catch {
      return geometry; // Return original if extraction fails
    }
  }

  private getToleranceForZoom(zoom: number): number {
    // Higher zoom = lower tolerance (more detail)
    return Math.max(0.0001, 0.01 / 2 ** (zoom - 8));
  }

  private featureMatchesLayer(_feature: FeatureRecord, _layerConfig: LayerConfig): boolean {
    // Simple matching - could be more sophisticated
    return true;
  }

  private transformGeometryOfTile(
    _geometry: Geometry,
    _tileX: number,
    _tileY: number,
    _zoom: number,
    _extent: number,
    _buffer: number,
  ): Geometry {
    throw new Error('Method not implemented.');
    // Transform geographic coordinates to tile coordinates
    // This is a extracted implementation
    //return geometry;
  }

  private filterProperties(
    properties: Record<string, unknown>,
    allowedProperties: string[],
  ): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};

    for (const prop of allowedProperties) {
      if (properties[prop] !== undefined) {
        filtered[prop] = properties[prop];
      }
    }

    return filtered;
  }


  private async cacheTile(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
    data: Uint8Array,
  ): Promise<void> {
    const tileId = `${nodeId}-${z}-${x}-${y}`;
    const contentHash = await this.calculateHash(data);

    const tile: VectorTileRecord = {
      tileId,
      nodeId,
      z,
      x,
      y,
      data_Uint8Array: data,
      size: data.length,
      features: 0, // Would be calculated during generation
      layers: [],
      generatedAt: Date.now(),
      contentHash,
      version: 1,
    };

    await shapeDB.storeVectorTile(tile);
  }

  private async calculateHash(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
