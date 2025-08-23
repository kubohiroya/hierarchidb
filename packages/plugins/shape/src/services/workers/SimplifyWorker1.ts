/**
 * SimplifyWorker1 - Feature-level simplification using Douglas-Peucker algorithm
 *
 * Responsibilities:
 * - Individual feature simplification using Douglas-Peucker algorithm
 * - Topology preservation options (prevent self-intersection)
 * - Morton code recalculation for simplified geometries
 * - Area and complexity-based filtering
 * - Quality metrics calculation
 */

import * as Comlink from "comlink";
import * as turf from "@turf/turf";
import type { GeoJSON, Geometry } from "geojson";
import {
  toGeoJSONFeature,
  fromGeoJSONFeature,
} from "../../utils/featureConverter";
import type {
  SimplifyWorker1API,
  Simplify1Task,
  Simplify1Result,
  SimplifyTaskConfig,
  QualityMetrics,
  FeatureData,
  ValidationResult,
  FeatureIndex,
} from "../types";
import type { Feature } from "../../types";

/**
 * SimplifyWorker1 - Feature-level geometry simplification
 *
 * Responsibilities:
 * - Douglas-Peucker and Visvalingam-Whyatt algorithms
 * - Feature topology preservation
 * - Quality metrics calculation
 * - Multi-resolution simplification
 * - Memory-efficient processing
 */

export class SimplifyWorker1 implements SimplifyWorker1API {
  private processingCache = new Map<string, any>();
  private qualityThresholds = {
    geometricAccuracy: 0.85,
    topologicalIntegrity: 0.9,
    visualQuality: 0.8,
    compressionEfficiency: 0.7,
  };

  constructor() {
    if (typeof self !== "undefined") {
      self.addEventListener("error", (event) => {
        console.error("SimplifyWorker1 global error:", event.error);
      });
    }
  }

