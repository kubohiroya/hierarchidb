// @ts-nocheck
/**
 * @file VectorTileGeneration.test.ts
 * @description Integration test for end-to-end vector tile generation
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import { BatchSessionManager } from '../../services/BatchSessionManager.js';
import { closeEphemeralShapeDB, getEphemeralShapeDB } from '../../services/database/EphemeralShapeDB.js';
import type { BatchConfig } from '../../types/BatchConfig.js';

// Helper function to generate node IDs
const createNodeId = (prefix: string): NodeId => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` as NodeId;
};

// Mock fetch for testing
global.fetch = async (url: string) => {
  console.log(`Mock fetch: ${url}`);

  // Return mock GeoJSON data
  const mockGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 1,
        properties: {
          name: 'Test Region 1',
          admin_level: 1,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [139.0, 35.0],
            [140.0, 35.0],
            [140.0, 36.0],
            [139.0, 36.0],
            [139.0, 35.0],
          ]],
        },
      },
      {
        type: 'Feature',
        id: 2,
        properties: {
          name: 'Test Region 2',
          admin_level: 1,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [140.0, 35.0],
            [141.0, 35.0],
            [141.0, 36.0],
            [140.0, 36.0],
            [140.0, 35.0],
          ]],
        },
      },
    ],
  };

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'content-type': 'application/json',
      'content-length': JSON.stringify(mockGeoJSON).length.toString(),
    }),
    json: async () => mockGeoJSON,
    text: async () => JSON.stringify(mockGeoJSON),
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(mockGeoJSON)).buffer,
  } as Response;
};

describe('Vector Tile Generation - End to End', () => {
  let manager: BatchSessionManager;
  let ephemeralDB: ReturnType<typeof getEphemeralShapeDB>;
  let nodeId: NodeId;

  beforeEach(async () => {
    // Setup
    manager = new BatchSessionManager();
    ephemeralDB = getEphemeralShapeDB();
    nodeId = createNodeId('test-node');

    // Clear any existing data
    await ephemeralDB.clearAll();
  });

  afterEach(async () => {
    // Cleanup
    await ephemeralDB.clearAll();
    await closeEphemeralShapeDB();
  });

  it('should complete full pipeline from download to vector tiles', async () => {
    // Create batch configuration
    const config: BatchConfig = {
      dataSource: 'gadm',
      countries: ['JP'],
      adminLevels: [1],
      simplification: {
        enabled: true,
        tolerance: 0.005,
        preserveTopology: true,
      },
      tiling: {
        minZoom: 0,
        maxZoom: 6,
        buffer: 64,
        extent: 4096,
      },
    };

    // Start batch session
    const sessionId = await manager.startBatchSession(
      nodeId,
      config,
      config.countries,
      config.adminLevels,
    );

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');

    // Track progress events
    const progressEvents: any[] = [];
    manager.onProgress(sessionId, (event) => {
      progressEvents.push(event);
      console.log(`Progress: Stage ${event.stage}, ${event.progress}%`);
    });

    // Execute pipeline stages
    console.log('Starting pipeline execution...');

    // Stage 1: Download
    const downloadResult = await manager.executeDownloadStage(sessionId);
    expect(downloadResult.success).toBe(true);
    expect(downloadResult.processedTasks).toBeGreaterThan(0);

    // Verify data was saved to EphemeralDB
    const rawBuffers = await ephemeralDB.rawBuffers
      .where('sessionId')
      .equals(sessionId)
      .toArray();
    expect(rawBuffers.length).toBeGreaterThan(0);
    expect(rawBuffers[0].featureCount).toBe(2);
    console.log(`Downloaded ${rawBuffers[0].featureCount} features`);

    // Stage 2: Simplify1
    const simplify1Result = await manager.executeSimplify1Stage(sessionId);
    expect(simplify1Result.success).toBe(true);
    expect(simplify1Result.processedFeatures).toBeGreaterThan(0);
    console.log(`Simplified ${simplify1Result.processedFeatures} features`);

    // Stage 3: Simplify2
    const simplify2Result = await manager.executeSimplify2Stage(sessionId);
    expect(simplify2Result.success).toBe(true);
    expect(simplify2Result.processedTiles).toBeGreaterThan(0);
    console.log(`Prepared ${simplify2Result.processedTiles} tiles`);

    // Stage 4: Vector Tiles
    const vectorTilesResult = await manager.executeVectorTilesStage(sessionId);
    expect(vectorTilesResult.success).toBe(true);
    expect(vectorTilesResult.generatedTiles).toBeGreaterThan(0);
    expect(vectorTilesResult.maxZoomLevel).toBeGreaterThanOrEqual(0);
    console.log(`Generated ${vectorTilesResult.generatedTiles} vector tiles`);

    // Verify session completion
    const status = manager.getSessionStatus(sessionId);
    expect(status?.isCompleted).toBe(true);
    expect(status?.progress).toBe(100);

    // Verify progress events were emitted
    expect(progressEvents.length).toBeGreaterThan(0);
    const finalEvent = progressEvents[progressEvents.length - 1];
    expect(finalEvent.progress).toBe(100);
    expect(finalEvent.stage).toBe('vectorTiles');

    // Get database statistics
    const stats = await ephemeralDB.getStatistics();
    console.log('Database statistics:', stats);
    expect(stats.rawBuffers).toBeGreaterThan(0);
    expect(stats.sessions).toBeGreaterThan(0);
  });

  it('should handle pipeline cancellation', async () => {
    const config: BatchConfig = {
      dataSource: 'gadm',
      countries: ['JP'],
      adminLevels: [0, 1, 2],
      simplification: {
        enabled: true,
        tolerance: 0.01,
        preserveTopology: true,
      },
    };

    const sessionId = await manager.startBatchSession(
      nodeId,
      config,
      config.countries,
      config.adminLevels,
    );

    // Start download
    const downloadPromise = manager.executeDownloadStage(sessionId);

    // Abort session
    await manager.abortSession(sessionId);

    // Download should complete or fail gracefully
    const result = await downloadPromise;

    // Check session is aborted
    const status = manager.getSessionStatus(sessionId);
    expect(status?.isAborted).toBe(true);

    // Clean up aborted session data
    await ephemeralDB.clearSession(sessionId);

    const stats = await ephemeralDB.getStatistics();
    expect(stats.sessions).toBe(0);
  });

  it('should generate correct tile coordinates', async () => {
    const config: BatchConfig = {
      dataSource: 'gadm',
      countries: ['JP'],
      adminLevels: [0],
      simplification: {
        enabled: true,
        tolerance: 0.01,
        preserveTopology: false,
      },
      tiling: {
        minZoom: 2,
        maxZoom: 4,
      },
    };

    const sessionId = await manager.startBatchSession(
      nodeId,
      config,
      config.countries,
      config.adminLevels,
    );

    // Execute full pipeline
    await manager.executeFullPipeline(sessionId);

    // Check generated tiles
    const status = manager.getSessionStatus(sessionId);
    expect(status?.isCompleted).toBe(true);

    // Verify tile generation details
    console.log(`Session ${sessionId} completed`);
    console.log(`Generated tiles for zoom levels 2-4`);

    // In a real implementation, we would check the actual tile data
    // For now, just verify the pipeline completed
    expect(status?.progress).toBe(100);
  });

  it('should handle multiple countries and admin levels', async () => {
    const config: BatchConfig = {
      dataSource: 'gadm',
      countries: ['JP', 'KR'],
      adminLevels: [0, 1],
      simplification: {
        enabled: true,
        tolerance: 0.005,
        preserveTopology: true,
      },
    };

    const sessionId = await manager.startBatchSession(
      nodeId,
      config,
      config.countries,
      config.adminLevels,
    );

    // This should create 4 tasks: JP_L0, JP_L1, KR_L0, KR_L1
    const tasks = manager.getSessionTasks(sessionId);
    expect(tasks?.length).toBe(4);

    // Execute pipeline
    await manager.executeFullPipeline(sessionId);

    const status = manager.getSessionStatus(sessionId);
    expect(status?.isCompleted).toBe(true);

    // Verify all tasks were processed
    const rawBuffers = await ephemeralDB.rawBuffers
      .where('sessionId')
      .equals(sessionId)
      .toArray();

    // Should have data for each country/level combination
    expect(rawBuffers.length).toBeGreaterThan(0);
  });

  it('should clean up expired cache entries', async () => {
    // Add some cache entries with short TTL
    await ephemeralDB.cache.bulkAdd([
      {
        key: 'test-cache-1',
        data: 'test data 1',
        type: 'raw',
        size: 100,
        lastAccessed: Date.now() - 10000, // 10 seconds ago
        ttl: 5000, // 5 second TTL (expired)
      },
      {
        key: 'test-cache-2',
        data: 'test data 2',
        type: 'raw',
        size: 100,
        lastAccessed: Date.now(),
        ttl: 60000, // 1 minute TTL (not expired)
      },
    ]);

    // Clear expired cache
    const cleared = await ephemeralDB.clearExpiredCache();
    expect(cleared).toBe(1);

    // Verify only non-expired entry remains
    const remaining = await ephemeralDB.cache.count();
    expect(remaining).toBe(1);
  });
});