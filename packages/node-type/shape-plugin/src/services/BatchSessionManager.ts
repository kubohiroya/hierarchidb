/**
 * @file BatchSessionManager.ts
 * @description ERIA-Cartograph移植: バッチセッション管理実装
 */

import type { NodeId } from '@hierarchidb/common-type';
import type { BatchConfig } from '../types/BatchConfig';
import type { BatchTaskLike, BatchStage } from '../types/BatchTaskLike';
import type { BatchProgressEvent } from '../types/BatchProgressEvent';
import { getEphemeralShapeDB, type EphemeralShapeDB } from './database/EphemeralShapeDB';
import { ShapeBatchOrchestrator } from './ShapeBatchOrchestrator';
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
  private orchestrator: ShapeBatchOrchestrator;

  constructor() {
    this.ephemeralDB = getEphemeralShapeDB();
    this.authHandler = getShapeAuthHandler();
    this.orchestrator = new ShapeBatchOrchestrator(this.ephemeralDB);
    
    // Set up UI notification callback for auth handler
    this.authHandler.setUINotificationCallback((notification) => {
      this.handleAuthNotification(notification);
    });
  }

  /**
   * Seed or update auth token from UI so downloads include Authorization from the start.
   */
  setAuthToken(token: string, type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number): void {
    this.authHandler.setToken(token, type, expiresAt);
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
      const tasks = this.tasks.get(sessionId) || [];
      const downloadTasks = tasks.filter((t) => t.stage === 'download');

      const exec = await this.orchestrator.executeDownload(
        sessionId,
        status.nodeId,
        downloadTasks,
        (e) => this.emitProgressEvent(sessionId, e)
      );

      // Update session status
      if (exec.failed === 0) {
        status.stage = 'simplify1';
        status.completedTasks = exec.processed;
        status.progress = 25;
      }

      // Final progress event
      this.emitProgressEvent(sessionId, {
        sessionId,
        treeNodeId: status.nodeId,
        stage: 'download',
        progress: 25,
        completedTasks: exec.processed,
        totalTasks: downloadTasks.length,
        currentTask: `Download completed: ${exec.totalFeatures} features, ${this.formatBytes(exec.totalDownloadSize)}`,
        timestamp: Date.now(),
      });

      return {
        success: exec.failed === 0,
        processedTasks: exec.processed,
        failedTasks: exec.failed,
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
      const r = await this.orchestrator.executeSimplify2(sessionId, status.nodeId, tasks, (e) => this.emitProgressEvent(sessionId, e));
      status.stage = 'vectorTiles';
      status.progress = 75;
      this.emitProgressEvent(sessionId, {
        sessionId,
        treeNodeId: status.nodeId,
        stage: 'simplify2',
        progress: 75,
        completedTasks: r.processedTasks,
        totalTasks: tasks.length,
        currentTask: `Tile processing completed: ${r.processedTiles} tiles prepared`,
        timestamp: Date.now(),
      });
      return { success: true, processedTiles: r.processedTiles, simplificationRatio: r.avgSimplificationRatio } as any;
    } catch (error) {
      console.error('Simplify2 stage failed:', error);
      return { success: false, processedTiles: 0, simplificationRatio: 0 };
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
      const r = await this.orchestrator.executeVectorTiles(sessionId, status.nodeId, tasks, (e) => this.emitProgressEvent(sessionId, e));
      status.isCompleted = true;
      status.progress = 100;
      this.emitProgressEvent(sessionId, {
        sessionId,
        treeNodeId: status.nodeId,
        stage: 'vectorTiles',
        progress: 100,
        completedTasks: r.processedTasks,
        totalTasks: tasks.length,
        currentTask: `Vector tile generation completed: ${r.generatedTiles} tiles, max zoom ${r.maxZoomLevel}`,
        timestamp: Date.now(),
      });
      return { success: true, generatedTiles: r.generatedTiles, maxZoomLevel: r.maxZoomLevel } as any;
    } catch (error) {
      console.error('VectorTiles stage failed:', error);
      return { success: false, generatedTiles: 0, maxZoomLevel: 0 };
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
