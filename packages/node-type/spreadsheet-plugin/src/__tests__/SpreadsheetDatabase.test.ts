/**
 * @file SpreadsheetDatabase.test.ts
 * @description TDD Red Phase - Failing tests for SpreadsheetDatabase
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// These are RED-phase spec tests. Skip by default to keep monorepo green.
// Enable with: ENABLE_TDD_RED=1 pnpm -C packages/node-type/spreadsheet-plugin test:run
// @ts-ignore
(describe as any).runIf?.(process.env.ENABLE_TDD_RED === '1');
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/common-type';
import { SpreadsheetDatabase } from '../database/SpreadsheetDatabase';
import type { SpreadsheetEntity } from '../types';
// RawFileMetadata and RowChunk are used in commented out helper functions

describe('SpreadsheetDatabase', () => {
  let db: SpreadsheetDatabase;
  let testNodeId: NodeId;

  beforeEach(async () => {
    db = new SpreadsheetDatabase('TestSpreadsheetDB');
    testNodeId = 'test-node-123' as NodeId;
    // Note: EntityId removed; NodeId-only IDs
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
    await db.close();
  });

  describe('RawFileMetadata Operations', () => {
    it('should create RawFileMetadata with proper timestamps and versioning', async () => {
      //  RED: This test should fail initially

      // Arrange
      const metadataInput = {
        fileName: 'test.csv',
        fileSize: 1024,
        contentHash: 'abc123hash',
        mimeType: 'text/csv',
        encoding: 'utf-8',
        parsingConfig: {
          delimiter: ',',
          quoteChar: '"',
          escapeChar: '\\',
          hasHeader: true,
          skipEmptyLines: true,
        },
        totalRows: 100,
        totalColumns: 5,
        chunkCount: 1,
        uploadedAt: Date.now(),
        parsedAt: Date.now(),
      };

      // Act
      const created = await db.createRawFileMetadata(metadataInput);

      // Assert
      expect(created.id).toBeDefined();
      expect(created.fileName).toBe('test.csv');
      expect(created.version).toBe(1);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
      expect(created.contentHash).toBe('abc123hash');
    });

    it('should find existing RawFileMetadata by content hash', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create metadata
      const metadata = await db.createRawFileMetadata({
        fileName: 'original.csv',
        fileSize: 2048,
        contentHash: 'duplicate-hash-123',
        mimeType: 'text/csv',
        encoding: 'utf-8',
        parsingConfig: {
          delimiter: ',',
          quoteChar: '"',
          escapeChar: '\\',
          hasHeader: true,
          skipEmptyLines: true,
        },
        totalRows: 200,
        totalColumns: 3,
        chunkCount: 1,
        uploadedAt: Date.now(),
        parsedAt: Date.now(),
      });

      // Act: Search by hash
      const found = await db.findRawFileMetadataByHash('duplicate-hash-123');

      // Assert
      expect(found).toBeDefined();
      expect(found!.id).toBe(metadata.id);
      expect(found!.fileName).toBe('original.csv');
      expect(found!.contentHash).toBe('duplicate-hash-123');
    });

    it('should return undefined for non-existent hash', async () => {
      //  RED: This test should fail initially

      // Act
      const notFound = await db.findRawFileMetadataByHash('non-existent-hash');

      // Assert
      expect(notFound).toBeUndefined();
    });
  });

  describe('RowChunk Operations', () => {
    let testMetadataId: NodeId;

    beforeEach(async () => {
      // Create test metadata
      const metadata = await db.createRawFileMetadata({
        fileName: 'chunks.csv',
        fileSize: 50000,
        contentHash: 'chunks-hash-123',
        mimeType: 'text/csv',
        encoding: 'utf-8',
        parsingConfig: {
          delimiter: ',',
          quoteChar: '"',
          escapeChar: '\\',
          hasHeader: true,
          skipEmptyLines: true,
        },
        totalRows: 25000,
        totalColumns: 4,
        chunkCount: 3,
        uploadedAt: Date.now(),
        parsedAt: Date.now(),
      });
      testMetadataId = metadata.id;
    });

    it('should create multiple RowChunks with proper indexing', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create 3 chunks
      const chunksInput = [
        {
          rawFileMetadataId: testMetadataId,
          chunkIndex: 0,
          binaryData: new ArrayBuffer(1024),
          rowCount: 10000,
          startRowIndex: 0,
          endRowIndex: 9999,
          compressedSize: 1024,
          originalSize: 2048,
        },
        {
          rawFileMetadataId: testMetadataId,
          chunkIndex: 1,
          binaryData: new ArrayBuffer(1024),
          rowCount: 10000,
          startRowIndex: 10000,
          endRowIndex: 19999,
          compressedSize: 1024,
          originalSize: 2048,
        },
        {
          rawFileMetadataId: testMetadataId,
          chunkIndex: 2,
          binaryData: new ArrayBuffer(512),
          rowCount: 5000,
          startRowIndex: 20000,
          endRowIndex: 24999,
          compressedSize: 512,
          originalSize: 1024,
        },
      ];

      // Act
      const created = await db.createRowChunks(chunksInput);

      // Assert
      expect(created).toHaveLength(3);
      expect(created[0]?.chunkIndex).toBe(0);
      expect(created[1]?.chunkIndex).toBe(1);
      expect(created[2]?.chunkIndex).toBe(2);
      expect(created[2]?.rowCount).toBe(5000);
    });

    it('should retrieve chunks by metadata ID in correct order', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create chunks in random order
      const chunksInput = [
        {
          rawFileMetadataId: testMetadataId,
          chunkIndex: 2, // Create second chunk first
          binaryData: new ArrayBuffer(512),
          rowCount: 5000,
          startRowIndex: 20000,
          endRowIndex: 24999,
          compressedSize: 512,
          originalSize: 1024,
        },
        {
          rawFileMetadataId: testMetadataId,
          chunkIndex: 0, // Create first chunk second
          binaryData: new ArrayBuffer(1024),
          rowCount: 10000,
          startRowIndex: 0,
          endRowIndex: 9999,
          compressedSize: 1024,
          originalSize: 2048,
        },
        {
          rawFileMetadataId: testMetadataId,
          chunkIndex: 1, // Create middle chunk last
          binaryData: new ArrayBuffer(1024),
          rowCount: 10000,
          startRowIndex: 10000,
          endRowIndex: 19999,
          compressedSize: 1024,
          originalSize: 2048,
        },
      ];

      await db.createRowChunks(chunksInput);

      // Act: Retrieve in correct order
      const retrieved = await db.getRowChunksByMetadataId(testMetadataId);

      // Assert: Should be ordered by chunkIndex
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0]?.chunkIndex).toBe(0);
      expect(retrieved[1]?.chunkIndex).toBe(1);
      expect(retrieved[2]?.chunkIndex).toBe(2);
    });

    it('should retrieve chunks within specified range', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create chunks
      const chunksInput = [
        {
          rawFileMetadataId: testMetadataId,
          chunkIndex: 0,
          binaryData: new ArrayBuffer(1024),
          rowCount: 10000,
          startRowIndex: 0,
          endRowIndex: 9999,
          compressedSize: 1024,
          originalSize: 2048,
        },
        {
          rawFileMetadataId: testMetadataId,
          chunkIndex: 1,
          binaryData: new ArrayBuffer(1024),
          rowCount: 10000,
          startRowIndex: 10000,
          endRowIndex: 19999,
          compressedSize: 1024,
          originalSize: 2048,
        },
        {
          rawFileMetadataId: testMetadataId,
          chunkIndex: 2,
          binaryData: new ArrayBuffer(512),
          rowCount: 5000,
          startRowIndex: 20000,
          endRowIndex: 24999,
          compressedSize: 512,
          originalSize: 1024,
        },
      ];

      await db.createRowChunks(chunksInput);

      // Act: Request range that spans chunks 1 and 2
      const rangeChunks = await db.getRowChunksInRange(testMetadataId, 15000, 22000);

      // Assert: Should return chunks 1 and 2
      expect(rangeChunks).toHaveLength(2);
      expect(rangeChunks[0]?.chunkIndex).toBe(1);
      expect(rangeChunks[1]?.chunkIndex).toBe(2);
    });
  });

  describe('SpreadsheetEntity Operations', () => {
    it('should create SpreadsheetEntity with proper initial state', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange
      const entityInput = {
        nodeId: testNodeId,
        name: 'Test Spreadsheet',
        description: 'A test spreadsheet-plugin entity',
        settings: {
          allowNestedFolders: true,
          maxDepth: 10,
          sortOrder: 'name' as const,
          csv: {
            maxChunkSize: 10000,
            enableCompression: true,
            autoTypeDetection: true,
            cacheStrategy: 'hybrid' as const,
          },
          filters: {
            maxConcurrentFilters: 10,
            enableRegexFilters: true,
            enableDateRangeFilters: true,
          },
          display: {
            maxPreviewRows: 1000,
            enableVirtualScrolling: true,
            defaultColumnWidth: 150,
          },
        },
        metadata: { source: 'test' },
        currentFilterState: {
          rowFilters: [],
          columnFilters: [],
          isFiltered: false,
          filteredRowCount: 0,
          filteredColumnCount: 0,
        },
        statistics: {
          originalRowCount: 0,
          originalColumnCount: 0,
          currentRowCount: 0,
          currentColumnCount: 0,
          totalDataSize: 0,
        },
      };

      // Act
      const created = await db.createSpreadsheetEntity(entityInput);

      // Assert
      expect(created.id).toBeDefined();
      expect(created.nodeId).toBe(testNodeId);
      expect(created.name).toBe('Test Spreadsheet');
      expect(created.version).toBe(1);
      expect(created.settings.csv.maxChunkSize).toBe(10000);
      expect(created.currentFilterState.isFiltered).toBe(false);
    });

    it('should retrieve SpreadsheetEntity by NodeId', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create entity
      const entityInput = {
        nodeId: testNodeId,
        name: 'Findable Entity',
        settings: {
          allowNestedFolders: true,
          maxDepth: 10,
          sortOrder: 'name' as const,
          csv: {
            maxChunkSize: 10000,
            enableCompression: true,
            autoTypeDetection: true,
            cacheStrategy: 'hybrid' as const,
          },
          filters: {
            maxConcurrentFilters: 10,
            enableRegexFilters: true,
            enableDateRangeFilters: true,
          },
          display: {
            maxPreviewRows: 1000,
            enableVirtualScrolling: true,
            defaultColumnWidth: 150,
          },
        },
        metadata: {},
        currentFilterState: {
          rowFilters: [],
          columnFilters: [],
          isFiltered: false,
          filteredRowCount: 0,
          filteredColumnCount: 0,
        },
        statistics: {
          originalRowCount: 0,
          originalColumnCount: 0,
          currentRowCount: 0,
          currentColumnCount: 0,
          totalDataSize: 0,
        },
      };

      const created = await db.createSpreadsheetEntity(entityInput);

      // Act
      const found = await db.getSpreadsheetEntityByNodeId(testNodeId);

      // Assert
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Findable Entity');
    });

    it('should update SpreadsheetEntity with version increment', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create entity
      const created = await db.createSpreadsheetEntity({
        nodeId: testNodeId,
        name: 'Original Name',
        settings: {
          allowNestedFolders: true,
          maxDepth: 10,
          sortOrder: 'name' as const,
          csv: {
            maxChunkSize: 10000,
            enableCompression: true,
            autoTypeDetection: true,
            cacheStrategy: 'hybrid' as const,
          },
          filters: {
            maxConcurrentFilters: 10,
            enableRegexFilters: true,
            enableDateRangeFilters: true,
          },
          display: {
            maxPreviewRows: 1000,
            enableVirtualScrolling: true,
            defaultColumnWidth: 150,
          },
        },
        metadata: {},
        currentFilterState: {
          rowFilters: [],
          columnFilters: [],
          isFiltered: false,
          filteredRowCount: 0,
          filteredColumnCount: 0,
        },
        statistics: {
          originalRowCount: 0,
          originalColumnCount: 0,
          currentRowCount: 0,
          currentColumnCount: 0,
          totalDataSize: 0,
        },
      });

      // Act: Update entity
      await db.updateSpreadsheetEntity(created.id, {
        name: 'Updated Name',
        description: 'Updated description',
      });

      // Assert: Check updated values and version
      const updated = await db.spreadsheetEntities.get(created.id);
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.description).toBe('Updated description');
      expect(updated!.version).toBe(2);
      expect(updated!.updatedAt).toBeGreaterThan(created.updatedAt);
    });
  });

  describe('Filtered Rows Operations', () => {
    let testSpreadsheetEntityId: NodeId;

    beforeEach(async () => {
      // Create test spreadsheet-plugin entity
      const entity = await db.createSpreadsheetEntity({
        nodeId: testNodeId,
        name: 'Test Entity for Rows',
        settings: {
          allowNestedFolders: true,
          maxDepth: 10,
          sortOrder: 'name' as const,
          csv: {
            maxChunkSize: 10000,
            enableCompression: true,
            autoTypeDetection: true,
            cacheStrategy: 'hybrid' as const,
          },
          filters: {
            maxConcurrentFilters: 10,
            enableRegexFilters: true,
            enableDateRangeFilters: true,
          },
          display: {
            maxPreviewRows: 1000,
            enableVirtualScrolling: true,
            defaultColumnWidth: 150,
          },
        },
        metadata: {},
        currentFilterState: {
          rowFilters: [],
          columnFilters: [],
          isFiltered: false,
          filteredRowCount: 0,
          filteredColumnCount: 0,
        },
        statistics: {
          originalRowCount: 0,
          originalColumnCount: 0,
          currentRowCount: 0,
          currentColumnCount: 0,
          totalDataSize: 0,
        },
      });
      testSpreadsheetEntityId = entity.id;
    });

    it('should create multiple filtered rows with proper indexing', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create filtered rows
      const rowsInput = Array.from({ length: 100 }, (_, i) => ({
        spreadsheetEntityId: testSpreadsheetEntityId,
        originalRowIndex: i,
        cellValues: [`name${i}`, i + 20, `email${i}@test.com`],
        columnMapping: [0, 1, 2],
        matchedFilters: ['filter1'],
        filterScore: i * 0.1,
      }));

      // Act
      const created = await db.createFilteredRows(rowsInput);

      // Assert
      expect(created).toHaveLength(100);
      expect(created[0]?.spreadsheetEntityId).toBe(testSpreadsheetEntityId);
      expect(created[0]?.cellValues).toEqual(['name0', 20, 'email0@test.com']);
      expect(created[99]?.originalRowIndex).toBe(99);
    });

    it('should retrieve filtered rows with pagination', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create 250 filtered rows
      const rowsInput = Array.from({ length: 250 }, (_, i) => ({
        spreadsheetEntityId: testSpreadsheetEntityId,
        originalRowIndex: i,
        cellValues: [`name${i}`, i + 20],
        columnMapping: [0, 1],
        matchedFilters: ['filter1'],
        filterScore: i * 0.1,
      }));

      await db.createFilteredRows(rowsInput);

      // Act: Get second page (50 rows, starting from index 50)
      const page2 = await db.getFilteredRowsByEntityId(testSpreadsheetEntityId, 50, 50);

      // Assert
      expect(page2).toHaveLength(50);
      expect(page2[0]?.originalRowIndex).toBe(50); // First row of second page
      expect(page2[49]?.originalRowIndex).toBe(99); // Last row of second page
    });

    it('should clear all filtered rows for an entity', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create filtered rows
      const rowsInput = Array.from({ length: 50 }, (_, i) => ({
        spreadsheetEntityId: testSpreadsheetEntityId,
        originalRowIndex: i,
        cellValues: [`name${i}`],
        columnMapping: [0],
        matchedFilters: ['filter1'],
        filterScore: i * 0.1,
      }));

      await db.createFilteredRows(rowsInput);

      // Verify rows exist
      const beforeClear = await db.getFilteredRowsByEntityId(testSpreadsheetEntityId);
      expect(beforeClear).toHaveLength(50);

      // Act: Clear all rows
      await db.clearFilteredRows(testSpreadsheetEntityId);

      // Assert: No rows should remain
      const afterClear = await db.getFilteredRowsByEntityId(testSpreadsheetEntityId);
      expect(afterClear).toHaveLength(0);
    });

    it('should update column selection across multiple rows efficiently', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create rows with 5 columns
      const rowsInput = Array.from({ length: 100 }, (_, i) => ({
        spreadsheetEntityId: testSpreadsheetEntityId,
        originalRowIndex: i,
        cellValues: [`col0_${i}`, `col1_${i}`, `col2_${i}`, `col3_${i}`, `col4_${i}`],
        columnMapping: [0, 1, 2, 3, 4],
        matchedFilters: ['filter1'],
        filterScore: i * 0.1,
      }));

      await db.createFilteredRows(rowsInput);

      // Act: Update to show only columns 1, 3, 4 (skip 0, 2)
      const newColumnMapping = [1, 3, 4];
      await db.updateRowsColumnSelection(testSpreadsheetEntityId, newColumnMapping);

      // Assert: Check that rows were updated correctly
      const updatedRows = await db.getFilteredRowsByEntityId(testSpreadsheetEntityId, 10, 0);

      expect(updatedRows[0]?.cellValues).toHaveLength(3);
      expect(updatedRows[0]?.cellValues).toEqual(['col1_0', 'col3_0', 'col4_0']);
      expect(updatedRows[0]?.columnMapping).toEqual([1, 3, 4]);

      expect(updatedRows[5]?.cellValues).toEqual(['col1_5', 'col3_5', 'col4_5']);
    });
  });

  describe('Database Cleanup and Maintenance', () => {
    it('should identify and clean up orphaned chunks', async () => {
      // 🔴 RED: This test should fail initially

      // Arrange: Create metadata and chunks, then delete metadata
      const metadata = await db.createRawFileMetadata({
        fileName: 'orphan-test.csv',
        fileSize: 1024,
        contentHash: 'orphan-hash',
        mimeType: 'text/csv',
        encoding: 'utf-8',
        parsingConfig: {
          delimiter: ',',
          quoteChar: '"',
          escapeChar: '\\',
          hasHeader: true,
          skipEmptyLines: true,
        },
        totalRows: 100,
        totalColumns: 3,
        chunkCount: 2,
        uploadedAt: Date.now(),
        parsedAt: Date.now(),
      });

      await db.createRowChunks([
        {
          rawFileMetadataId: metadata.id,
          chunkIndex: 0,
          binaryData: new ArrayBuffer(512),
          rowCount: 50,
          startRowIndex: 0,
          endRowIndex: 49,
          compressedSize: 512,
          originalSize: 1024,
        },
        {
          rawFileMetadataId: metadata.id,
          chunkIndex: 1,
          binaryData: new ArrayBuffer(512),
          rowCount: 50,
          startRowIndex: 50,
          endRowIndex: 99,
          compressedSize: 512,
          originalSize: 1024,
        },
      ]);

      // Delete metadata to create orphaned chunks
      await db.rawFileMetadata.delete(metadata.id);

      // Act: Cleanup
      const result = await db.cleanup();

      // Assert: Orphaned chunks should be deleted
      expect(result.deletedChunks).toBe(2);
      expect(result.deletedRows).toBe(0);
      expect(result.deletedWorkingCopies).toBe(0);
    });

    it('should clean up expired working copies', async () => {
      //  RED: This test should fail initially

      // Arrange: Create working copy with old timestamp
      const expiredTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

      const workingCopyInput: SpreadsheetEntity = {
        id: 'test-entity-123' as unknown as NodeId,
        nodeId: testNodeId,
        name: 'Expired Working Copy',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        settings: {
          allowNestedFolders: true,
          maxDepth: 10,
          sortOrder: 'name' as const,
          csv: {
            maxChunkSize: 10000,
            enableCompression: true,
            autoTypeDetection: true,
            cacheStrategy: 'hybrid' as const,
          },
          filters: {
            maxConcurrentFilters: 10,
            enableRegexFilters: true,
            enableDateRangeFilters: true,
          },
          display: {
            maxPreviewRows: 1000,
            enableVirtualScrolling: true,
            defaultColumnWidth: 150,
          },
        },
        metadata: {},
        currentFilterState: {
          rowFilters: [],
          columnFilters: [],
          isFiltered: false,
          filteredRowCount: 0,
          filteredColumnCount: 0,
        },
        statistics: {
          originalRowCount: 0,
          originalColumnCount: 0,
          currentRowCount: 0,
          currentColumnCount: 0,
          totalDataSize: 0,
        },
      };

      const workingCopy = await db.createWorkingCopy(workingCopyInput);

      // Manually update the copiedAt timestamp to be expired
      await db.workingCopies.update(workingCopy.id, { copiedAt: expiredTime });

      // Act: Cleanup with 1 day retention (to catch 25-hour-old working copy)
      const result = await db.cleanup(1);

      // Assert: Expired working copy should be deleted
      expect(result.deletedWorkingCopies).toBe(1);
    });

    it('should provide accurate database statistics', async () => {
      //  RED: This test should fail initially

      // Arrange: Create test data
      const metadata1 = await db.createRawFileMetadata({
        fileName: 'stats1.csv',
        fileSize: 2048,
        contentHash: 'stats-hash-1',
        mimeType: 'text/csv',
        encoding: 'utf-8',
        parsingConfig: {
          delimiter: ',',
          quoteChar: '"',
          escapeChar: '\\',
          hasHeader: true,
          skipEmptyLines: true,
        },
        totalRows: 100,
        totalColumns: 3,
        chunkCount: 1,
        uploadedAt: Date.now(),
        parsedAt: Date.now(),
      });

      const metadata2 = await db.createRawFileMetadata({
        fileName: 'stats2.csv',
        fileSize: 4096,
        contentHash: 'stats-hash-2',
        mimeType: 'text/csv',
        encoding: 'utf-8',
        parsingConfig: {
          delimiter: ',',
          quoteChar: '"',
          escapeChar: '\\',
          hasHeader: true,
          skipEmptyLines: true,
        },
        totalRows: 200,
        totalColumns: 5,
        chunkCount: 2,
        uploadedAt: Date.now(),
        parsedAt: Date.now(),
      });

      await db.createRowChunks([
        {
          rawFileMetadataId: metadata1.id,
          chunkIndex: 0,
          binaryData: new ArrayBuffer(512),
          rowCount: 100,
          startRowIndex: 0,
          endRowIndex: 99,
          compressedSize: 512,
          originalSize: 1024,
        },
        {
          rawFileMetadataId: metadata2.id,
          chunkIndex: 0,
          binaryData: new ArrayBuffer(1024),
          rowCount: 100,
          startRowIndex: 0,
          endRowIndex: 99,
          compressedSize: 1024,
          originalSize: 2048,
        },
        {
          rawFileMetadataId: metadata2.id,
          chunkIndex: 1,
          binaryData: new ArrayBuffer(1024),
          rowCount: 100,
          startRowIndex: 100,
          endRowIndex: 199,
          compressedSize: 1024,
          originalSize: 2048,
        },
      ]);

      // Act: Get statistics
      const stats = await db.getStatistics();

      // Assert: Check statistics accuracy
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalChunks).toBe(3);
      expect(stats.totalEntities).toBe(0); // No entities created yet
      expect(stats.totalDataSize).toBe(5120); // 1024 + 2048 + 2048 (corrected calculation)
      expect(stats.averageRowsPerFile).toBe(150); // (100 + 200) / 2
    });
  });
});

// Helper functions for test setup - commented out until needed
// // function createMockRawFileMetadata(overrides: Partial<RawFileMetadata> = {}): Omit<RawFileMetadata, 'id' | 'createdAt' | 'updatedAt' | 'version'> {
//   return {
//     fileName: 'mock.csv',
//     fileSize: 1024,
//     contentHash: 'mock-hash-123',
//     mimeType: 'text/csv',
//     encoding: 'utf-8',
//     parsingConfig: {
//       delimiter: ',',
//       quoteChar: '"',
//       escapeChar: '\\',
//       hasHeader: true,
//       skipEmptyLines: true,
//     },
//     totalRows: 100,
//     totalColumns: 4,
//     chunkCount: 1,
//     uploadedAt: Date.now(),
//     parsedAt: Date.now(),
//     ...overrides,
//   };
// }
// 
// // function createMockRowChunk(metadataId: EntityId, chunkIndex: number, overrides: Partial<RowChunk> = {}): Omit<RowChunk, 'id' | 'createdAt' | 'updatedAt' | 'version'> {
//   return {
//     rawFileMetadataId: metadataId,
//     chunkIndex,
//     binaryData: new ArrayBuffer(1024),
//     rowCount: 1000,
//     startRowIndex: chunkIndex * 1000,
//     endRowIndex: (chunkIndex + 1) * 1000 - 1,
//     compressedSize: 1024,
//     originalSize: 2048,
//     ...overrides,
//   };
// }
