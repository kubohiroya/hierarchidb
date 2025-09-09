import * as turf from '@turf/turf';
import { cellToBoundary, latLngToCell } from 'h3-js';
import type { Feature, FeatureCollection } from 'geojson';
import type {
  AnalysisResult,
  BufferAnalysis,
  ClusterAnalysis,
  DensityAnalysis,
  IntersectionAnalysis,
  NearestAnalysis,
  NetworkAnalysis,
  SpatialAnalysis,
} from '~/types/project-types';
import type { NodeId } from '@hierarchidb/common-type';

export class SpatialAnalysisEngine {
  /**
   * Execute a spatial analysis based on its configuration
   */
  async execute(
    analysis: SpatialAnalysis,
    inputData: Map<string, FeatureCollection>,
    projectEntityId: NodeId,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    let result: any;
    let errors: string[] = [];
    let warnings: string[] = [];

    try {
      switch (analysis.type) {
        case 'buffer':
          result = await this.executeBuffer(analysis.buffer!, inputData);
          break;
        case 'intersection':
          result = await this.executeIntersection(analysis.intersection!, inputData);
          break;
        case 'union':
          result = await this.executeUnion(inputData);
          break;
        //case 'difference':
        //result = await this.executeDifference(inputData);
        //break;
        case 'nearest':
          result = await this.executeNearest(analysis.nearest!, inputData);
          break;
        case 'cluster':
          result = await this.executeCluster(analysis.cluster!, inputData);
          break;
        case 'density':
          result = await this.executeDensity(analysis.density!, inputData);
          break;
        case 'network':
          result = await this.executeNetwork(analysis.network!, inputData);
          break;
        default:
          throw new Error(`Unknown analysis type: ${analysis.type}`);
      }

      return {
        id: crypto.randomUUID() as unknown as NodeId,
        projectEntityId,
        analysisId: analysis.id,
        analysisType: analysis.type,
        name: analysis.name,
        inputLayers: Array.from(inputData.keys()),
        parameters: this.extractParameters(analysis),
        result: {
          type: 'features',
          data: result,
          summary: this.generateSummary(result),
        },
        executedAt: Date.now(),
        executionTime: Date.now() - startTime,
        status: 'success',
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        outputLayerId: analysis.output.saveAsLayer ? `${analysis.id}-output` : undefined,
        cached: false,
      };
    } catch (error) {
      return {
        id: crypto.randomUUID() as unknown as NodeId,
        projectEntityId,
        analysisId: analysis.id,
        analysisType: analysis.type,
        name: analysis.name,
        inputLayers: Array.from(inputData.keys()),
        parameters: this.extractParameters(analysis),
        result: {
          type: 'features',
          data: null,
          summary: {},
        },
        executedAt: Date.now(),
        executionTime: Date.now() - startTime,
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        cached: false,
      };
    }
  }

  /**
   * Buffer Analysis - Create buffer zones around features
   */
  private async executeBuffer(
    config: BufferAnalysis,
    inputData: Map<string, FeatureCollection>,
  ): Promise<FeatureCollection> {
    const sourceData = inputData.get(config.sourceLayer);
    if (!sourceData) {
      throw new Error(`Source layer ${config.sourceLayer} not found`);
    }

    const buffered = sourceData.features
      .map((feature, index) => {
        const buffer = turf.buffer(feature, config.distance, {
          units: config.unit as any,
          steps: config.endCap === 'round' ? 64 : 8,
        });

        if (buffer && buffer.geometry) {
          buffer.properties = {
            ...feature.properties,
            _buffer_distance: config.distance,
            _buffer_unit: config.unit,
            _original_id: index,
          };
        }

        return buffer;
      })
      .filter(Boolean) as Feature[];

    // Dissolve if requested
    if (config.dissolve && buffered.length > 0) {
      const dissolved = buffered.reduce(
        (acc: Feature | undefined, curr) => {
          return acc ? (turf.union(acc as any, curr as any) as Feature) || curr : curr;
        },
        buffered[0] as Feature | undefined,
      );
      return {
        type: 'FeatureCollection',
        features: dissolved ? [dissolved as Feature] : [],
      };
    }

    return {
      type: 'FeatureCollection',
      features: buffered,
    };
  }

