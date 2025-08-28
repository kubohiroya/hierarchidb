import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImportExport } from './useImportExport';
import type { NodeId } from '@hierarchidb/common-core';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { Remote } from 'comlink';

// Mock the worker context
const mockImportExportAPI = {
  importNodes: vi.fn().mockResolvedValue({
    success: true,
    importedNodeIds: ['node-1', 'node-2'],
    importedCount: 2,
    skippedCount: 0,
  }),
  exportNodes: vi.fn().mockResolvedValue({
    success: true,
    data: JSON.stringify({ nodes: [] }),
    format: 'json',
    exportedCount: 2,
    mimeType: 'application/json',
    filename: 'export.json',
  }),
  getSupportedImportFormats: vi.fn().mockResolvedValue(['json', 'csv', 'xml']),
  getSupportedExportFormats: vi.fn().mockResolvedValue(['json', 'csv', 'xml']),
  validateImportData: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
  getOperationStatus: vi.fn().mockResolvedValue(null),
  cancelOperation: vi.fn().mockResolvedValue({ success: true }),
};

const mockWorkerAPI = {
  getImportExportAPI: vi.fn(() => mockImportExportAPI),
  getQueryAPI: vi.fn(() => ({
    getNode: vi.fn().mockResolvedValue({ id: 'node-1', name: 'Test Node' }),
    listChildren: vi.fn().mockResolvedValue([]),
  })),
  getMutationAPI: vi.fn(() => ({
    createNode: vi.fn().mockResolvedValue({ success: true, nodeId: 'new-node' }),
  })),
};

vi.mock('@hierarchidb/ui-client', () => ({
  useWorker: vi.fn(() => ({
    client: mockWorkerAPI as unknown as Remote<WorkerAPI>,
    ready: true,
  })),
}));

