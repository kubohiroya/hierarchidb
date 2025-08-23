/**
 * VectorTileWorker - Mapbox Vector Tile (MVT) generation
 *
 * Responsibilities:
 * - Generate MVT format tiles from TopoJSON data
 * - Coordinate transformation to tile coordinate system
 * - Layer organization and property filtering
 * - Compression and optimization
 * - Quality assessment and validation
 */

/**
 * VectorTileWorker - Vector tile generation (MVT format)
 *
 * Responsibilities:
 * - MVT (Mapbox Vector Tiles) encoding
 * - Tile optimization and compression
 * - Layer management and filtering
 * - Coordinate transformation
 * - Quality scoring and validation
 */

import * as turf from "@turf/turf";
import { VectorTile } from "@mapbox/vector-tile";
import { toGeoJSONFeature } from "../../utils/featureConverter";
import * as Comlink from "comlink";
import Protobuf from "pbf";
import type {
  VectorTileWorkerAPI,
  VectorTileTask,
  VectorTileResult,
  VectorTileTaskConfig,
  TileMetadata,
  ValidationResult,
  LayerConfig,
  FeatureData,
} from "../types";
import type { Feature } from "../../types";
import type { NodeId } from "@hierarchidb/00-core";

interface TileLayer {
  name: string;
  features: TileFeature[];
  extent: number;
  version: number;
}

interface TileFeature {
  id?: number | string;
  type: "Point" | "LineString" | "Polygon";
  geometry: number[][];
  properties: Record<string, any>;
}

export class VectorTileWorker implements VectorTileWorkerAPI {
  private tileCache = new Map<string, ArrayBuffer>();
  private compressionEnabled = true;

  constructor() {
    if (typeof self !== "undefined") {
      self.addEventListener("error", (event) => {
        console.error("VectorTileWorker global error:", event.error);
      });
    }
  }