  /**
   * Intersection Analysis - Find overlapping areas
   */
  private async executeIntersection(
    config: IntersectionAnalysis,
    inputData: Map<string, FeatureCollection>,
  ): Promise<FeatureCollection> {
    const layer1 = inputData.get(config.layer1);
    const layer2 = inputData.get(config.layer2);

    if (!layer1 || !layer2) {
      throw new Error('Both input layers are required for intersection');
    }

    const intersections: Feature[] = [];

    for (const feature1 of layer1.features) {
      for (const feature2 of layer2.features) {
        try {
          let intersects = false;

          switch (config.spatialRelation) {
            case 'intersects':
              intersects = turf.booleanIntersects(feature1, feature2);
              break;
            case 'contains':
              intersects = turf.booleanContains(feature1, feature2);
              break;
            case 'within':
              intersects = turf.booleanWithin(feature1, feature2);
              break;
            case 'overlaps':
              intersects = turf.booleanOverlap(feature1, feature2);
              break;
          }

          if (intersects) {
            const intersection = turf.intersect(feature1 as any, feature2 as any);
            if (intersection) {
              // Merge properties based on config
              let properties: any = {};

              switch (config.outputFields) {
                case 'all':
                  properties = {
                    ...feature1.properties,
                    ...feature2.properties,
                  };
                  break;
                case 'layer1':
                  properties = { ...feature1.properties };
                  break;
                case 'layer2':
                  properties = { ...feature2.properties };
                  break;
              }

              intersection.properties = properties;
              intersections.push(intersection);
            }
          }
        } catch (err) {
          // Skip invalid geometries
          console.warn('Intersection failed for feature pair:', err);
        }
      }
    }

    return {
      type: 'FeatureCollection',
      features: intersections,
    };
  }

  /**
   * Union Analysis - Combine multiple features
   */
  private async executeUnion(
    inputData: Map<string, FeatureCollection>,
  ): Promise<FeatureCollection> {
    const allFeatures: Feature[] = [];

    inputData.forEach((collection) => {
      allFeatures.push(...collection.features);
    });

    if (allFeatures.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }

    try {
      const unioned = allFeatures.reduce(
        (acc: Feature | undefined, curr) => {
          return acc ? (turf.union(acc as any, curr as any) as Feature) || curr : curr;
        },
        allFeatures[0] as Feature | undefined,
      );
      return {
        type: 'FeatureCollection',
        features: unioned ? [unioned as Feature] : [],
      };
    } catch (err) {
      // If union fails, return original features
      return {
        type: 'FeatureCollection',
        features: allFeatures,
      };
    }
  }

  /**
   * Difference Analysis - Subtract one layer from another
   */

  /*
private async executeDifference(
  inputData: Map<string, FeatureCollection>
): Promise<FeatureCollection> {
  const layers = Array.from(inputData.values());
  if (layers.length < 2) {
    throw new Error('At least 2 layers required for difference analysis');
  }

  let result = layers[0]?.features?.[0];
  if (!result) {
    return { type: 'FeatureCollection', features: [] };
  }

  for (let i = 1; i < layers.length; i++) {
    //for (const feature of layers[i]?.features || []) {
    //for (const feature of layers[i]) {
      if (!layers[i]?.features) continue;
      try {
        if (!result) continue;
        const diff = turf.difference(result, feature);
        if (diff) {
          result = diff;
        }
      } catch (err) {
        console.warn('Difference operation failed:', err);
      }
    //}
  }

  return {
    type: 'FeatureCollection',
    features: result ? [result] : []
  };
}
   */