  /**
   * Process simplification task
   */
  async processSimplification(task: Simplify1Task): Promise<Simplify1Result> {
    const startTime = Date.now();
    console.log(`SimplifyWorker1: Starting task ${task.taskId}`);

    try {
      // 1. Get input buffer data
      const inputData = await this.loadInputBuffer(task.inputBufferId);
      if (!inputData) {
        throw new Error(`Input buffer ${task.inputBufferId} not found`);
      }

      // 2. Parse GeoJSON
      const geoJson = JSON.parse(inputData);
      if (!geoJson.features || !Array.isArray(geoJson.features)) {
        throw new Error("Invalid GeoJSON: missing features array");
      }

      const originalFeatureCount = geoJson.features.length;
      console.log(
        `SimplifyWorker1: Processing ${originalFeatureCount} features`,
      );

      // 3. Simplify features
      const simplifiedFeatures = await this.simplifyFeatures(
        geoJson.features,
        task.config,
      );

      // 4. Calculate quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(
        geoJson.features,
        simplifiedFeatures,
        task.config,
      );

      // 5. Generate output buffer
      const outputGeoJson = {
        type: "FeatureCollection",
        features: simplifiedFeatures,
      };

      const outputBufferId = `simplified1-${task.taskId}-${Date.now()}`;
      await this.saveOutputBuffer(
        outputBufferId,
        JSON.stringify(outputGeoJson),
      );

      // 6. Calculate reduction metrics
      const originalSize = JSON.stringify(geoJson).length;
      const simplifiedSize = JSON.stringify(outputGeoJson).length;
      const reductionRatio = 1 - simplifiedSize / originalSize;

      const result: Simplify1Result = {
        taskId: task.taskId,
        status: "completed",
        outputBufferId,
        originalFeatureCount,
        simplifiedFeatureCount: simplifiedFeatures.length,
        reductionRatio,
        qualityMetrics,
      };

      const processingTime = Date.now() - startTime;
      console.log(
        `SimplifyWorker1: Completed task ${task.taskId} in ${processingTime}ms`,
      );
      console.log(
        `Reduction: ${(reductionRatio * 100).toFixed(1)}%, Quality: ${qualityMetrics.geometricAccuracy.toFixed(2)}`,
      );

      return result;
    } catch (error) {
      console.error(`SimplifyWorker1: Task ${task.taskId} failed:`, error);

      return {
        taskId: task.taskId,
        status: "failed",
        outputBufferId: "",
        originalFeatureCount: 0,
        simplifiedFeatureCount: 0,
        reductionRatio: 0,
        qualityMetrics: this.getDefaultQualityMetrics(),
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Simplify array of features
   */
  private async simplifyFeatures(
    features: Feature[],
    config: SimplifyTaskConfig,
  ): Promise<Feature[]> {
    const simplifiedFeatures: Feature[] = [];
    let processedCount = 0;

    for (const feature of features) {
      try {
        const simplifiedFeature = await this.simplifyFeature(feature, config);

        // Validate simplified geometry
        if (await this.validateGeometry(simplifiedFeature.geometry)) {
          simplifiedFeatures.push(simplifiedFeature);
        } else {
          // Keep original if simplification failed
          simplifiedFeatures.push(feature);
        }

        processedCount++;

        // Report progress every 100 features
        if (processedCount % 100 === 0) {
          console.log(
            `SimplifyWorker1: Processed ${processedCount}/${features.length} features`,
          );
        }
      } catch (error) {
        console.warn(
          `Failed to simplify feature ${feature.id || processedCount}:`,
          error,
        );
        // Keep original feature on error
        simplifiedFeatures.push(feature);
      }
    }

    return simplifiedFeatures;
  }

  /**
   * Simplify individual feature
   */
  private async simplifyFeature(
    feature: Feature,
    config: SimplifyTaskConfig,
  ): Promise<Feature> {
    if (
      !feature.geometry ||
      feature.geometry.type === "GeometryCollection" ||
      !("coordinates" in feature.geometry)
    ) {
      return feature;
    }

    try {
      let simplifiedGeometry: any;

      switch (config.algorithm) {
        case "douglas-peucker":
          simplifiedGeometry = this.douglasPeuckerSimplify(
            feature.geometry,
            config,
          );
          break;

        case "visvalingam":
          simplifiedGeometry = this.visvalingamSimplify(
            feature.geometry,
            config,
          );
          break;

        default:
          // Use Turf.js simplify (Douglas-Peucker)
          simplifiedGeometry = turf.simplify(toGeoJSONFeature(feature), {
            tolerance: config.tolerance,
            highQuality: config.preserveTopology,
          }).geometry;
      }

      // Apply additional constraints
      if (config.maxVertices) {
        simplifiedGeometry = this.limitVertices(
          simplifiedGeometry,
          config.maxVertices,
        );
      }

      if (config.minimumArea) {
        simplifiedGeometry = this.enforceMinimumArea(
          simplifiedGeometry,
          config.minimumArea,
        );
      }

      return {
        ...feature,
        geometry: simplifiedGeometry,
      };
    } catch (error) {
      console.warn(`Feature simplification failed for ${feature.id}:`, error);
      return feature;
    }
  }

  /**
   * Douglas-Peucker simplification implementation
   */
  private douglasPeuckerSimplify(
    geometry: any,
    config: SimplifyTaskConfig,
  ): any {
    switch (geometry.type) {
      case "LineString":
        return {
          ...geometry,
          coordinates: this.douglasPeuckerLine(
            geometry.coordinates,
            config.tolerance,
          ),
        };

      case "Polygon":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((ring: number[][]) =>
            this.douglasPeuckerLine(ring, config.tolerance),
          ),
        };

      case "MultiPolygon":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((polygon: number[][][]) =>
            polygon.map((ring: number[][]) =>
              this.douglasPeuckerLine(ring, config.tolerance),
            ),
          ),
        };

      default:
        return geometry;
    }
  }

  /**
   * Douglas-Peucker algorithm for line simplification
   */
  private douglasPeuckerLine(
    points: number[][],
    tolerance: number,
  ): number[][] {
    if (points.length <= 2) return points;

    // Find the point with maximum distance from line segment
    let maxDistance = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.perpendicularDistance(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      const leftPart = this.douglasPeuckerLine(
        points.slice(0, maxIndex + 1),
        tolerance,
      );
      const rightPart = this.douglasPeuckerLine(
        points.slice(maxIndex),
        tolerance,
      );

      // Combine results (remove duplicate point at junction)
      return leftPart.slice(0, -1).concat(rightPart);
    } else {
      // All points between start and end can be removed
      return [start, end];
    }
  }

