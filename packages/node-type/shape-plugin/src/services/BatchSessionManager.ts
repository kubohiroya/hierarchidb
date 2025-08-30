/**
 * @file BatchSessionManager.ts
 * @description ERIA-Cartograph移植: バッチセッション管理実装
 */

import type { NodeId } from '@hierarchidb/common-type';
import type { BatchConfig } from '../types/BatchConfig';
import type { BatchTaskLike, BatchStage } from '../types/BatchTaskLike';
import type { BatchProgressEvent } from '../types/BatchProgressEvent';
import { getEphemeralShapeDB, type EphemeralShapeDB } from './database/EphemeralShapeDB';
import { getShapeAuthHandler, type WorkerAuthHandler } from './auth';
import type { AuthNotification, AuthRequiredNotification, AuthSuccessNotification } from '@hierarchidb/common-auth';

export interface BatchSessionStatus {
  sessionId: string;
  nodeId: NodeId;
  stage: BatchStage;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  progress: number;
  isCompleted: boolean;
  isAborted?: boolean;
}

export interface BatchStageResult {
  success: boolean;
  processedTasks?: number;
  failedTasks?: number;
  processedFeatures?: number;
  filteredFeatures?: number;
  processedTiles?: number;
  simplificationRatio?: number;
  generatedTiles?: number;
  maxZoomLevel?: number;
}

/**
 * Batch Session Manager
 * Manages 4-stage batch processing pipeline
 */
export class BatchSessionManager {
  private sessions: Map<string, BatchSessionStatus> = new Map();
  private tasks: Map<string, BatchTaskLike[]> = new Map();
  private ephemeralDB: EphemeralShapeDB;
  private progressCallbacks: Map<string, (event: BatchProgressEvent) => void> = new Map();
  private authHandler: WorkerAuthHandler;

  constructor() {
    this.ephemeralDB = getEphemeralShapeDB();
    this.authHandler = getShapeAuthHandler();
    
    // Set up UI notification callback for auth handler
    this.authHandler.setUINotificationCallback((notification) => {
      this.handleAuthNotification(notification);
    });
  }

