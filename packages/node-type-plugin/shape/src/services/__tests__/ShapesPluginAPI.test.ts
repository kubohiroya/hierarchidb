/**
 * ShapesPluginAPI Integration Tests
 *
 * Tests for the main plugin API integration with PluginAPI
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NodeId } from "@hierarchidb/common-core";
import { ShapesPluginAPI } from "../ShapesPluginAPI";
import type { BatchProcessConfig, DataSourceInfo } from "../types";

describe("ShapesPluginAPI", () => {
  let api: ShapesPluginAPI;
  let mockPluginAPI: any;

  beforeEach(() => {
    // Mock PluginAPI
    mockPluginAPI = {
      getWorkerAPI: vi.fn().mockReturnValue({
        executeCommand: vi.fn(),
        query: vi.fn(),
        subscribe: vi.fn(),
      }),
      getDatabase: vi.fn().mockReturnValue({
        shapes: {
          add: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
          update: vi.fn(),
        },
        batchTasks: {
          add: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
          update: vi.fn(),
        },
      }),
      createWorkingCopy: vi.fn(),
      commitWorkingCopy: vi.fn(),
      discardWorkingCopy: vi.fn(),
    };

    api = new ShapesPluginAPI(); // mockPluginAPI
  });

  describe("batch processing", () => {
    it("should start batch process successfully", async () => {
      // Arrange
      const nodeId: NodeId = "node-123" as NodeId;
      const config: BatchProcessConfig = {
        dataSource: "GADM",
        countryCode: "JP",
        adminLevels: [1, 2],
        workerPoolSize: 4,
        enableFeatureExtraction: true,
        simplificationLevels: [1, 2],
        tileZoomRange: [0, 10],
        cacheStrategy: {
          enableCache: true,
          ttl: 3600,
          maxSize: 100 * 1024 * 1024,
          compressionLevel: 6,
        },
      };

      // Mock worker response
      mockPluginAPI.getWorkerAPI().executeCommand.mockResolvedValue({
        sessionId: "session-123",
        status: "running",
      });

      // Act
      const session = await api.startBatchProcess(nodeId, config, []);

      // Assert
      expect(session).toBeDefined();
      expect(session.sessionId).toBe("session-123");
      expect(session.status).toBe("running");
      expect(session.nodeId).toBe(nodeId);
      expect(session.config).toEqual(config);
      expect(mockPluginAPI.getWorkerAPI().executeCommand).toHaveBeenCalledWith(
        "createBatchSession",
        { nodeId, config },
      );
    });

    it("should pause batch process", async () => {
      // Arrange
      const sessionId = "session-123";
      mockPluginAPI
        .getWorkerAPI()
        .executeCommand.mockResolvedValue({ success: true });

      // Act
      await api.pauseBatchProcess(sessionId);

      // Assert
      expect(mockPluginAPI.getWorkerAPI().executeCommand).toHaveBeenCalledWith(
        "pauseBatchSession",
        { sessionId },
      );
    });

    it("should resume batch process", async () => {
      // Arrange
      const sessionId = "session-123";
      mockPluginAPI
        .getWorkerAPI()
        .executeCommand.mockResolvedValue({ success: true });

      // Act
      await api.resumeBatchProcess(sessionId);

      // Assert
      expect(mockPluginAPI.getWorkerAPI().executeCommand).toHaveBeenCalledWith(
        "resumeBatchSession",
        { sessionId },
      );
    });

    it("should cancel batch process", async () => {
      // Arrange
      const sessionId = "session-123";
      mockPluginAPI
        .getWorkerAPI()
        .executeCommand.mockResolvedValue({ success: true });

      // Act
      await api.cancelBatchProcess(sessionId);

      // Assert
      expect(mockPluginAPI.getWorkerAPI().executeCommand).toHaveBeenCalledWith(
        "cancelBatchSession",
        { sessionId },
      );
    });

    it("should get batch status", async () => {
      // Arrange
      const sessionId = "session-123";
      const mockStatus = {
        session: {
          sessionId,
          status: "running",
          progress: {
            total: 100,
            completed: 50,
            failed: 0,
            skipped: 0,
            percentage: 50,
          },
        },
        currentTasks: [],
        queuedTasks: 25,
        errors: [],
        warnings: [],
      };

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockStatus);

      // Act
      const status = await api.getBatchStatus(sessionId);

      // Assert
      expect(status).toEqual(mockStatus);
      expect(mockPluginAPI.getWorkerAPI().query).toHaveBeenCalledWith(
        "getBatchStatus",
        { sessionId },
      );
    });
  });

  describe("data sources", () => {
    it("should get available data sources", async () => {
      // Arrange
      const mockDataSources: DataSourceInfo[] = [
        {
          name: "GADM",
          displayName: "GADM Administrative Areas",
          description: "Global administrative boundaries",
          license: "Academic use only",
          attribution: "GADM",
          availableCountries: ["JP", "US", "GB"],
          maxAdminLevel: 5,
          dataFormat: "geojson",
          updateFrequency: "Annually",
          features: ["boundaries", "names", "codes"],
        },
        {
          name: "NaturalEarth",
          displayName: "Natural Earth",
          description: "Public domain map dataset",
          license: "Public Domain",
          attribution: "Natural Earth",
          availableCountries: ["JP", "US", "GB", "FR", "DE"],
          maxAdminLevel: 2,
          dataFormat: "geojson",
          updateFrequency: "As needed",
          features: ["boundaries", "physical_features"],
        },
      ];

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockDataSources);

      // Act
      const dataSources = await api.getAvailableDataSources();

      // Assert
      expect(dataSources).toEqual(mockDataSources);
      expect(dataSources).toHaveLength(2);
      expect(dataSources[0]?.name).toBe("GADM");
      expect(dataSources[1]?.name).toBe("NaturalEarth");
    });

    it("should get country metadata", async () => {
      // Arrange
      const mockMetadata = [
        {
          countryCode: "JP",
          countryName: "Japan",
          countryNameLocal: "日本",
          adminLevels: [
            {
              level: 1,
              name: "Prefectures",
              localName: "都道府県",
              featureCount: 47,
              available: true,
            },
            {
              level: 2,
              name: "Municipalities",
              localName: "市町村",
              featureCount: 1741,
              available: true,
            },
          ],
          bbox: [122.93, 24.25, 145.82, 45.52],
          center: [138.25, 36.2],
          featureCount: 1788,
          lastUpdated: "2023-01-01",
          available: true,
        },
      ];

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockMetadata);

      // Act
      const metadata = await api.getCountryMetadata("GADM", "JP");

      // Assert
      expect(metadata).toEqual(mockMetadata);
      expect(metadata?.countryCode).toBe("JP");
      expect(metadata?.adminLevels).toHaveLength(2);
    });

    it("should validate data source configuration", async () => {
      // Arrange
      const mockValidation = {
        valid: true,
        errors: [],
        warnings: ["Large dataset may take significant time to process"],
        estimatedSize: 150000000,
        estimatedFeatures: 50000,
        estimatedDuration: 3600,
        requiredStorage: 200000000,
      };

      mockPluginAPI
        .getWorkerAPI()
        .executeCommand.mockResolvedValue(mockValidation);

      // Act
      const validation = await api.validateDataSource("GADM", {
        countryCode: "JP",
        adminLevels: [1, 2, 3],
        bbox: [130, 30, 140, 40],
      });

      // Assert
      expect(validation).toEqual(mockValidation);
      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(1);
    });
  });

  describe("vector tiles", () => {
    it("should get vector tile", async () => {
      // Arrange
      const nodeId: NodeId = "node-123" as NodeId;
      const mockTile = new Uint8Array([1, 2, 3, 4, 5]);

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockTile);

      // Act
      const tile = await api.getTile(nodeId, 10, 512, 256);

      // Assert
      expect(tile).toEqual(mockTile);
      expect(mockPluginAPI.getWorkerAPI().query).toHaveBeenCalledWith(
        "getVectorTile",
        { nodeId, z: 10, x: 512, y: 256 },
      );
    });

    it("should get tile metadata", async () => {
      // Arrange
      const nodeId: NodeId = "node-123" as NodeId;
      const mockMetadata = {
        exists: true,
        nodeId,
        tileKey: "10-512-256",
        z: 10,
        x: 512,
        y: 256,
        size: 15000,
        features: 150,
        layers: [
          {
            name: "admin_1",
            featureCount: 47,
            minZoom: 0,
            maxZoom: 18,
            fields: ["name", "code"],
          },
          {
            name: "admin_2",
            featureCount: 103,
            minZoom: 8,
            maxZoom: 18,
            fields: ["name", "code", "population"],
          },
        ],
        generatedAt: Date.now(),
        contentHash: "abc123def456",
        version: 1,
      };

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockMetadata);

      // Act
      const metadata = await api.getTileMetadata(nodeId, 10, 512, 256);

      // Assert
      expect(metadata).toEqual(mockMetadata);
      expect(metadata.exists).toBe(true);
      expect(metadata.layers).toHaveLength(2);
    });

    it("should clear tile cache", async () => {
      // Arrange
      const nodeId: NodeId = "node-123" as NodeId;
      mockPluginAPI
        .getWorkerAPI()
        .executeCommand.mockResolvedValue({ success: true });

      // Act
      await api.clearTileCache(nodeId);

      // Assert
      expect(mockPluginAPI.getWorkerAPI().executeCommand).toHaveBeenCalledWith(
        "clearTileCache",
        { nodeId },
      );
    });
  });

  describe("feature queries", () => {
    it("should search features", async () => {
      // Arrange
      const nodeId: NodeId = "node-123" as NodeId;
      const mockFeatures = [
        {
          id: 1,
          nodeId,
          properties: { name: "Tokyo", admin_level: 1, population: 13960000 },
          geometry: { type: "Polygon", coordinates: [] },
          bbox: [139.69, 35.68, 139.7, 35.69],
        },
      ];

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockFeatures);

      // Act
      const features = await api.searchFeatures(nodeId, "Tokyo", {
        limit: 10,
        adminLevel: 1,
        sortBy: "population",
        sortOrder: "desc",
      });

      // Assert
      expect(features).toEqual(mockFeatures);
      expect(features).toHaveLength(1);
      expect(features[0]?.properties.name).toBe("Tokyo");
    });

    it("should get feature by ID", async () => {
      // Arrange
      const nodeId: NodeId = "node-123" as NodeId;
      const mockFeature = {
        id: 1,
        nodeId,
        properties: { name: "Tokyo", admin_level: 1 },
        geometry: { type: "Polygon", coordinates: [] },
        bbox: [139.69, 35.68, 139.7, 35.69],
      };

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockFeature);

      // Act
      const feature = await api.getFeatureById(nodeId, 1);

      // Assert
      expect(feature).toEqual(mockFeature);
      expect(feature?.properties.name).toBe("Tokyo");
    });

    it("should get features by bounding box", async () => {
      // Arrange
      const nodeId: NodeId = "node-123" as NodeId;
      const bbox: [number, number, number, number] = [139, 35, 140, 36];
      const mockFeatures = [
        {
          id: 1,
          nodeId,
          properties: { name: "Tokyo", admin_level: 1 },
          geometry: { type: "Polygon", coordinates: [] },
          bbox: [139.69, 35.68, 139.7, 35.69],
        },
        {
          id: 2,
          nodeId,
          properties: { name: "Kanagawa", admin_level: 1 },
          geometry: { type: "Polygon", coordinates: [] },
          bbox: [139.0, 35.1, 139.8, 35.7],
        },
      ];

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockFeatures);

      // Act
      const features = await api.getFeaturesByBbox(nodeId, bbox, {
        adminLevel: 1,
        includeProperties: true,
      });

      // Assert
      expect(features).toEqual(mockFeatures);
      expect(features).toHaveLength(2);
    });
  });

  describe("cache management", () => {
    it("should get cache statistics", async () => {
      // Arrange
      const mockStats = {
        totalSize: 500000000,
        totalItems: 1500,
        byType: {
          features: {
            size: 200000000,
            count: 800,
            hits: 5000,
            misses: 500,
            evictions: 10,
            averageSize: 250000,
          },
          tiles: {
            size: 250000000,
            count: 500,
            hits: 8000,
            misses: 200,
            evictions: 5,
            averageSize: 500000,
          },
          buffers: {
            size: 50000000,
            count: 200,
            hits: 1000,
            misses: 100,
            evictions: 2,
            averageSize: 250000,
          },
          all: {
            size: 500000000,
            count: 1500,
            hits: 14000,
            misses: 800,
            evictions: 17,
            averageSize: 333333,
          },
        },
        hitRate: 0.95,
        missRate: 0.05,
        evictionCount: 17,
        oldestItem: Date.now() - 86400000,
        newestItem: Date.now(),
      };

      mockPluginAPI.getWorkerAPI().query.mockResolvedValue(mockStats);

      // Act
      const stats = await api.getCacheStatistics();

      // Assert
      expect(stats).toEqual(mockStats);
      expect(stats.hitRate).toBeGreaterThan(0.9);
      expect(stats.totalItems).toBe(1500);
    });

    it("should clear cache for specific node", async () => {
      // Arrange
      const nodeId: NodeId = "node-123" as NodeId;
      mockPluginAPI
        .getWorkerAPI()
        .executeCommand.mockResolvedValue({ success: true });

      // Act
      await api.clearCache(nodeId, "features");

      // Assert
      expect(mockPluginAPI.getWorkerAPI().executeCommand).toHaveBeenCalledWith(
        "clearCache",
        { nodeId, cacheType: "features" },
      );
    });

    it("should optimize storage", async () => {
      // Arrange
      const nodeId: NodeId = "node-123" as NodeId;
      const mockResult = {
        freedSpace: 50000000,
        removedItems: 100,
        compactedItems: 200,
        duration: 5000,
        errors: [],
        suggestions: ["Consider increasing cache size for better performance"],
      };

      mockPluginAPI.getWorkerAPI().executeCommand.mockResolvedValue(mockResult);

      // Act
      const result = await api.optimizeStorage(nodeId);

      // Assert
      expect(result).toEqual(mockResult);
      expect(result.freedSpace).toBeGreaterThan(0);
      expect(result.suggestions).toHaveLength(1);
    });
  });
});