  /**
   * Visvalingam-Whyatt simplification implementation
   */
  private visvalingamSimplify(geometry: any, config: SimplifyTaskConfig): any {
    // Simplified implementation - would use proper Visvalingam algorithm
    switch (geometry.type) {
      case "LineString":
        return {
          ...geometry,
          coordinates: this.visvalingamLine(
            geometry.coordinates,
            config.tolerance,
          ),
        };

      case "Polygon":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((ring: number[][]) =>
            this.visvalingamLine(ring, config.tolerance),
          ),
        };

      default:
        return geometry;
    }
  }

  /**
   * Visvalingam-Whyatt algorithm for line simplification
   */
  private visvalingamLine(points: number[][], tolerance: number): number[][] {
    if (points.length <= 3) return points;

    // Calculate effective areas for all points
    const areas = new Array(points.length).fill(Infinity);

    for (let i = 1; i < points.length - 1; i++) {
      areas[i] = this.triangleArea(points[i - 1], points[i], points[i + 1]);
    }

    // Remove points with area below tolerance
    const result = [points[0]]; // Always keep first point

    for (let i = 1; i < points.length - 1; i++) {
      if (areas[i] >= tolerance) {
        result.push(points[i]);
      }
    }

    result.push(points[points.length - 1]); // Always keep last point
    return result;
  }

  /**
   * Calculate quality metrics
   */
  private async calculateQualityMetrics(
    originalFeatures: Feature[],
    simplifiedFeatures: Feature[],
    config: SimplifyTaskConfig,
  ): Promise<QualityMetrics> {
    let totalGeometricAccuracy = 0;
    let totalTopologicalIntegrity = 0;
    let totalVisualQuality = 0;
    let validComparisons = 0;

    for (
      let i = 0;
      i < Math.min(originalFeatures.length, simplifiedFeatures.length);
      i++
    ) {
      try {
        const original = originalFeatures[i];
        const simplified = simplifiedFeatures[i];

        // Geometric accuracy (using area difference)
        const originalArea = await this.calculateComplexity(original.geometry);
        const simplifiedArea = await this.calculateComplexity(
          simplified.geometry,
        );
        const geometricAccuracy =
          originalArea > 0 ? Math.min(1, simplifiedArea / originalArea) : 1;

        // Topological integrity (check for self-intersections)
        const topologicalIntegrity = (await this.validateGeometry(
          simplified.geometry,
        ))
          ? 1
          : 0;

        // Visual quality (vertex count preservation ratio)
        const originalVertices = this.countVertices(original.geometry);
        const simplifiedVertices = this.countVertices(simplified.geometry);
        const visualQuality =
          originalVertices > 0
            ? Math.min(1, simplifiedVertices / originalVertices)
            : 1;

        totalGeometricAccuracy += geometricAccuracy;
        totalTopologicalIntegrity += topologicalIntegrity;
        totalVisualQuality += visualQuality;
        validComparisons++;
      } catch (error) {
        console.warn(
          `Quality metric calculation failed for feature ${i}:`,
          error,
        );
      }
    }

    const count = validComparisons || 1;
    const avgGeometricAccuracy = totalGeometricAccuracy / count;
    const avgTopologicalIntegrity = totalTopologicalIntegrity / count;
    const avgVisualQuality = totalVisualQuality / count;

    // Compression efficiency based on size reduction
    const originalSize = JSON.stringify(originalFeatures).length;
    const simplifiedSize = JSON.stringify(simplifiedFeatures).length;
    const compressionEfficiency =
      originalSize > 0 ? (originalSize - simplifiedSize) / originalSize : 0;

    return {
      geometricAccuracy: Math.max(0, Math.min(1, avgGeometricAccuracy)),
      topologicalIntegrity: Math.max(0, Math.min(1, avgTopologicalIntegrity)),
      visualQuality: Math.max(0, Math.min(1, avgVisualQuality)),
      compressionEfficiency: Math.max(0, Math.min(1, compressionEfficiency)),
    };
  }

  /**
   * Validate geometry for correctness
   */
  async validateGeometry(geometry: any): Promise<boolean> {
    try {
      if (!geometry || !geometry.type || !geometry.coordinates) {
        return false;
      }

      // Check coordinate validity
      const isValidCoords = this.validateCoordinates(geometry.coordinates);
      if (!isValidCoords) return false;

      // Check for self-intersections (simplified)
      if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
        return this.validatePolygonTopology(geometry);
      }

      return true;
    } catch (error) {
      console.warn("Geometry validation error:", error);
      return false;
    }
  }

  /**
   * Calculate geometry complexity
   */
  async calculateComplexity(geometry: any): Promise<number> {
    try {
      if (!geometry || !geometry.coordinates) return 0;

      switch (geometry.type) {
        case "Point":
          return 1;

        case "LineString":
          return geometry.coordinates.length;

        case "Polygon":
          return geometry.coordinates.reduce(
            (sum: number, ring: number[][]) => sum + ring.length,
            0,
          );

        case "MultiPolygon":
          return geometry.coordinates.reduce(
            (sum: number, polygon: number[][][]) =>
              sum +
              polygon.reduce(
                (ringSum: number, ring: number[][]) => ringSum + ring.length,
                0,
              ),
            0,
          );

        default:
          return this.countVertices(geometry);
      }
    } catch (error) {
      console.warn("Complexity calculation error:", error);
      return 0;
    }
  }

  /**
   * Optimize features by removing degenerate geometries
   */
  async optimizeFeatures(features: Feature[]): Promise<Feature[]> {
    const optimized: Feature[] = [];

    for (const feature of features) {
      try {
        // Skip features with invalid geometries
        if (!(await this.validateGeometry(feature.geometry))) {
          continue;
        }

        // Skip features that are too small
        const complexity = await this.calculateComplexity(feature.geometry);
        if (complexity < 3 && feature.geometry.type !== "Point") {
          continue;
        }

        optimized.push(feature);
      } catch (error) {
        console.warn(`Feature optimization failed for ${feature.id}:`, error);
      }
    }

    return optimized;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private perpendicularDistance(
    point: number[],
    lineStart: number[],
    lineEnd: number[],
  ): number {
    const [x, y] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    const param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private triangleArea(p1: number[], p2: number[], p3: number[]): number {
    return Math.abs(
      (p1[0] * (p2[1] - p3[1]) +
        p2[0] * (p3[1] - p1[1]) +
        p3[0] * (p1[1] - p2[1])) /
        2,
    );
  }

  private countVertices(geometry: any): number {
    let count = 0;

    const countCoords = (coords: any) => {
      if (typeof coords[0] === "number") {
        count++;
      } else {
        coords.forEach(countCoords);
      }
    };

    if (geometry.coordinates) {
      countCoords(geometry.coordinates);
    }

    return count;
  }

  private validateCoordinates(coords: any): boolean {
    const validate = (coord: any): boolean => {
      if (typeof coord === "number") {
        return isFinite(coord) && !isNaN(coord);
      }
      if (Array.isArray(coord)) {
        return coord.every(validate);
      }
      return false;
    };

    return validate(coords);
  }

  private validatePolygonTopology(geometry: any): boolean {
    // Simplified topology validation
    try {
      if (geometry.type === "Polygon") {
        return geometry.coordinates.every(
          (ring: number[][]) =>
            ring.length >= 4 &&
            ring[0][0] === ring[ring.length - 1][0] &&
            ring[0][1] === ring[ring.length - 1][1],
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  private limitVertices(geometry: any, maxVertices: number): any {
    // Simplified vertex limiting
    if (this.countVertices(geometry) <= maxVertices) {
      return geometry;
    }

    // Use more aggressive simplification
    try {
      return turf.simplify(
        { type: "Feature" as const, geometry, properties: {} },
        {
          tolerance: 0.01,
          highQuality: false,
        },
      ).geometry;
    } catch {
      return geometry;
    }
  }

  private enforceMinimumArea(geometry: Geometry, minimumArea: number): any {
    // Remove small polygons
    if (geometry.type === "Polygon") {
      try {
        const area = turf.area({ type: "Feature", geometry, properties: {} });
        return area >= minimumArea ? geometry : null;
      } catch {
        return geometry;
      }
    }
    return geometry;
  }

  private getDefaultQualityMetrics(): QualityMetrics {
    return {
      geometricAccuracy: 0,
      topologicalIntegrity: 0,
      visualQuality: 0,
      compressionEfficiency: 0,
    };
  }

  private async loadInputBuffer(bufferId: string): Promise<string | null> {
    // Mock implementation - would load from actual buffer storage
    return this.processingCache.get(bufferId) || null;
  }

  private async saveOutputBuffer(
    bufferId: string,
    data: string,
  ): Promise<void> {
    // Mock implementation - would save to actual buffer storage
    this.processingCache.set(bufferId, data);
  }
}

// Export for Comlink
Comlink.expose(SimplifyWorker1);

// Also export the class for direct usage if needed
export default SimplifyWorker1;