  /**
   * Nearest Neighbor Analysis
   */
  private async executeNearest(
    config: NearestAnalysis,
    inputData: Map<string, FeatureCollection>,
  ): Promise<FeatureCollection> {
    const fromLayer = inputData.get(config.fromLayer);
    const toLayer = inputData.get(config.toLayer);

    if (!fromLayer || !toLayer) {
      throw new Error('Both from and to layers are required');
    }

    const results: Feature[] = [];

    for (const fromFeature of fromLayer.features) {
      const fromPoint = turf.centroid(fromFeature);
      const nearest: Array<{ feature: Feature; distance: number }> = [];

      for (const toFeature of toLayer.features) {
        const toPoint = turf.centroid(toFeature);
        const distance = turf.distance(fromPoint, toPoint);

        if (!config.maxDistance || distance <= config.maxDistance) {
          nearest.push({ feature: toFeature, distance });
        }
      }

      // Sort by distance and take k nearest
      nearest.sort((a, b) => a.distance - b.distance);
      const kNearest = nearest.slice(0, config.k);

      // Create result features
      for (const item of kNearest) {
        if (config.outputLines) {
          // Create line from source to target
          const line = turf.lineString([
            fromPoint.geometry.coordinates,
            turf.centroid(item.feature).geometry.coordinates,
          ]);

          line.properties = {
            from_id: fromFeature.properties?.id,
            to_id: item.feature.properties?.id,
            distance: item.distance,
          };

          results.push(line);
        } else {
          // Just mark the nearest features
          const nearestFeature = { ...item.feature };
          nearestFeature.properties = {
            ...nearestFeature.properties,
            _nearest_from: fromFeature.properties?.id,
            _nearest_distance: item.distance,
            _nearest_rank: kNearest.indexOf(item) + 1,
          };
          results.push(nearestFeature);
        }
      }
    }

    return {
      type: 'FeatureCollection',
      features: results,
    };
  }

  /**
   * Cluster Analysis
   */
  private async executeCluster(
    config: ClusterAnalysis,
    inputData: Map<string, FeatureCollection>,
  ): Promise<FeatureCollection> {
    const layer = inputData.get(config.layer);
    if (!layer) {
      throw new Error(`Layer ${config.layer} not found`);
    }

    const points: number[][] = [];
    const features = layer.features;

    // Extract points
    for (const feature of features) {
      const centroid = turf.centroid(feature);
      points.push(centroid.geometry.coordinates);
    }

    let clusters: number[];

    switch (config.algorithm) {
      case 'k-means':
        clusters = await this.kMeansClustering(points, config.parameters.k || 5);
        break;
      case 'dbscan':
        clusters = await this.dbscanClustering(
          points,
          config.parameters.eps || 0.5,
          config.parameters.minPoints || 5,
        );
        break;
      case 'hierarchical':
        clusters = await this.hierarchicalClustering(points, config.parameters.k || 5);
        break;
      default:
        throw new Error(`Unknown clustering algorithm: ${config.algorithm}`);
    }

    // Assign cluster IDs to features
    const clusteredFeatures = features.map((feature, index) => {
      const clusteredFeature = { ...feature } as Feature;
      clusteredFeature.properties = {
        ...clusteredFeature.properties,
        _cluster_id: clusters[index],
        _cluster_algorithm: config.algorithm,
      };
      return clusteredFeature;
    });

    return {
      type: 'FeatureCollection',
      features: clusteredFeatures,
    };
  }

  /**
   * K-Means Clustering Implementation
   */
  private async kMeansClustering(points: number[][], k: number): Promise<number[]> {
    if (points.length === 0) return [];
    if (k >= points.length) return points.map((_, i) => i);

    // Initialize centroids randomly
    const centroids: number[][] = [];
    const used = new Set<number>();

    while (centroids.length < k) {
      const idx = Math.floor(Math.random() * points.length);
      if (!used.has(idx) && points[idx]) {
        centroids.push([...(points[idx] as number[])]);
        used.add(idx);
      }
    }

    const assignments = new Array(points.length).fill(0);
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 100) {
      changed = false;

      // Assign points to nearest centroid
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (!point) continue;

        let minDist = Infinity;
        let bestCluster = 0;

        for (let j = 0; j < k; j++) {
          const centroid = centroids[j];
          if (!centroid) continue;
          const dist = this.euclideanDistance(point, centroid);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = j;
          }
        }