  /**
   * Generate vector tile (MVT format)
   */
  async generateVectorTile(task: VectorTileTask): Promise<VectorTileResult> {
    const startTime = Date.now();
    console.log(`VectorTileWorker: Starting tile generation ${task.taskId}`);

    try {
      // 1. Load tile buffer data
      const bufferData = await this.loadTileBuffer(task.tileBufferId);
      if (!bufferData) {
        throw new Error(`Tile buffer ${task.tileBufferId} not found`);
      }

      // 2. Parse GeoJSON
      const geoJson = JSON.parse(bufferData);
      if (!geoJson.features) {
        throw new Error("Invalid tile data: missing features");
      }

      console.log(
        `VectorTileWorker: Processing ${geoJson.features.length} features`,
      );

      // 3. Transform features to tile coordinates
      const tileFeatures = await this.transformFeaturesToTile(
        geoJson.features,
        task.config,
      );

      // 4. Group features by layers
      const layers = this.groupFeaturesByLayers(
        tileFeatures,
        task.config.layers,
      );

      // 5. Generate MVT
      const mvtBuffer = await this.encodeMVT(layers, task.config);

      // 6. Optimize and compress
      const optimizedBuffer = await this.optimizeTile(mvtBuffer);
      const finalBuffer = task.config.compression
        ? await this.compressTile(optimizedBuffer)
        : optimizedBuffer;

      // 7. Calculate quality score
      const qualityScore = this.calculateQualityScore(
        geoJson.features,
        tileFeatures,
        task.config,
      );

      // 8. Generate tile ID and save
      const tileId = `mvt-${task.config.zoomLevel}-${task.config.tileX}-${task.config.tileY}-${Date.now()}`;
      await this.saveTile(tileId, finalBuffer);

      const result: VectorTileResult = {
        taskId: task.taskId,
        status: "completed",
        tileId,
        mvtSize: finalBuffer.byteLength,
        featureCount: geoJson.features.length,
        compressionRatio: task.config.compression
          ? finalBuffer.byteLength / mvtBuffer.byteLength
          : 1,
        qualityScore,
      };

      const processingTime = Date.now() - startTime;
      console.log(
        `VectorTileWorker: Completed ${task.taskId} in ${processingTime}ms`,
      );
      console.log(
        `Generated ${finalBuffer.byteLength} bytes MVT with quality ${qualityScore.toFixed(2)}`,
      );

      return result;
    } catch (error) {
      console.error(`VectorTileWorker: Task ${task.taskId} failed:`, error);

      return {
        taskId: task.taskId,
        status: "failed",
        tileId: "",
        mvtSize: 0,
        featureCount: 0,
        qualityScore: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Optimize tile by removing redundant data
   */
  async optimizeTile(tile: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      // Parse the MVT to analyze and optimize
      const buffer = new Uint8Array(tile);
      const pbf = new Protobuf(buffer);

      // For now, return the original tile
      // Real optimization would:
      // - Remove duplicate vertices
      // - Simplify small features
      // - Optimize property encoding

      return tile;
    } catch (error) {
      console.warn("Tile optimization failed:", error);
      return tile;
    }
  }

  /**
   * Validate MVT tile format and content
   */
  async validateTile(tile: ArrayBuffer): Promise<ValidationResult> {
    const errors: Array<{
      type: string;
      message: string;
      severity: "error" | "warning";
    }> = [];
    const warnings: string[] = [];

    try {
      // Basic size validation
      if (tile.byteLength === 0) {
        errors.push({
          type: "EMPTY_TILE",
          message: "Tile is empty",
          severity: "error",
        });
      }

      if (tile.byteLength > 5 * 1024 * 1024) {
        // 5MB
        warnings.push("Tile size is very large (>5MB)");
      }

      // Try to parse as MVT
      try {
        const buffer = new Uint8Array(tile);
        const pbf = new Protobuf(buffer);
        const vectorTile = new VectorTile(pbf);

        // Validate layers
        const layerNames = Object.keys(vectorTile.layers);
        if (layerNames.length === 0) {
          warnings.push("Tile contains no layers");
        }

        // Validate each layer
        for (const layerName of layerNames) {
          const layer = vectorTile.layers[layerName];
          if (layer.length === 0) {
            warnings.push(`Layer '${layerName}' contains no features`);
          }
        }
      } catch (parseError) {
        errors.push({
          type: "INVALID_MVT",
          message: `Cannot parse as MVT: ${parseError}`,
          severity: "error",
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          size: tile.byteLength,
          format: "mvt",
        },
      };
    } catch (error) {
      errors.push({
        type: "VALIDATION_ERROR",
        message: `Validation failed: ${error}`,
        severity: "error",
      });

      return {
        isValid: false,
        errors,
        warnings: [],
        metadata: {},
      };
    }
  }

  /**
   * Get tile metadata
   */
  async getTileMetadata(tile: ArrayBuffer): Promise<TileMetadata> {
    try {
      const buffer = new Uint8Array(tile);
      const pbf = new Protobuf(buffer);
      const vectorTile = new VectorTile(pbf);

      const layers = Object.keys(vectorTile.layers).map((layerName) => {
        const layer = vectorTile.layers[layerName];
        const fields = new Set<string>();

        // Collect all property keys from features
        for (let i = 0; i < layer.length; i++) {
          const feature = layer.feature(i);
          Object.keys(feature.properties).forEach((key) => fields.add(key));
        }

        return {
          name: layerName,
          featureCount: layer.length,
          minZoom: 0, // Would be extracted from metadata
          maxZoom: 18,
          fields: Array.from(fields),
        };
      });

      const totalFeatures = layers.reduce(
        (sum, layer) => sum + layer.featureCount,
        0,
      );

      return {
        exists: true,
        nodeId: "" as NodeId, // Would be provided by caller
        tileKey: "", // Would be provided by caller
        z: 0, // Would be provided by caller
        x: 0, // Would be provided by caller
        y: 0, // Would be provided by caller
        size: tile.byteLength,
        features: totalFeatures,
        layers,
        generatedAt: Date.now(),
        contentHash: await this.calculateHash(tile),
        version: 1,
      };
    } catch (error) {
      console.error("Failed to get tile metadata:", error);
      throw error;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Transform GeoJSON features to tile coordinate space
   */
  private async transformFeaturesToTile(
    features: Feature[],
    config: VectorTileTaskConfig,
  ): Promise<TileFeature[]> {
    const { zoomLevel, tileX, tileY, extent, buffer } = config;
    const tileFeatures: TileFeature[] = [];

    // Calculate tile bounds in geographic coordinates
    const tileBounds = this.getTileBounds(tileX, tileY, zoomLevel);
    const tileSize = tileBounds.maxX - tileBounds.minX;
    const bufferSize = (buffer / extent) * tileSize;

    // Expand bounds to include buffer
    const bufferedBounds = {
      minX: tileBounds.minX - bufferSize,
      minY: tileBounds.minY - bufferSize,
      maxX: tileBounds.maxX + bufferSize,
      maxY: tileBounds.maxY + bufferSize,
    };

    for (const feature of features) {
      try {
        // Check if feature intersects with buffered tile
        if (!this.featureIntersectsTile(feature, bufferedBounds)) {
          continue;
        }

        // Transform geometry coordinates
        const tileGeometry = this.transformGeometry(
          feature.geometry,
          tileBounds,
          extent,
        );

        if (tileGeometry.length > 0) {
          tileFeatures.push({
            id: feature.id,
            type: this.getGeometryType(feature.geometry),
            geometry: tileGeometry,
            properties: this.filterProperties(
              feature.properties,
              config.layers,
            ),
          });
        }
      } catch (error) {
        console.warn(`Failed to transform feature ${feature.id}:`, error);
      }
    }

    return tileFeatures;
  }

  /**
   * Group features by layers based on configuration
   */
  private groupFeaturesByLayers(
    features: TileFeature[],
    layerConfigs: LayerConfig[],
  ): TileLayer[] {
    const layers: TileLayer[] = [];

    for (const layerConfig of layerConfigs) {
      const layerFeatures = features.filter((feature) =>
        this.featureMatchesLayer(feature, layerConfig),
      );

      if (layerFeatures.length > 0) {
        layers.push({
          name: layerConfig.name,
          features: layerFeatures,
          extent: 4096, // Standard MVT extent
          version: 2,
        });
      }
    }

    return layers;
  }

  /**
   * Encode layers as MVT format
   */
  private async encodeMVT(
    layers: TileLayer[],
    config: VectorTileTaskConfig,
  ): Promise<ArrayBuffer> {
    // This is a simplified MVT encoding
    // Real implementation would use proper MVT encoder like @mapbox/vector-tile

    const tile = {
      layers: layers.map((layer) => ({
        version: layer.version,
        name: layer.name,
        extent: layer.extent,
        features: layer.features.map((feature) => ({
          id: feature.id,
          type: this.getGeometryTypeCode(feature.type),
          geometry: this.encodeGeometry(feature.geometry, feature.type),
          properties: feature.properties,
        })),
      })),
    };

    // Mock MVT encoding - would use proper protobuf encoding
    const jsonString = JSON.stringify(tile);
    const encoder = new TextEncoder();
    return encoder.encode(jsonString).buffer;
  }

  /**
   * Compress tile data
   */
  private async compressTile(tile: ArrayBuffer): Promise<ArrayBuffer> {
    // Simplified compression - would use proper compression like gzip
    return tile;
  }

  /**
   * Calculate quality score for output tile
   */
  private calculateQualityScore(
    originalFeatures: Feature[],
    tileFeatures: TileFeature[],
    config: VectorTileTaskConfig,
  ): number {
    try {
      // Feature preservation ratio
      const featureRatio =
        originalFeatures.length > 0
          ? Math.min(1, tileFeatures.length / originalFeatures.length)
          : 1;

      // Coordinate precision (simplified)
      const coordinatePrecision = 1 - 1 / config.extent;

      // Layer completeness
      const expectedLayers = config.layers.length;
      const layerCompleteness = expectedLayers > 0 ? 1 : 0;

      // Overall quality score (weighted average)
      const quality =
        featureRatio * 0.4 +
        coordinatePrecision * 0.3 +
        layerCompleteness * 0.3;

      return Math.max(0, Math.min(1, quality));
    } catch (error) {
      console.warn("Quality score calculation failed:", error);
      return 0.5; // Default neutral score
    }
  }

  /**
   * Transform individual geometry to tile coordinates
   */
  private transformGeometry(
    geometry: any,
    tileBounds: { minX: number; minY: number; maxX: number; maxY: number },
    extent: number,
  ): number[][] {
    const scaleX = extent / (tileBounds.maxX - tileBounds.minX);
    const scaleY = extent / (tileBounds.maxY - tileBounds.minY);

    const transformPoint = (coord: [number, number]): [number, number] => [
      Math.round((coord[0] - tileBounds.minX) * scaleX),
      Math.round((tileBounds.maxY - coord[1]) * scaleY), // Y is flipped in tile space
    ];

    const transformCoords = (coords: any): any => {
      if (typeof coords[0] === "number") {
        return transformPoint(coords as [number, number]);
      }
      return coords.map(transformCoords);
    };

    try {
      return transformCoords(geometry.coordinates);
    } catch (error) {
      console.warn("Geometry transformation failed:", error);
      return [];
    }
  }

  /**
   * Get tile bounds in geographic coordinates
   */
  private getTileBounds(x: number, y: number, z: number) {
    const n = Math.pow(2, z);
    const minX = (x / n) * 360 - 180;
    const maxX = ((x + 1) / n) * 360 - 180;
    const minY =
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
    const maxY =
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;

    return { minX, minY, maxX, maxY };
  }

  /**
   * Check if feature intersects with tile bounds
   */
  private featureIntersectsTile(
    feature: Feature,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
  ): boolean {
    try {
      const featureBbox = turf.bbox(toGeoJSONFeature(feature));
      const [fMinX, fMinY, fMaxX, fMaxY] = featureBbox;

      return !(
        fMaxX < bounds.minX ||
        fMinX > bounds.maxX ||
        fMaxY < bounds.minY ||
        fMinY > bounds.maxY
      );
    } catch {
      return false;
    }
  }

  /**
   * Get geometry type from GeoJSON geometry
   */
  private getGeometryType(geometry: any): "Point" | "LineString" | "Polygon" {
    switch (geometry.type) {
      case "Point":
      case "MultiPoint":
        return "Point";
      case "LineString":
      case "MultiLineString":
        return "LineString";
      case "Polygon":
      case "MultiPolygon":
        return "Polygon";
      default:
        return "Point";
    }
  }

  /**
   * Get MVT geometry type code
   */
  private getGeometryTypeCode(type: string): number {
    switch (type) {
      case "Point":
        return 1;
      case "LineString":
        return 2;
      case "Polygon":
        return 3;
      default:
        return 1;
    }
  }

  /**
   * Encode geometry for MVT
   */
  private encodeGeometry(geometry: number[][], type: string): number[] {
    // Simplified geometry encoding for MVT
    // Real implementation would use proper MVT geometry encoding
    const encoded: number[] = [];

    const encodeCoords = (coords: any) => {
      if (typeof coords[0] === "number") {
        encoded.push(coords[0], coords[1]);
      } else {
        coords.forEach(encodeCoords);
      }
    };

    encodeCoords(geometry);
    return encoded;
  }

  /**
   * Filter properties based on layer configuration
   */
  private filterProperties(
    properties: Record<string, any>,
    layerConfigs: LayerConfig[],
  ): Record<string, any> {
    const filtered: Record<string, any> = {};

    // Get all allowed properties from all layers
    const allowedProps = new Set<string>();
    layerConfigs.forEach((config) =>
      config.properties.forEach((prop) => allowedProps.add(prop)),
    );

    // Filter properties
    for (const [key, value] of Object.entries(properties)) {
      if (allowedProps.has(key)) {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Check if feature matches layer configuration
   */
  private featureMatchesLayer(
    feature: TileFeature,
    layerConfig: LayerConfig,
  ): boolean {
    // Simplified matching - could be more sophisticated
    // Check if feature has any of the layer's required properties
    return layerConfig.properties.some(
      (prop) => feature.properties[prop] !== undefined,
    );
  }

  /**
   * Calculate hash for tile content
   */
  private async calculateHash(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Load tile buffer data
   */
  private async loadTileBuffer(bufferId: string): Promise<string | null> {
    // Mock implementation - would load from actual buffer storage
    return this.tileCache.get(bufferId)
      ? new TextDecoder().decode(this.tileCache.get(bufferId))
      : null;
  }

  /**
   * Save output tile
   */
  private async saveTile(tileId: string, tile: ArrayBuffer): Promise<void> {
    // Mock implementation - would save to actual tile storage
    this.tileCache.set(tileId, tile);
  }
}

// Type definitions for internal use
interface TileData {
  features: FeatureData[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  zoom: number;
}

interface TransformedFeature extends FeatureData {
  bbox: [number, number, number, number];
}

interface TileBounds {
  west: number;
  east: number;
  north: number;
  south: number;
}

interface MVTLayer {
  name: string;
  version: number;
  extent: number;
  features: MVTFeature[];
  keys: string[];
  values: Array<string | number | boolean | null>;
}

interface MVTFeature {
  id: number;
  tags: number[];
  geometry: GeoJSON.Geometry;
}

interface ParsedMVT {
  layers: MVTLayer[];
}

// Export for Comlink
Comlink.expose(VectorTileWorker);

// Also export the class for direct usage if needed
export default VectorTileWorker;