describe('useImportExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Import functionality', () => {
    it('should import JSON file with progress tracking', async () => {
      const { result } = renderHook(() => useImportExport());

      const mockFile = new File(['{"nodes": []}'], 'test.json', { type: 'application/json' });
      const targetNodeId = 'node-123' as NodeId;
      const onProgress = vi.fn();

      // Start import
      const importPromise = result.current.importFile({
        file: mockFile,
        targetNodeId,
        format: 'json',
        onProgress,
      });

      // Should set loading state
      expect(result.current.isImporting).toBe(true);

      // Wait for import to complete
      await act(async () => {
        await importPromise;
      });

      // Should call progress callback
      expect(onProgress).toHaveBeenCalled();

      // Should complete import
      expect(result.current.isImporting).toBe(false);
    });

    it('should import CSV file with column mapping', async () => {
      const { result } = renderHook(() => useImportExport());

      const csvContent = 'name,type,description\nNode1,folder-plugin,Test node';
      const mockFile = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const targetNodeId = 'node-123' as NodeId;

      const importResult = await result.current.importFile({
        file: mockFile,
        targetNodeId,
        format: 'csv',
        csvOptions: {
          hasHeader: true,
          columnMapping: {
            name: 0,
            nodeType: 1, 
            description: 2,
          },
        },
      });

      expect(importResult.success).toBe(true);
      expect(importResult.importedCount).toBeGreaterThan(0);
    });

    it('should handle import errors gracefully', async () => {
      const { result } = renderHook(() => useImportExport());

      const mockFile = new File(['invalid json'], 'test.json', { type: 'application/json' });
      const targetNodeId = 'node-123' as NodeId;

      await expect(
        result.current.importFile({
          file: mockFile,
          targetNodeId,
          format: 'json',
        })
      ).rejects.toThrow();

      expect(result.current.isImporting).toBe(false);
      expect(result.current.importError).toBeDefined();
    });
  });

  describe('Export functionality', () => {
    it('should export nodes to JSON format', async () => {
      const { result } = renderHook(() => useImportExport());

      const nodeIds = ['node-1', 'node-2'] as NodeId[];
      const onProgress = vi.fn();

      const exportResult = await result.current.exportNodes({
        nodeIds,
        format: 'json',
        includeChildren: true,
        onProgress,
      });

      expect(exportResult).toBeInstanceOf(Blob);
      expect(onProgress).toHaveBeenCalled();
    });

    it('should export nodes to CSV format', async () => {
      const { result } = renderHook(() => useImportExport());

      const nodeIds = ['node-1'] as NodeId[];

      const exportResult = await result.current.exportNodes({
        nodeIds,
        format: 'csv',
        includeChildren: false,
        csvOptions: {
          includeHeader: true,
          columns: ['name', 'nodeType', 'description'],
        },
      });

      expect(exportResult).toBeInstanceOf(Blob);
      expect(result.current.isExporting).toBe(false);
    });

    it('should handle export cancellation', async () => {
      const { result } = renderHook(() => useImportExport());

      const nodeIds = ['node-1', 'node-2', 'node-3'] as NodeId[];

      // Start export
      const exportPromise = result.current.exportNodes({
        nodeIds,
        format: 'json',
        includeChildren: true,
      });

      // Cancel export
      await act(async () => {
        result.current.cancelExport();
      });

      await expect(exportPromise).rejects.toThrow('Export cancelled');
      expect(result.current.isExporting).toBe(false);
    });
  });

  describe('Progress tracking', () => {
    it('should track import progress', async () => {
      const { result } = renderHook(() => useImportExport());

      const mockFile = new File(['{"nodes": []}'], 'test.json', { type: 'application/json' });
      const targetNodeId = 'node-123' as NodeId;
      const progressUpdates: any[] = [];

      await result.current.importFile({
        file: mockFile,
        targetNodeId,
        format: 'json',
        onProgress: (progress) => progressUpdates.push(progress),
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].phase).toBe('completed');
    });

    it('should track export progress', async () => {
      const { result } = renderHook(() => useImportExport());

      const nodeIds = ['node-1', 'node-2'] as NodeId[];
      const progressUpdates: any[] = [];

      await result.current.exportNodes({
        nodeIds,
        format: 'json',
        includeChildren: true,
        onProgress: (progress) => progressUpdates.push(progress),
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].phase).toBe('completed');
    });
  });

  describe('Format detection', () => {
    it('should auto-detect JSON format', () => {
      const { result } = renderHook(() => useImportExport());

      const jsonFile = new File(['{}'], 'test.json', { type: 'application/json' });
      const format = result.current.detectFileFormat(jsonFile);

      expect(format).toBe('json');
    });

    it('should auto-detect CSV format', () => {
      const { result } = renderHook(() => useImportExport());

      const csvFile = new File(['a,b,c'], 'test.csv', { type: 'text/csv' });
      const format = result.current.detectFileFormat(csvFile);

      expect(format).toBe('csv');
    });

    it('should return undefined for unsupported formats', () => {
      const { result } = renderHook(() => useImportExport());

      const unknownFile = new File(['data'], 'test.xyz', { type: 'application/octet-stream' });
      const format = result.current.detectFileFormat(unknownFile);

      expect(format).toBeUndefined();
    });
  });

  describe('Validation', () => {
    it('should validate import data before processing', async () => {
      const { result } = renderHook(() => useImportExport());

      const validationResult = await result.current.validateImportData({
        nodes: [
          { name: 'Node1', nodeType: 'folder' },
          { name: 'Node2', nodeType: 'invalid' }, // Invalid type
        ],
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toHaveLength(1);
      expect(validationResult.errors[0]).toContain('invalid node type');
    });

    it('should validate CSV columns', () => {
      const { result } = renderHook(() => useImportExport());

      const csvData = [
        ['name', 'type', 'description'],
        ['Node1', 'folder', 'Test'],
      ];

      const validationResult = result.current.validateCSVColumns(csvData, {
        requiredColumns: ['name', 'type'],
      });

      expect(validationResult.valid).toBe(true);
    });
  });
});