        if ((assignments[i] ?? -1) !== bestCluster) {
          assignments[i] = bestCluster;
          changed = true;
        }
      }

      // Update centroids
      for (let j = 0; j < k; j++) {
        const clusterPoints = points.filter((_, i) => assignments[i] === j);
        if (clusterPoints.length > 0) {
          centroids[j] = [
            clusterPoints.reduce((sum, p) => sum + (p?.[0] ?? 0), 0) / clusterPoints.length,
            clusterPoints.reduce((sum, p) => sum + (p?.[1] ?? 0), 0) / clusterPoints.length,
          ];
        }
      }

      iterations++;
    }

    return assignments;
  }

  /**
   * DBSCAN Clustering Implementation
   */
  private async dbscanClustering(
    points: number[][],
    eps: number,
    minPoints: number,
  ): Promise<number[]> {
    const labels = new Array(points.length).fill(-1); // -1 = unvisited
    let clusterId = 0;

    for (let i = 0; i < points.length; i++) {
      if (labels[i] !== -1) continue; // Already processed

      const neighbors = this.getNeighbors(points, i, eps);

      if (neighbors.length < minPoints) {
        labels[i] = -2; // Mark as noise
      } else {
        this.expandCluster(points, labels, i, neighbors, clusterId, eps, minPoints);
        clusterId++;
      }
    }

    // Convert noise points to cluster -1
    return labels.map((label) => (label === -2 ? -1 : label));
  }

  private getNeighbors(points: number[][], pointIdx: number, eps: number): number[] {
    const neighbors: number[] = [];
    const point = points[pointIdx];
    if (!point) return neighbors;

    for (let i = 0; i < points.length; i++) {
      const otherPoint = points[i];
      if (i !== pointIdx && otherPoint && this.euclideanDistance(point, otherPoint) <= eps) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  private expandCluster(
    points: number[][],
    labels: number[],
    pointIdx: number,
    neighbors: number[],
    clusterId: number,
    eps: number,
    minPoints: number,
  ): void {
    labels[pointIdx] = clusterId;

    let i = 0;
    while (i < neighbors.length) {
      const neighborIdx = neighbors[i];
      if (neighborIdx === undefined) {
        i++;
        continue;
      }

      if ((labels[neighborIdx] ?? -1) === -1) {
        // Unvisited
        labels[neighborIdx] = clusterId;
        const newNeighbors = this.getNeighbors(points, neighborIdx, eps);

        if (newNeighbors.length >= minPoints) {
          // Add new neighbors to the list
          for (const idx of newNeighbors) {
            if (!neighbors.includes(idx)) {
              neighbors.push(idx);
            }
          }
        }
      } else if (labels[neighborIdx] === -2) {
        // Was noise, now part of cluster
        labels[neighborIdx] = clusterId;
      }

      i++;
    }
  }

  /**
   * Hierarchical Clustering Implementation (simplified)
   */
  private async hierarchicalClustering(points: number[][], k: number): Promise<number[]> {
    // Start with each point as its own cluster
    let clusters: number[][] = points.map((_, i) => [i]);

    while (clusters.length > k) {
      let minDist = Infinity;
      let merge = [-1, -1];

      // Find closest pair of clusters
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const cluster1 = clusters[i];
          const cluster2 = clusters[j];
          if (!cluster1 || !cluster2) continue;
          const dist = this.clusterDistance(points, cluster1, cluster2);
          if (dist < minDist) {
            minDist = dist;
            merge = [i, j];
          }
        }
      }

      // Merge closest clusters
      const mergeIdx0 = merge[0];
      const mergeIdx1 = merge[1];
      if (mergeIdx0 !== undefined && mergeIdx1 !== undefined && mergeIdx0 >= 0 && mergeIdx1 >= 0) {
        const cluster0 = clusters[mergeIdx0];
        const cluster1 = clusters[mergeIdx1];
        if (cluster0 && cluster1) {
          clusters[mergeIdx0] = [...cluster0, ...cluster1];
          clusters.splice(mergeIdx1, 1);
        }
      }
    }

    // Create assignment array
    const assignments = new Array(points.length);
    clusters.forEach((cluster, clusterIdx) => {
      cluster.forEach((pointIdx) => {
        assignments[pointIdx] = clusterIdx;
      });
    });

    return assignments;
  }

  private clusterDistance(points: number[][], cluster1: number[], cluster2: number[]): number {
    let totalDist = 0;
    let count = 0;

    for (const i of cluster1) {
      for (const j of cluster2) {
        const p1 = points[i];
        const p2 = points[j];
        if (p1 && p2) {
          totalDist += this.euclideanDistance(p1, p2);
          count++;
        }
      }
    }

    return count > 0 ? totalDist / count : Infinity;
  }

  /**
   * Density Analysis
   */
  private async executeDensity(
    config: DensityAnalysis,
    inputData: Map<string, FeatureCollection>,
  ): Promise<FeatureCollection> {
    const layer = inputData.get(config.layer);
    if (!layer) {
      throw new Error(`Layer ${config.layer} not found`);
    }

    // Create a grid
    const bbox = turf.bbox(layer);
    const grid = turf.squareGrid(bbox, config.cellSize / 1000, { units: 'kilometers' });

    // Calculate density for each cell
    grid.features.forEach((cell) => {
      let value = 0;

      for (const feature of layer.features) {
        const centroid = turf.centroid(feature);
        const distance = turf.distance(turf.centroid(cell), centroid, { units: 'meters' });

        if (distance <= config.radius) {
          // Kernel density function (Gaussian)
          const weight =
            config.weightField && feature.properties
              ? feature.properties[config.weightField] || 1
              : 1;

          if (config.type === 'kernel') {
            const kernel = Math.exp(-0.5 * Math.pow(distance / config.radius, 2));
            value += weight * kernel;
          } else {
            value += weight;
          }
        }
      }

      cell.properties = {
        density: value,
        radius: config.radius,
        cellSize: config.cellSize,
      };
    });

    return grid;
  }

  /**
   * Network Analysis (simplified)
   */
  private async executeNetwork(
    config: NetworkAnalysis,
    inputData: Map<string, FeatureCollection>,
  ): Promise<FeatureCollection> {
    const network = inputData.get(config.networkLayer);
    const facilities = inputData.get(config.facilityLayer);

    if (!network || !facilities) {
      throw new Error('Network and facility layers are required');
    }

    // This is a simplified implementation
    // Real network analysis would require graph construction and pathfinding
    const results: Feature[] = [];

    switch (config.analysisType) {
      case 'service-area':
        // Create service areas around facilities
        for (const facility of facilities.features) {
          if (!facility) continue;
          const serviceArea = turf.buffer(facility, config.cutoff || 1000, { units: 'meters' });

          if (serviceArea) {
            serviceArea.properties = {
              ...(facility.properties || {}),
              _service_area_radius: config.cutoff,
            };
            results.push(serviceArea);
          }
        }
        break;

      case 'shortest-path':
        // Simplified: create straight lines between facilities
        for (let i = 0; i < facilities.features.length - 1; i++) {
          const feature1 = facilities.features[i];
          const feature2 = facilities.features[i + 1];
          if (!feature1 || !feature2) continue;

          const from = turf.centroid(feature1);
          const to = turf.centroid(feature2);
          if (!from || !to) continue;

          const path = turf.lineString([from.geometry.coordinates, to.geometry.coordinates]);

          path.properties = {
            from_id: feature1.properties?.id,
            to_id: feature2.properties?.id,
            distance: turf.distance(from, to),
          };

          results.push(path);
        }
        break;

      case 'closest-facility':
        // Find closest facility for each network node
        for (const node of network.features) {
          const nodePoint = turf.centroid(node);
          let minDist = Infinity;
          let closestFacility = null;

          for (const facility of facilities.features) {
            const dist = turf.distance(nodePoint, turf.centroid(facility));
            if (dist < minDist) {
              minDist = dist;
              closestFacility = facility;
            }
          }

          if (closestFacility && nodePoint?.geometry?.coordinates) {
            const facilityCenter = turf.centroid(closestFacility);
            if (!facilityCenter?.geometry?.coordinates) continue;

            const connection = turf.lineString([
              nodePoint.geometry.coordinates,
              facilityCenter.geometry.coordinates,
            ]);

            connection.properties = {
              node_id: node.properties?.id,
              facility_id: closestFacility.properties?.id,
              distance: minDist,
            };

            results.push(connection);
          }
        }
        break;
    }

    return {
      type: 'FeatureCollection',
      features: results,
    };
  }

  /**
   * Helper Functions
   */
  private euclideanDistance(p1: number[], p2: number[]): number {
    if (!p1 || !p2 || p1.length < 2 || p2.length < 2) {
      return 0;
    }
    return Math.sqrt(
      Math.pow((p1[0] ?? 0) - (p2[0] ?? 0), 2) + Math.pow((p1[1] ?? 0) - (p2[1] ?? 0), 2),
    );
  }

  private extractParameters(analysis: SpatialAnalysis): Record<string, any> {
    const params: Record<string, any> = {
      type: analysis.type,
      name: analysis.name,
    };

    switch (analysis.type) {
      case 'buffer':
        return { ...params, ...analysis.buffer };
      case 'intersection':
        return { ...params, ...analysis.intersection };
      case 'nearest':
        return { ...params, ...analysis.nearest };
      case 'cluster':
        return { ...params, ...analysis.cluster };
      case 'density':
        return { ...params, ...analysis.density };
      case 'network':
        return { ...params, ...analysis.network };
      default:
        return params;
    }
  }

  private generateSummary(result: FeatureCollection): Record<string, any> {
    if (!result || !result.features) {
      return { featureCount: 0 };
    }

    const summary: Record<string, any> = {
      featureCount: result.features.length,
      geometryTypes: new Set(result.features.map((f) => f.geometry?.type)).size,
      bbox: turf.bbox(result),
    };

    // Calculate area/length statistics
    let totalArea = 0;
    let totalLength = 0;

    for (const feature of result.features) {
      if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') {
        totalArea += turf.area(feature);
      }
      if (feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString') {
        totalLength += turf.length(feature, { units: 'kilometers' });
      }
    }

    if (totalArea > 0) {
      summary.totalArea = totalArea;
      summary.averageArea = totalArea / result.features.length;
    }

    if (totalLength > 0) {
      summary.totalLength = totalLength;
      summary.averageLength = totalLength / result.features.length;
    }

    return summary;
  }

  /**
   * H3 Hexagon Grid Generation
   */
  async generateH3Grid(
    bbox: [number, number, number, number],
    resolution: number,
  ): Promise<FeatureCollection> {
    const features: Feature[] = [];
    const [minLng, minLat, maxLng, maxLat] = bbox;

    // Generate H3 hexagons covering the bbox
    const step = 0.01; // Approximate step size
    const hexagons = new Set<string>();

    for (let lat = minLat; lat <= maxLat; lat += step) {
      for (let lng = minLng; lng <= maxLng; lng += step) {
        const h3Index = latLngToCell(lat, lng, resolution);
        hexagons.add(h3Index);
      }
    }

    // Convert H3 indices to GeoJSON polygons
    hexagons.forEach((h3Index) => {
      const boundary = cellToBoundary(h3Index, true);
      if (!boundary || !Array.isArray(boundary)) return;

      const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
      if (coordinates.length > 0 && coordinates[0]) {
        coordinates.push(coordinates[0]); // Close the polygon
      }

      features.push({
        type: 'Feature',
        properties: {
          h3_index: h3Index,
          resolution,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      });
    });

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}
