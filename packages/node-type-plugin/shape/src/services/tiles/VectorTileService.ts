/**
 * VectorTileService - Manages vector tile generation and serving
 * 
 * Handles:
 * - Vector tile generation from feature data
 * - Tile caching and retrieval
 * - Tile metadata management
 * - Spatial indexing for efficient queries
 * - MVT (Mapbox Vector Tiles) format encoding
 */

import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import * as turf from '@turf/turf';
import { shapeDB, type VectorTileRecord } from '../database/ShapeDB';
import type { NodeId } from '@hierarchidb/common-core';
import type {
  TileMetadata,
  LayerInfo,
  Feature,
  BoundingBox,
  VectorTileTaskConfig,
  LayerConfig
} from '../types';

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
        simplificationLevel: 1
      }
    ],
    compression: true
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
      return cachedTile.data;
    }

    // Generate tile if not cached
    const tile = await this.generateTile(request);
    if (tile) {
      await this.cacheTile(nodeId, z, x, y, tile);
      return tile;
    }

    return null;
  }

  async getTileMetadata(nodeId: NodeId, z: number, x: number, y: number): Promise<TileMetadata | null> {
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
      version: tile.version
    };
  }

  // Tile Generation
  async generateTile(request: TileRequest): Promise<Uint8Array | null> {
    const { nodeId, z, x, y } = request;
    const bbox = this.tileToBbox(x, y, z);
    
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
      layers: this.options.layers || this.defaultOptions.layers
    });

    return mvt;
  }

  async generateTilesForZoomLevel(nodeId: NodeId, zoom: number): Promise<number> {
    const features = await shapeDB.features
      .where('nodeId')
      .equals(nodeId)
      .toArray();

    if (features.length === 0) {
      return 0;
    }

    // Calculate bounds of all features
    const bounds = this.calculateFeatureBounds(features);
    const tiles = this.getTilesInBounds(bounds, zoom);
    
    let generatedCount = 0;
    for (const tile of tiles) {
      try {
        const tileData = await this.generateTile({
          nodeId,
          z: zoom,
          x: tile.x,
          y: tile.y
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
        .filter((tile: any) => tile.z === zoomLevel)
        .toArray();
      
      for (const tile of tiles) {
        await shapeDB.vectorTiles.delete(tile.tileId);
        count++;
      }
    } else {
      const tiles = await shapeDB.vectorTiles
        .where('nodeId')
        .equals(nodeId)
        .toArray();
      
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
    const tiles = await shapeDB.vectorTiles
      .where('nodeId')
      .equals(nodeId)
      .toArray();

    const stats = {
      totalTiles: tiles.length,
      totalSize: tiles.reduce((sum: number, tile: any) => sum + tile.size, 0),
      byZoomLevel: {} as Record<number, { count: number; size: number }>
    };

    for (const tile of tiles) {
      if (!stats.byZoomLevel[tile.z]) {
        stats.byZoomLevel[tile.z] = { count: 0, size: 0 };
      }
      stats.byZoomLevel[tile.z].count++;
      stats.byZoomLevel[tile.z].size += tile.size;
    }

    return stats;
  }

  // Private Methods
  private async getFeaturesInTile(
    nodeId: NodeId, 
    bbox: BoundingBox, 
    zoom: number
  ): Promise<Feature[]> {
    // Get features that intersect with tile bounds
    const features = await shapeDB.getFeaturesInBbox(nodeId, bbox);
    
    // Filter by zoom-appropriate admin level
    const adminLevel = this.getAdminLevelForZoom(zoom);
    const filteredFeatures = features.filter((feature: any) => 
      !feature.adminLevel || feature.adminLevel <= adminLevel
    );

    // Simplify geometries based on zoom level
    return filteredFeatures.map((feature: any) => ({
      ...feature,
      geometry: this.simplifyGeometryForZoom(feature.geometry, zoom)
    }));
  }

  private async generateMVT(config: {
    features: Feature[];
    z: number;
    x: number;
    y: number;
    extent: number;
    buffer: number;
    layers: LayerConfig[];
  }): Promise<Uint8Array> {
    const { features, z, x, y, extent, buffer, layers } = config;
    
    // Create tile layers
    const tileLayers: any = {};
    
    for (const layerConfig of layers) {
      if (z < layerConfig.minZoom || z > layerConfig.maxZoom) {
        continue;
      }

      const layerFeatures = features.filter(feature => 
        this.featureMatchesLayer(feature, layerConfig)
      );

      if (layerFeatures.length === 0) {
        continue;
      }

      tileLayers[layerConfig.name] = {
        features: layerFeatures.map(feature => ({
          geometry: this.transformGeometryToTile(feature.geometry, x, y, z, extent, buffer),
          properties: this.filterProperties(feature.properties, layerConfig.properties)
        })),
        extent
      };
    }

    // Encode as MVT
    return this.encodeMVT(tileLayers);
  }

  private tileToBbox(x: number, y: number, z: number): BoundingBox {
    const n = Math.pow(2, z);
    const lonMin = (x / n) * 360 - 180;
    const latMax = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const lonMax = ((x + 1) / n) * 360 - 180;
    const latMin = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
    
    return [lonMin, latMin, lonMax, latMax];
  }

  private calculateFeatureBounds(features: Feature[]): BoundingBox {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
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

  private getTilesInBounds(bounds: BoundingBox, zoom: number): Array<{x: number; y: number}> {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const tiles: Array<{x: number; y: number}> = [];
    
    const minTileX = Math.floor(this.lonToTileX(minLon, zoom));
    const maxTileX = Math.floor(this.lonToTileX(maxLon, zoom));
    const minTileY = Math.floor(this.latToTileY(maxLat, zoom));
    const maxTileY = Math.floor(this.latToTileY(minLat, zoom));
    
    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        tiles.push({ x, y });
      }
    }
    
    return tiles;
  }

  private lonToTileX(lon: number, zoom: number): number {
    return (lon + 180) / 360 * Math.pow(2, zoom);
  }

  private latToTileY(lat: number, zoom: number): number {
    return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
  }

  private getAdminLevelForZoom(zoom: number): number {
    if (zoom <= 4) return 0;
    if (zoom <= 8) return 1;
    if (zoom <= 12) return 2;
    return 3;
  }

  private simplifyGeometryForZoom(geometry: any, zoom: number): any {
    const tolerance = this.getToleranceForZoom(zoom);
    
    try {
      return turf.simplify(geometry, { tolerance, highQuality: false });
    } catch {
      return geometry; // Return original if simplification fails
    }
  }

  private getToleranceForZoom(zoom: number): number {
    // Higher zoom = lower tolerance (more detail)
    return Math.max(0.0001, 0.01 / Math.pow(2, zoom - 8));
  }

  private featureMatchesLayer(feature: Feature, layerConfig: LayerConfig): boolean {
    // Simple matching - could be more sophisticated
    return true;
  }

  private transformGeometryToTile(
    geometry: any,
    tileX: number,
    tileY: number,
    zoom: number,
    extent: number,
    buffer: number
  ): any {
    // Transform geographic coordinates to tile coordinates
    // This is a simplified implementation
    return geometry;
  }

  private filterProperties(properties: Record<string, any>, allowedProperties: string[]): Record<string, any> {
    const filtered: Record<string, any> = {};
    
    for (const prop of allowedProperties) {
      if (properties[prop] !== undefined) {
        filtered[prop] = properties[prop];
      }
    }
    
    return filtered;
  }

  private encodeMVT(layers: any): Uint8Array {
    // This would use a proper MVT encoder like @mapbox/vector-tile
    // For now, return a placeholder
    const mockMVT = new Uint8Array(1024);
    mockMVT.fill(0);
    return mockMVT;
  }

  private async cacheTile(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
    data: Uint8Array
  ): Promise<void> {
    const tileId = `${nodeId}-${z}-${x}-${y}`;
    const contentHash = await this.calculateHash(data);
    
    const tile: VectorTileRecord = {
      tileId,
      nodeId,
      z,
      x,
      y,
      data,
      size: data.length,
      features: 0, // Would be calculated during generation
      layers: [],
      generatedAt: Date.now(),
      contentHash,
      version: 1
    };

    await shapeDB.storeVectorTile(tile);
  }

  private async calculateHash(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}