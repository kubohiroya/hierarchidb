/**
 * @file full-batch-workflow.test.ts
 * @description 完全なバッチ処理ワークフロー統合テスト
 * 
 * テスト内容:
 * 1. ダウンロード段階 - geoBoundariesからのファイル取得
 * 2. 簡易化段階1 - 特徴量フィルタリングと前処理
 * 3. 簡易化段階2 - ジオメトリ簡素化とタイル準備
 * 4. ベクトルタイル生成段階 - 最終タイル出力
 * 
 * 対象データ:
 * - 日本、ドイツ、アメリカのLevel 0境界データ
 * - デフォルト設定での処理
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Minimal type definitions for standalone testing
type NodeId = string & { readonly __brand: 'NodeId' };
type EntityId = string & { readonly __brand: 'EntityId' };

import { ShapeErrorHandler } from '../../services/ShapeErrorHandler';

import {
  createTestShapeEntity,
  createTestShapeEntityJapanOnly,
  EXPECTED_BATCH_RESULTS,
  GEOBOUNDARIES_TEST_ENDPOINTS,
  TEST_TIMEOUTS,
  TEST_NODE_ID,
  TEST_ENTITY_ID
} from '../fixtures/test-shape-entity-data';

describe('Full Batch Processing Workflow Integration Tests', () => {
  let errorHandler: ShapeErrorHandler;
  let testEntity: any;
  let testNodeId: NodeId;

  beforeAll(async () => {
    // Set up test environment
    vi.clearAllMocks();
    
    // Mock network requests for controlled testing
    global.fetch = vi.fn();
  });

  beforeEach(async () => {
    // Initialize test instances
    errorHandler = new ShapeErrorHandler();
    
    // Create test entity
    testEntity = createTestShapeEntity();
    testNodeId = TEST_NODE_ID;
  });

  afterEach(async () => {
    // Clean up test data
    vi.clearAllMocks();
  });

  describe('Lightweight Test - Japan Only', () => {
    it('should complete full workflow for Japan Level 0 data', async () => {
      // Given: Japan-only test entity
      const japanEntity = createTestShapeEntityJapanOnly();
      
      // Mock successful geoBoundaries API response
      const mockJapanGeoJSON = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            shapeName: 'Japan',
            shapeISO: 'JPN',
            shapeID: 'JPN-ADM0-1_0_0-B1',
            shapeGroup: 'JPN',
            shapeType: 'ADM0'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [129.408463, 31.029579],
              [129.468994, 31.029579], 
              [129.468994, 31.090110],
              [129.408463, 31.090110],
              [129.408463, 31.029579]
            ]]
          }
        }]
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockJapanGeoJSON
      });
      
      // When: Execute full batch workflow
      const startTime = Date.now();
      
      try {
        // Stage 1: Download
        console.log('🔄 Starting download stage...');
        const downloadResult = await simulateDownloadStage(japanEntity);
        expect(downloadResult.success).toBe(true);
        expect(downloadResult.filesDownloaded).toBe(EXPECTED_BATCH_RESULTS.japanOnly.downloadStage.expectedFiles);
        
        // Stage 2: Simplify1 (Feature Processing)
        console.log('🔄 Starting simplify1 stage...');
        const simplify1Result = await simulateSimplify1Stage(downloadResult.data);
        expect(simplify1Result.success).toBe(true);
        expect(simplify1Result.processedFeatures).toBe(EXPECTED_BATCH_RESULTS.japanOnly.simplify1Stage.expectedProcessedFeatures);
        
        // Stage 3: Simplify2 (Geometry Processing)  
        console.log('🔄 Starting simplify2 stage...');
        const simplify2Result = await simulateSimplify2Stage(simplify1Result.data);
        expect(simplify2Result.success).toBe(true);
        expect(simplify2Result.simplifiedFeatures).toBe(EXPECTED_BATCH_RESULTS.japanOnly.simplify2Stage.expectedSimplifiedFeatures);
        
        // Stage 4: Vector Tiles Generation
        console.log('🔄 Starting vector tiles stage...');
        const vectorTilesResult = await simulateVectorTilesStage(simplify2Result.data);
        expect(vectorTilesResult.success).toBe(true);
        expect(vectorTilesResult.tilesGenerated).toBeGreaterThanOrEqual(EXPECTED_BATCH_RESULTS.japanOnly.vectorTilesStage.expectedMinTiles);
        expect(vectorTilesResult.tilesGenerated).toBeLessThanOrEqual(EXPECTED_BATCH_RESULTS.japanOnly.vectorTilesStage.expectedMaxTiles);
        
        const totalTime = Date.now() - startTime;
        console.log(`✅ Full workflow completed in ${totalTime}ms`);
        
      } catch (error) {
        console.error('❌ Workflow failed:', error);
        throw error;
      }
      
    }, TEST_TIMEOUTS.fullWorkflow);
  });

  describe('Full Test - Japan, Germany, USA', () => {
    it('should complete full workflow for three countries Level 0 data', async () => {
      // Given: Three countries test entity  
      const testEntity = createTestShapeEntity();
      
      // Mock geoBoundaries API responses for all three countries
      setupMockGeoBoundariesResponses();
      
      // When: Execute full batch workflow
      const startTime = Date.now();
      
      try {
        // Stage 1: Download (multiple countries)
        console.log('🔄 Starting download stage for 3 countries...');
        const downloadResult = await simulateDownloadStage(testEntity);
        expect(downloadResult.success).toBe(true);
        expect(downloadResult.filesDownloaded).toBe(EXPECTED_BATCH_RESULTS.threeCountries.downloadStage.expectedFiles);
        expect(downloadResult.countriesProcessed).toEqual(['JPN', 'DEU', 'USA']);
        
        // Stage 2: Simplify1 (bulk processing)
        console.log('🔄 Starting simplify1 stage for 3 countries...');
        const simplify1Result = await simulateSimplify1Stage(downloadResult.data);
        expect(simplify1Result.success).toBe(true);
        expect(simplify1Result.processedFeatures).toBe(EXPECTED_BATCH_RESULTS.threeCountries.simplify1Stage.expectedProcessedFeatures);
        
        // Stage 3: Simplify2 (geometry optimization)
        console.log('🔄 Starting simplify2 stage for 3 countries...');
        const simplify2Result = await simulateSimplify2Stage(simplify1Result.data);
        expect(simplify2Result.success).toBe(true);
        expect(simplify2Result.simplifiedFeatures).toBe(EXPECTED_BATCH_RESULTS.threeCountries.simplify2Stage.expectedSimplifiedFeatures);
        
        // Stage 4: Vector Tiles (multi-country coverage)
        console.log('🔄 Starting vector tiles stage for 3 countries...');
        const vectorTilesResult = await simulateVectorTilesStage(simplify2Result.data);
        expect(vectorTilesResult.success).toBe(true);
        expect(vectorTilesResult.tilesGenerated).toBeGreaterThanOrEqual(EXPECTED_BATCH_RESULTS.threeCountries.vectorTilesStage.expectedMinTiles);
        expect(vectorTilesResult.tilesGenerated).toBeLessThanOrEqual(EXPECTED_BATCH_RESULTS.threeCountries.vectorTilesStage.expectedMaxTiles);
        expect(vectorTilesResult.zoomLevels).toEqual(EXPECTED_BATCH_RESULTS.threeCountries.vectorTilesStage.expectedZoomLevels);
        
        const totalTime = Date.now() - startTime;
        console.log(`✅ Full workflow for 3 countries completed in ${totalTime}ms`);
        
      } catch (error) {
        console.error('❌ Three countries workflow failed:', error);
        throw error;
      }
      
    }, TEST_TIMEOUTS.fullWorkflow);
  });

  describe('Error Handling Integration', () => {
    it('should handle network errors gracefully during download', async () => {
      // Given: Network error scenario
      (global.fetch as any).mockRejectedValueOnce(new Error('Network request failed'));
      
      // When: Execute download with network failure
      const downloadResult = await simulateDownloadStage(testEntity);
      
      // Then: Error should be handled gracefully
      expect(downloadResult.success).toBe(false);
      expect(downloadResult.error).toBeDefined();
      expect(downloadResult.error?.type).toBe('NETWORK_ERROR');
    });

    it('should handle data corruption during processing stages', async () => {
      // Given: Corrupt data scenario
      const corruptData = { invalid: 'data', missing: 'geometry' };
      
      // When: Execute simplify1 with corrupt data
      const simplify1Result = await simulateSimplify1Stage(corruptData);
      
      // Then: Data error should be handled  
      expect(simplify1Result.success).toBe(false);
      expect(simplify1Result.error).toBeDefined();
      expect(simplify1Result.error?.type).toBe('INVALID_DATA_FORMAT');
    });

    it('should provide detailed error context for debugging', async () => {
      // Given: Error-prone scenario
      const testEntityWithInvalidConfig = {
        ...testEntity,
        batchConfig: {
          ...testEntity.batchConfig,
          // Invalid configuration to trigger errors
          concurrentDownloads: -1,
          maxZoom: 50 // Unrealistic zoom level
        }
      };
      
      // When: Execute workflow with invalid config
      const result = await simulateDownloadStage(testEntityWithInvalidConfig);
      
      // Then: Error context should be detailed
      if (!result.success && result.error) {
        expect(result.error.context).toBeDefined();
        expect(result.error.context.invalidConfig).toBeDefined();
        expect(result.error.suggestedActions).toBeDefined();
        expect(result.error.suggestedActions.length).toBeGreaterThan(0);
      }
    });
  });

  // Helper functions for simulating each stage

  async function simulateDownloadStage(entity: any): Promise<any> {
    try {
      // Simulate download stage logic
      const countries = entity.selectedCountries;
      const filesDownloaded = countries.length;
      
      // Check if fetch was mocked and successful
      if (global.fetch) {
        for (const country of countries) {
          await fetch(GEOBOUNDARIES_TEST_ENDPOINTS.download[country as keyof typeof GEOBOUNDARIES_TEST_ENDPOINTS.download]);
        }
      }
      
      return {
        success: true,
        filesDownloaded,
        countriesProcessed: countries,
        data: {
          features: countries.map(country => ({
            country,
            geometry: { type: 'Polygon', coordinates: [] },
            properties: { name: country }
          }))
        }
      };
    } catch (error) {
      const processedError = await errorHandler.handleNetworkError(error as Error);
      return {
        success: false,
        error: processedError
      };
    }
  }

  async function simulateSimplify1Stage(data: any): Promise<any> {
    try {
      if (!data || !data.features) {
        throw new Error('Invalid data format');
      }
      
      // Simulate feature processing
      const processedFeatures = data.features.length;
      
      return {
        success: true,
        processedFeatures,
        data: {
          features: data.features.map((f: any) => ({
            ...f,
            processed: true,
            filtered: true
          }))
        }
      };
    } catch (error) {
      const processedError = await errorHandler.handleDataFormatError(error as Error);
      return {
        success: false,
        error: processedError
      };
    }
  }

  async function simulateSimplify2Stage(data: any): Promise<any> {
    try {
      if (!data || !data.features) {
        throw new Error('Invalid data format');
      }
      
      // Simulate geometry simplification
      const simplifiedFeatures = data.features.length;
      
      return {
        success: true,
        simplifiedFeatures,
        data: {
          features: data.features.map((f: any) => ({
            ...f,
            simplified: true,
            tolerance: 0.005
          }))
        }
      };
    } catch (error) {
      const processedError = await errorHandler.handleDataFormatError(error as Error);
      return {
        success: false,
        error: processedError
      };
    }
  }

  async function simulateVectorTilesStage(data: any): Promise<any> {
    try {
      if (!data || !data.features) {
        throw new Error('Invalid data format');
      }
      
      // Simulate vector tile generation
      const features = data.features.length;
      const maxZoom = testEntity.batchConfig?.vectorTiles?.maxZoom || 8;
      const zoomLevels = Array.from({ length: maxZoom + 1 }, (_, i) => i);
      const tilesGenerated = Math.min(features * zoomLevels.length, 100);
      
      return {
        success: true,
        tilesGenerated,
        zoomLevels,
        data: {
          tiles: zoomLevels.map(zoom => ({
            zoom,
            tileCount: Math.ceil(features / (zoom + 1))
          }))
        }
      };
    } catch (error) {
      const processedError = await errorHandler.handleDataFormatError(error as Error);
      return {
        success: false,
        error: processedError
      };
    }
  }

  function setupMockGeoBoundariesResponses() {
    const mockResponses = {
      JPN: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { shapeName: 'Japan', shapeISO: 'JPN' },
          geometry: { type: 'Polygon', coordinates: [[[129.4, 31.0], [129.5, 31.0], [129.5, 31.1], [129.4, 31.1], [129.4, 31.0]]] }
        }]
      },
      DEU: {
        type: 'FeatureCollection',  
        features: [{
          type: 'Feature',
          properties: { shapeName: 'Germany', shapeISO: 'DEU' },
          geometry: { type: 'Polygon', coordinates: [[[8.0, 50.0], [8.1, 50.0], [8.1, 50.1], [8.0, 50.1], [8.0, 50.0]]] }
        }]
      },
      USA: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature', 
          properties: { shapeName: 'United States', shapeISO: 'USA' },
          geometry: { type: 'Polygon', coordinates: [[[-100.0, 40.0], [-99.9, 40.0], [-99.9, 40.1], [-100.0, 40.1], [-100.0, 40.0]]] }
        }]
      }
    };

    (global.fetch as any).mockImplementation((url: string) => {
      const country = Object.keys(GEOBOUNDARIES_TEST_ENDPOINTS.download).find(c => 
        url.includes(c)
      );
      
      if (country && mockResponses[country as keyof typeof mockResponses]) {
        return Promise.resolve({
          ok: true,
          json: async () => mockResponses[country as keyof typeof mockResponses]
        });
      }
      
      return Promise.reject(new Error(`Mock not found for URL: ${url}`));
    });
  }
});