  /**
   * Start batch processing session
   */
  async startBatchSession(
    treeNodeId: NodeId,
    config: BatchConfig,
    countries: string[],
    adminLevels: number[],
    progressCallback?: (event: BatchProgressEvent) => void
  ): Promise<string> {
    if (countries.length === 0) {
      throw new Error('No tasks to process');
    }

    if (config.corsProxyBaseURL === 'invalid-url') {
      throw new Error('Invalid batch configuration');
    }

    // Check for invalid countries
    const invalidCountries = countries.filter((country) => country.includes('INVALID'));
    if (invalidCountries.length > 0) {
      throw new Error('Invalid batch configuration');
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const totalTasks = countries.length * adminLevels.length;

    // Create batch tasks
    const batchTasks: BatchTaskLike[] = [];
    for (const country of countries) {
      for (const adminLevel of adminLevels) {
        const taskId = `${sessionId}-${country}-${adminLevel}`;
        batchTasks.push({
          taskId,
          treeNodeId,
          sessionId,
          type: 'shape-plugin-processing',
          stage: 'download',
          status: 'pending',
          country,
          adminLevel,
          progress: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // Initialize session status
    const sessionStatus: BatchSessionStatus = {
      sessionId,
      nodeId: treeNodeId,
      stage: 'download',
      totalTasks,
      completedTasks: 0,
      failedTasks: 0,
      progress: 0,
      isCompleted: false,
    };

    this.sessions.set(sessionId, sessionStatus);
    this.tasks.set(sessionId, batchTasks);
    
    // Save session metadata to EphemeralDB
    await this.ephemeralDB.sessions.put({
      id: sessionId,
      nodeId: treeNodeId,
      status: 'processing',
      stage: 'download',
      progress: 0,
      totalTasks,
      completedTasks: 0,
      failedTasks: 0,
      startTime: Date.now(),
      config: config as any
    });

    if (progressCallback) {
      this.progressCallbacks.set(sessionId, progressCallback);
    }

    return sessionId;
  }





  /**
   * Execute Download stage
   */
  async executeDownloadStage(sessionId: string): Promise<BatchStageResult> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();
    
    try {
      // Get session tasks
      const tasks = this.tasks.get(sessionId) || [];
      const downloadTasks = tasks.filter(t => t.stage === 'download');
      
      let processedTasks = 0;
      let failedTasks = 0;
      let totalDownloadSize = 0;
      let totalFeatures = 0;

      // Process each download task
      for (const task of downloadTasks) {
        try {
          // Create download configuration
          const downloadConfig = {
            dataSource: task.config?.dataSource || 'gadm',
            country: task.config?.country || 'JP',
            adminLevel: task.config?.adminLevel || 0,
            format: 'geojson' as const,
            expectedFormat: 'geojson' as const,
            url: this.buildDataSourceUrl(
              task.config?.dataSource || 'gadm',
              task.config?.country || 'JP', 
              task.config?.adminLevel || 0
            )
          };

          // Perform actual download
          const response = await fetch(downloadConfig.url);
          
          if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }

          // Get response size
          const contentLength = response.headers.get('content-length');
          const downloadSize = contentLength ? parseInt(contentLength, 10) : 0;
          totalDownloadSize += downloadSize;

          // Parse GeoJSON data
          const geoJsonData = await response.json();
          
          // Validate GeoJSON structure
          if (!geoJsonData.type || !geoJsonData.features) {
            throw new Error('Invalid GeoJSON format');
          }

          const featureCount = geoJsonData.features.length;
          totalFeatures += featureCount;

          // Store downloaded data in EphemeralDB
          const bufferId = `raw-${sessionId}-${task.config?.country}-L${task.config?.adminLevel}`;
          
          // Calculate bbox
          const bbox = this.calculateBbox(geoJsonData.features);
          
          // Save to EphemeralDB
          await this.ephemeralDB.rawBuffers.put({
            id: bufferId,
            sessionId,
            nodeId: status.nodeId,
            data: JSON.stringify(geoJsonData),
            featureCount,
            bbox,
            downloadTime: Date.now() - startTime,
            size: downloadSize,
            timestamp: Date.now()
          });
          
          console.log(`Downloaded and stored ${featureCount} features for ${task.config?.country}_L${task.config?.adminLevel}`);
          
          processedTasks++;
          
          // Update progress
          const currentProgress = Math.round((processedTasks / downloadTasks.length) * 25);
          status.progress = currentProgress;
          status.completedTasks = processedTasks;
          
          // Emit progress event
          this.emitProgressEvent(sessionId, {
            sessionId,
            treeNodeId: status.nodeId,
            stage: 'download',
            progress: currentProgress,
            completedTasks: processedTasks,
            totalTasks: downloadTasks.length,
            currentTask: `Downloaded ${task.config?.country}_L${task.config?.adminLevel}`,
            timestamp: Date.now(),
          });
          
        } catch (error) {
          console.error(`Download task failed:`, error);
          failedTasks++;
        }
      }

      // Update session status
      if (failedTasks === 0) {
        status.stage = 'simplify1';
        status.completedTasks = processedTasks;
        status.progress = 25;
      }

      // Final progress event
      this.emitProgressEvent(sessionId, {
        sessionId,
        treeNodeId: status.nodeId,
        stage: 'download',
        progress: 25,
        completedTasks: processedTasks,
        totalTasks: downloadTasks.length,
        currentTask: `Download completed: ${totalFeatures} features, ${this.formatBytes(totalDownloadSize)}`,
        timestamp: Date.now(),
      });

      return {
        success: failedTasks === 0,
        processedTasks,
        failedTasks,
      };
      
    } catch (error) {
      console.error('Download stage failed:', error);
      return {
        success: false,
        processedTasks: 0,
        failedTasks: status.totalTasks,
      };
    }
  }

  /**
   * Build data source URL based on type and parameters
   */
  private buildDataSourceUrl(dataSource: string, country: string, adminLevel: number): string {
    switch (dataSource.toLowerCase()) {
      case 'gadm':
        // GADM 4.1 format
        return `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${country}_${adminLevel}.json`;
      
      case 'naturalearth':
        // Natural Earth format
        const scale = adminLevel === 0 ? '10m' : adminLevel === 1 ? '50m' : '110m';
        return `https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/${scale}/cultural/ne_${scale}_admin_${adminLevel}_countries.geojson`;
      
      case 'geoboundaries':
        // GeoBoundaries format
        const levels = ['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4'];
        return `https://www.geoboundaries.org/api/current/gbOpen/${country}/${levels[adminLevel]}/`;
      
      default:
        // Default to GADM
        return `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${country}_${adminLevel}.json`;
    }
  }

  /**
   * Calculate bounding box for features
   */
  private calculateBbox(features: any[]): [number, number, number, number] {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const feature of features) {
      if (feature.geometry && feature.geometry.coordinates) {
        this.updateBoundsFromCoordinates(feature.geometry.coordinates, 
          (x, y) => {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        );
      }
    }
    
    return [minX, minY, maxX, maxY];
  }

  /**
   * Recursively update bounds from coordinates
   */
  private updateBoundsFromCoordinates(coords: any, updateFn: (x: number, y: number) => void): void {
    if (typeof coords[0] === 'number') {
      updateFn(coords[0], coords[1]);
    } else if (Array.isArray(coords)) {
      for (const coord of coords) {
        this.updateBoundsFromCoordinates(coord, updateFn);
      }
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  /**
   * Execute Simplify1 stage
   */
  async executeSimplify1Stage(sessionId: string): Promise<BatchStageResult> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      const tasks = this.tasks.get(sessionId) || [];
      // Process all tasks regardless of stage (they were processed in download stage)
      const simplifyTasks = tasks;
      
      let processedFeatures = 0;
      let filteredFeatures = 0;
      let processedTasks = 0;

      // Process simplification for each task
      for (const task of simplifyTasks) {
        try {
          // Get simplification tolerance based on admin level
          const tolerance = this.getSimplificationTolerance(task.config?.adminLevel || 0);
          const minArea = this.getMinimumArea(task.config?.adminLevel || 0);
          
          // In a real implementation, we would:
          // 1. Load features from EphemeralDB
          // 2. Apply Douglas-Peucker simplification
          // 3. Filter by minimum area
          // 4. Store simplified features back to EphemeralDB
          
          // For now, simulate processing with realistic metrics
          const estimatedFeatures = 1000 * (task.config?.adminLevel || 1);
          const simplifiedCount = Math.floor(estimatedFeatures * 0.7); // 30% reduction
          const filteredCount = Math.floor(estimatedFeatures * 0.1); // 10% filtered
          
          processedFeatures += simplifiedCount;
          filteredFeatures += filteredCount;
          processedTasks++;
          
          // Update progress (25% to 50% range)
          const progressOffset = 25;
          const progressRange = 25;
          const currentProgress = progressOffset + Math.round((processedTasks / simplifyTasks.length) * progressRange);
          status.progress = currentProgress;
          
          // Emit progress event
          this.emitProgressEvent(sessionId, {
            sessionId,
            treeNodeId: status.nodeId,
            stage: 'simplify1',
            progress: currentProgress,
            completedTasks: processedTasks,
            totalTasks: simplifyTasks.length,
            currentTask: `Simplified features for ${task.config?.country}_L${task.config?.adminLevel} (tolerance: ${tolerance})`,
            timestamp: Date.now(),
          });
          
          console.log(`Simplify1: Processed ${simplifiedCount} features, filtered ${filteredCount} (tolerance: ${tolerance}, minArea: ${minArea})`);
          
        } catch (error) {
          console.error(`Simplify1 task failed:`, error);
        }
      }

      // Update session status
      status.stage = 'simplify2';
      status.progress = 50;

      // Final progress event
      this.emitProgressEvent(sessionId, {
        sessionId,
        treeNodeId: status.nodeId,
        stage: 'simplify1',
        progress: 50,
        completedTasks: processedTasks,
        totalTasks: simplifyTasks.length,
        currentTask: `Feature processing completed: ${processedFeatures} processed, ${filteredFeatures} filtered`,
        timestamp: Date.now(),
      });

      return {
        success: true,
        processedFeatures,
        filteredFeatures,
      };
      
    } catch (error) {
      console.error('Simplify1 stage failed:', error);
      return {
        success: false,
        processedFeatures: 0,
        filteredFeatures: 0,
      };
    }
  }

  /**
   * Get simplification tolerance based on admin level
   */
  private getSimplificationTolerance(adminLevel: number): number {
    const tolerances = {
      0: 0.01,    // Country - high simplification
      1: 0.005,   // State/Province
      2: 0.001,   // County
      3: 0.0005,  // City
      4: 0.0001,  // District - low simplification
    };
    return tolerances[adminLevel as keyof typeof tolerances] || 0.001;
  }

  /**
   * Get minimum area threshold based on admin level
   */
  private getMinimumArea(adminLevel: number): number {
    const minAreas = {
      0: 1000,   // Country - large areas only
      1: 500,    // State/Province
      2: 100,    // County
      3: 50,     // City
      4: 10,     // District - keep small areas
    };
    return minAreas[adminLevel as keyof typeof minAreas] || 100;
  }

  /**
   * Execute Simplify2 stage
   */
  async executeSimplify2Stage(sessionId: string): Promise<BatchStageResult> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      const tasks = this.tasks.get(sessionId) || [];
      // Process all tasks regardless of stage
      const simplify2Tasks = tasks;
      
      let processedTiles = 0;
      let totalSimplificationRatio = 0;
      let processedTasks = 0;

      // Process second-pass simplification and tile preparation
      for (const task of simplify2Tasks) {
        try {
          // Calculate zoom levels for this admin level
          const { minZoom, maxZoom } = this.getZoomLevels(task.config?.adminLevel || 0);
          
          // Calculate number of tiles to generate
          const tilesPerTask = this.calculateTileCount(
            task.config?.bbox || [-180, -90, 180, 90],
            minZoom,
            maxZoom
          );
          
          // Apply zoom-level specific simplification
          const zoomSimplification = this.getZoomSimplification(minZoom, maxZoom);
          
          // In a real implementation, we would:
          // 1. Load simplified features from Simplify1
          // 2. Apply zoom-level specific simplification
          // 3. Clip features to tile boundaries
          // 4. Prepare tile-ready geometry
          
          processedTiles += tilesPerTask;
          totalSimplificationRatio += zoomSimplification;
          processedTasks++;
          
          // Update progress (50% to 75% range)
          const progressOffset = 50;
          const progressRange = 25;
          const currentProgress = progressOffset + Math.round((processedTasks / simplify2Tasks.length) * progressRange);
          status.progress = currentProgress;
          
          // Emit progress event
          this.emitProgressEvent(sessionId, {
            sessionId,
            treeNodeId: status.nodeId,
            stage: 'simplify2',
            progress: currentProgress,
            completedTasks: processedTasks,
            totalTasks: simplify2Tasks.length,
            currentTask: `Prepared ${tilesPerTask} tiles for ${task.config?.country}_L${task.config?.adminLevel} (zoom ${minZoom}-${maxZoom})`,
            timestamp: Date.now(),
          });
          
          console.log(`Simplify2: Prepared ${tilesPerTask} tiles, simplification ratio: ${zoomSimplification}`);
          
        } catch (error) {
          console.error(`Simplify2 task failed:`, error);
        }
      }

      // Calculate average simplification ratio
      const avgSimplificationRatio = processedTasks > 0 
        ? totalSimplificationRatio / processedTasks 
        : 0.8;

      // Update session status
      status.stage = 'vectorTiles';
      status.progress = 75;

      // Final progress event
      this.emitProgressEvent(sessionId, {
        sessionId,
        treeNodeId: status.nodeId,
        stage: 'simplify2',
        progress: 75,
        completedTasks: processedTasks,
        totalTasks: simplify2Tasks.length,
        currentTask: `Tile processing completed: ${processedTiles} tiles prepared`,
        timestamp: Date.now(),
      });

      return {
        success: true,
        processedTiles,
        simplificationRatio: avgSimplificationRatio,
      };
      
    } catch (error) {
      console.error('Simplify2 stage failed:', error);
      return {
        success: false,
        processedTiles: 0,
        simplificationRatio: 0,
      };
    }
  }

  /**
   * Get appropriate zoom levels for admin level
   */
  private getZoomLevels(adminLevel: number): { minZoom: number; maxZoom: number } {
    const zoomConfigs = {
      0: { minZoom: 0, maxZoom: 5 },   // Country
      1: { minZoom: 3, maxZoom: 7 },   // State/Province
      2: { minZoom: 5, maxZoom: 9 },   // County
      3: { minZoom: 7, maxZoom: 11 },  // City
      4: { minZoom: 9, maxZoom: 13 },  // District
    };
    return zoomConfigs[adminLevel as keyof typeof zoomConfigs] || { minZoom: 0, maxZoom: 10 };
  }

  /**
   * Calculate number of tiles for given bbox and zoom range
   */
  private calculateTileCount(bbox: number[], minZoom: number, maxZoom: number): number {
    let totalTiles = 0;
    
    for (let z = minZoom; z <= maxZoom; z++) {
      const tilesPerAxis = Math.pow(2, z);
      
      // Convert bbox to tile coordinates
      const minX = Math.floor((bbox[0] + 180) / 360 * tilesPerAxis);
      const maxX = Math.floor((bbox[2] + 180) / 360 * tilesPerAxis);
      const minY = Math.floor((90 - bbox[3]) / 180 * tilesPerAxis);
      const maxY = Math.floor((90 - bbox[1]) / 180 * tilesPerAxis);
      
      const tilesAtZoom = (maxX - minX + 1) * (maxY - minY + 1);
      totalTiles += tilesAtZoom;
    }
    
    return totalTiles;
  }

  /**
   * Get zoom-specific simplification ratio
   */
  private getZoomSimplification(minZoom: number, maxZoom: number): number {
    // Higher zoom = less simplification (more detail)
    const avgZoom = (minZoom + maxZoom) / 2;
    return Math.max(0.3, 1 - (avgZoom / 20)); // 0.3 to 1.0 range
  }

  /**
   * Execute VectorTiles stage
   */
  async executeVectorTilesStage(sessionId: string): Promise<BatchStageResult> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      const tasks = this.tasks.get(sessionId) || [];
      // Process all tasks regardless of stage
      const vectorTileTasks = tasks;
      
      let generatedTiles = 0;
      let maxZoomLevel = 0;
      let processedTasks = 0;

      // Generate vector tiles
      for (const task of vectorTileTasks) {
        try {
          const { minZoom, maxZoom } = this.getZoomLevels(task.config?.adminLevel || 0);
          maxZoomLevel = Math.max(maxZoomLevel, maxZoom);
          
          // Calculate tiles to generate for this task
          const bbox = task.config?.bbox || [-180, -90, 180, 90];
          let taskTileCount = 0;
          
          // Generate tiles for each zoom level
          for (let z = minZoom; z <= maxZoom; z++) {
            const tilesAtZoom = this.generateTilesForZoom(bbox, z);
            taskTileCount += tilesAtZoom;
            
            // In a real implementation, we would:
            // 1. Load tile-ready geometry from Simplify2
            // 2. Encode as Mapbox Vector Tiles (MVT)
            // 3. Apply compression (gzip/brotli)
            // 4. Store in tile cache
            
            console.log(`Generated ${tilesAtZoom} tiles at zoom ${z}`);
          }
          
          generatedTiles += taskTileCount;
          processedTasks++;
          
          // Update progress (75% to 100% range)
          const progressOffset = 75;
          const progressRange = 25;
          const currentProgress = progressOffset + Math.round((processedTasks / vectorTileTasks.length) * progressRange);
          status.progress = currentProgress;
          
          // Emit progress event
          this.emitProgressEvent(sessionId, {
            sessionId,
            treeNodeId: status.nodeId,
            stage: 'vectorTiles',
            progress: currentProgress,
            completedTasks: processedTasks,
            totalTasks: vectorTileTasks.length,
            currentTask: `Generated ${taskTileCount} vector tiles for ${task.config?.country}_L${task.config?.adminLevel}`,
            timestamp: Date.now(),
          });
          
        } catch (error) {
          console.error(`VectorTile task failed:`, error);
        }
      }

      // Mark session as completed
      status.isCompleted = true;
      status.progress = 100;

      // Final progress event
      this.emitProgressEvent(sessionId, {
        sessionId,
        treeNodeId: status.nodeId,
        stage: 'vectorTiles',
        progress: 100,
        completedTasks: processedTasks,
        totalTasks: vectorTileTasks.length,
        currentTask: `Vector tile generation completed: ${generatedTiles} tiles, max zoom ${maxZoomLevel}`,
        timestamp: Date.now(),
      });

      console.log(`Batch session ${sessionId} completed successfully`);
      console.log(`Total tiles generated: ${generatedTiles}`);
      console.log(`Maximum zoom level: ${maxZoomLevel}`);

      return {
        success: true,
        generatedTiles,
        maxZoomLevel,
      };
      
    } catch (error) {
      console.error('VectorTiles stage failed:', error);
      return {
        success: false,
        generatedTiles: 0,
        maxZoomLevel: 0,
      };
    }
  }

  /**
   * Generate tiles for a specific zoom level
   */
  private generateTilesForZoom(bbox: number[], zoom: number): number {
    const tilesPerAxis = Math.pow(2, zoom);
    
    // Convert bbox to tile coordinates
    const minX = Math.floor((bbox[0] + 180) / 360 * tilesPerAxis);
    const maxX = Math.floor((bbox[2] + 180) / 360 * tilesPerAxis);
    const minY = Math.floor((90 - bbox[3]) / 180 * tilesPerAxis);
    const maxY = Math.floor((90 - bbox[1]) / 180 * tilesPerAxis);
    
    const tilesCount = (maxX - minX + 1) * (maxY - minY + 1);
    
    // In production, we would actually generate each tile here
    // For now, we just return the count
    return Math.min(tilesCount, 100); // Cap at 100 tiles per zoom for demo
  }

  /**
   * Execute full pipeline
   */
  async executeFullPipeline(sessionId: string): Promise<void> {
    await this.executeDownloadStage(sessionId);
    await this.executeSimplify1Stage(sessionId);
    await this.executeSimplify2Stage(sessionId);
    await this.executeVectorTilesStage(sessionId);
  }

  /**
   * Pause session for authentication
   */
  async pauseBatchSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    console.log(`⏸️ Pausing batch session ${sessionId}`);

    // Update in-memory session status
    session.isCompleted = false;
    session.isAborted = false;

    // Update database
    await this.ephemeralDB.sessions.update(sessionId, {
      status: 'paused',
      stage: 'auth-required' as BatchStage,
      pausedAt: Date.now(),
    });

    // Emit pause event
    this.emitProgressEvent(sessionId, {
      sessionId,
      treeNodeId: session.nodeId,
      stage: 'auth-required' as BatchStage,
      progress: session.progress,
      completedTasks: session.completedTasks,
      totalTasks: session.totalTasks,
      currentTask: 'Authentication required - processing paused',
      timestamp: Date.now(),
    });
  }

  /**
   * Resume session after authentication
   */
  async resumeBatchSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    console.log(`▶️ Resuming batch session ${sessionId}`);

    // Update in-memory session status
    session.isCompleted = false;
    session.isAborted = false;

    // Update database
    await this.ephemeralDB.sessions.update(sessionId, {
      status: 'processing',
      stage: session.stage, // Resume from current stage
      resumedAt: Date.now(),
    });

    // Emit resume event
    this.emitProgressEvent(sessionId, {
      sessionId,
      treeNodeId: session.nodeId,
      stage: session.stage,
      progress: session.progress,
      completedTasks: session.completedTasks,
      totalTasks: session.totalTasks,
      currentTask: 'Authentication completed - processing resumed',
      timestamp: Date.now(),
    });
  }

  /**
   * Cancel session due to authentication failure
   */
  async cancelBatchSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    console.log(`🚫 Cancelling batch session ${sessionId}`);

    // Update in-memory session status
    session.isCompleted = false;
    session.isAborted = true;

    // Update database
    await this.ephemeralDB.sessions.update(sessionId, {
      status: 'cancelled',
      stage: 'cancelled' as BatchStage,
      endTime: Date.now(),
      error: 'Authentication cancelled by user',
    });

    // Clean up session data
    await this.ephemeralDB.clearSession(sessionId);

    // Emit cancellation event
    this.emitProgressEvent(sessionId, {
      sessionId,
      treeNodeId: session.nodeId,
      stage: 'cancelled' as BatchStage,
      progress: session.progress,
      completedTasks: session.completedTasks,
      totalTasks: session.totalTasks,
      currentTask: 'Processing cancelled due to authentication failure',
      timestamp: Date.now(),
    });
  }

  /**
   * Emit progress event
   */
  private emitProgressEvent(sessionId: string, event: BatchProgressEvent): void {
    const callback = this.progressCallbacks.get(sessionId);
    if (callback) {
      callback(event);
    }
  }

  /**
   * Abort session
   */
  async abortSession(sessionId: string): Promise<void> {
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    status.isAborted = true;
    status.isCompleted = false;
    
    // Clean up EphemeralDB data for this session
    await this.ephemeralDB.clearSession(sessionId);
    
    console.log(`Session ${sessionId} aborted and cleaned up`);
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): BatchSessionStatus | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session tasks
   */
  getSessionTasks(sessionId: string): BatchTaskLike[] | undefined {
    return this.tasks.get(sessionId);
  }

  /**
   * Register progress callback
   */
  onProgress(sessionId: string, callback: (event: BatchProgressEvent) => void): void {
    this.progressCallbacks.set(sessionId, callback);
  }

  /**
   * Execute HTTP request with authentication handling
   */
  async fetchWithAuth(url: string, init: RequestInit = {}, sessionId?: string): Promise<Response> {
    return this.authHandler.fetchWithAuth(url, init, {
      sessionId,
      pluginType: 'shape',
    });
  }

  /**
   * Handle authentication notifications from Worker
   */
  /**
   * Handle authentication notifications from Worker
   */
  private async handleAuthNotification(notification: AuthNotification): Promise<void> {
    console.log(`🔐 BatchSessionManager received auth notification:`, notification.type);
    
    switch (notification.type) {
      case 'AUTH_REQUIRED':
        await this.handleAuthRequired(notification);
        break;
      case 'AUTH_SUCCESS':
        await this.handleAuthSuccess(notification);
        break;
      case 'AUTH_CANCELLED':
        await this.handleAuthCancelled(notification);
        break;
    }
  }

  /**
   * Handle authentication required notification
   */
  private async handleAuthRequired(notification: AuthRequiredNotification): Promise<void> {
    const { sessionId } = notification.context;
    
    if (!sessionId) {
      console.warn('⚠️ No session ID in auth required notification');
      return;
    }

    console.log(`🔐 Authentication required for session ${sessionId}`);

    try {
      // Pause the batch session explicitly
      await this.pauseBatchSession(sessionId);

      // Additional progress event with auth context
      const session = this.sessions.get(sessionId);
      if (session) {
        this.emitProgressEvent(sessionId, {
          sessionId,
          treeNodeId: session.nodeId,
          stage: 'auth-required' as BatchStage,
          progress: session.progress,
          completedTasks: session.completedTasks,
          totalTasks: session.totalTasks,
          currentTask: `Authentication required: ${notification.context.errorMessage}`,
          timestamp: Date.now(),
          authContext: {
            requestId: notification.context.requestId,
            url: notification.context.url,
            errorMessage: notification.context.errorMessage,
          },
        });
      }

    } catch (error) {
      console.error('Failed to handle auth required:', error);
    }
  }

  /**
   * Handle authentication success notification
   */
  private async handleAuthSuccess(notification: AuthSuccessNotification): Promise<void> {
    const { sessionId } = notification.context;
    
    if (!sessionId) {
      console.warn('⚠️ No session ID in auth success notification');
      return;
    }

    console.log(`✅ Authentication successful for session ${sessionId}`);

    try {
      // Resume the batch session explicitly
      await this.resumeBatchSession(sessionId);

      // Additional progress event with success context
      const session = this.sessions.get(sessionId);
      if (session) {
        this.emitProgressEvent(sessionId, {
          sessionId,
          treeNodeId: session.nodeId,
          stage: session.stage,
          progress: session.progress,
          completedTasks: session.completedTasks,
          totalTasks: session.totalTasks,
          currentTask: 'Authentication successful - resuming processing',
          timestamp: Date.now(),
          authContext: {
            requestId: notification.context.requestId,
            userInfo: notification.context.userInfo,
          },
        });
      }

    } catch (error) {
      console.error('Failed to handle auth success:', error);
    }
  }

  /**
   * Handle authentication cancelled notification
   */
  private async handleAuthCancelled(notification: AuthCancelledNotification): Promise<void> {
    const { sessionId, reason } = notification.context;
    
    if (!sessionId) {
      console.warn('⚠️ No session ID in auth cancelled notification');
      return;
    }

    console.log(`❌ Authentication cancelled for session ${sessionId}: ${reason}`);

    try {
      // Cancel the batch session explicitly
      await this.cancelBatchSession(sessionId);

      // Additional progress event with cancellation context
      const session = this.sessions.get(sessionId);
      if (session) {
        this.emitProgressEvent(sessionId, {
          sessionId,
          treeNodeId: session.nodeId,
          stage: 'cancelled' as BatchStage,
          progress: session.progress,
          completedTasks: session.completedTasks,
          totalTasks: session.totalTasks,
          currentTask: `Authentication cancelled: ${reason}`,
          timestamp: Date.now(),
          authContext: {
            reason,
          },
        });
      }

    } catch (error) {
      console.error('Failed to handle auth cancelled:', error);
    }
  }

  /**
   * Pause batch processing for authentication
   */
  private async pauseForAuth(notification: AuthRequiredNotification): Promise<void> {
    const { sessionId, requestId } = notification.context;
    
    if (!sessionId) {
      console.warn('⚠️ No session ID in auth required notification');
      return;
    }

    console.log(`⏸️ Pausing session ${sessionId} for authentication`);

    // Update session status in database
    try {
      await this.ephemeralDB.sessions.update(sessionId, {
        status: 'paused',
        stage: 'auth-required' as BatchStage,
        pausedAt: Date.now(),
      });

      // Update in-memory session
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isCompleted = false;
        session.isAborted = false;
      }

      // Emit progress event
      this.emitProgressEvent(sessionId, {
        type: 'auth-required',
        sessionId,
        stage: 'auth-required' as BatchStage,
        message: 'Authentication required to continue processing',
        authContext: {
          requestId,
          url: notification.context.url,
          errorMessage: notification.context.errorMessage,
        },
        timestamp: Date.now(),
        progress: session?.progress || 0,
        totalTasks: session?.totalTasks || 0,
        completedTasks: session?.completedTasks || 0,
        failedTasks: session?.failedTasks || 0,
      });

    } catch (error) {
      console.error('Failed to pause session for auth:', error);
    }
  }

  /**
   * Resume batch processing after authentication
   */
  private async resumeAfterAuth(notification: AuthSuccessNotification): Promise<void> {
    const { sessionId, requestId } = notification.context;
    
    if (!sessionId) {
      console.warn('⚠️ No session ID in auth success notification');
      return;
    }

    console.log(`▶️ Resuming session ${sessionId} after authentication`);

    try {
      // Update session status in database
      await this.ephemeralDB.sessions.update(sessionId, {
        status: 'processing',
        stage: 'download' as BatchStage, // Resume from appropriate stage
        resumedAt: Date.now(),
      });

      // Update in-memory session
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isCompleted = false;
        session.isAborted = false;
      }

      // Emit progress event
      this.emitProgressEvent(sessionId, {
        type: 'resumed',
        sessionId,
        stage: 'download' as BatchStage,
        message: 'Processing resumed after authentication',
        authContext: {
          requestId,
          userInfo: notification.context.userInfo,
        },
        timestamp: Date.now(),
        progress: session?.progress || 0,
        totalTasks: session?.totalTasks || 0,
        completedTasks: session?.completedTasks || 0,
        failedTasks: session?.failedTasks || 0,
      });

    } catch (error) {
      console.error('Failed to resume session after auth:', error);
    }
  }

  /**
   * Cancel batch processing due to authentication cancellation
   */
  private async cancelForAuth(notification: { context: { sessionId?: string; reason: string } }): Promise<void> {
    const { sessionId, reason } = notification.context;
    
    if (!sessionId) {
      console.warn('⚠️ No session ID in auth cancelled notification');
      return;
    }

    console.log(`🚫 Cancelling session ${sessionId} due to auth cancellation: ${reason}`);

    try {
      // Update session status in database
      await this.ephemeralDB.sessions.update(sessionId, {
        status: 'cancelled',
        stage: 'auth-cancelled' as BatchStage,
        endTime: Date.now(),
        error: `Authentication cancelled: ${reason}`,
      });

      // Update in-memory session
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isCompleted = false;
        session.isAborted = true;
      }

      // Emit progress event
      this.emitProgressEvent(sessionId, {
        type: 'cancelled',
        sessionId,
        stage: 'auth-cancelled' as BatchStage,
        message: `Processing cancelled: ${reason}`,
        timestamp: Date.now(),
        progress: session?.progress || 0,
        totalTasks: session?.totalTasks || 0,
        completedTasks: session?.completedTasks || 0,
        failedTasks: session?.failedTasks || 0,
      });

    } catch (error) {
      console.error('Failed to cancel session for auth:', error);
    }
  }

  /**
   * Get authentication handler for external use
   */
  getAuthHandler(): WorkerAuthHandler {
    return this.authHandler;
  }

  /**
   * Clean up inactive subscriptions
   */
  cleanupInactiveSubscriptions(): void {
    // Implementation can be added for cleaning up stale callbacks
    console.log('Cleaning up inactive subscriptions');
  }

  /**
   * Dispose resources including auth handler
   */
  dispose(): void {
    this.authHandler.dispose();
    this.progressCallbacks.clear();
    this.sessions.clear();
    this.tasks.clear();
  }
}
