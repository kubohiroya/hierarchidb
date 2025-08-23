import { useCallback, useState } from 'react';
import type { NodeId } from '@hierarchidb/00-core';
import { WorkerAPIClient } from '@hierarchidb/10-ui-client';
import type { 
  ImportExportOptions, 
  ImportExportService, 
  ImportResult, 
  ExportResult 
} from '../types';

export interface UseImportExportOptions extends ImportExportOptions {
  importExportService?: ImportExportService;
}

export function useImportExport({
  parentNodeId,
  selectedNodeIds = [],
  onSuccess,
  onError,
  importExportService,
}: UseImportExportOptions) {
  const [loading, setLoading] = useState(false);

  const handleTemplateImport = useCallback(
    async (templateId: string) => {
      if (!parentNodeId) {
        onError?.('No parent node selected');
        return null;
      }

      setLoading(true);
      try {
        if (importExportService) {
          // Use provided service
          return await importExportService.importFromTemplate(templateId, {
            parentNodeId,
            selectedNodeIds,
            onSuccess,
            onError,
          });
        }

        // Fallback to direct API call
        const client = await WorkerAPIClient.getSingleton();
        const api = client.getAPI() as any;
        
        const result: ImportResult = await api.importFromTemplate({
          templateId,
          targetParentId: parentNodeId,
        });
        
        if (result.success) {
          onSuccess?.(`Template imported successfully: ${result.nodeIds?.length || 0} nodes created`);
          return result.nodeIds || [];
        } else {
          throw new Error(result.error || 'Import failed');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError?.(message);
        console.error('Template import failed:', error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [parentNodeId, selectedNodeIds, onSuccess, onError, importExportService]
  );

  const handleFileImport = useCallback(
    async (file: File) => {
      if (!parentNodeId) {
        onError?.('No parent node selected');
        return null;
      }

      setLoading(true);
      try {
        if (importExportService) {
          // Use provided service
          return await importExportService.importFromFile(file, {
            parentNodeId,
            selectedNodeIds,
            onSuccess,
            onError,
          });
        }

        // Fallback to direct API call
        const client = await WorkerAPIClient.getSingleton();
        const api = client.getAPI() as any;
        
        const content = await file.text();
        const data = JSON.parse(content);
        
        const result: ImportResult = await api.importFromFile({
          data,
          targetParentId: parentNodeId,
        });
        
        if (result.success) {
          onSuccess?.(`File imported successfully: ${result.nodeIds?.length || 0} nodes created`);
          return result.nodeIds || [];
        } else {
          throw new Error(result.error || 'Import failed');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError?.(message);
        console.error('File import failed:', error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [parentNodeId, selectedNodeIds, onSuccess, onError, importExportService]
  );

  const handleExport = useCallback(
    async (format: 'json' | 'zip' = 'json') => {
      if (selectedNodeIds.length === 0) {
        onError?.('No nodes selected for export');
        return false;
      }

      setLoading(true);
      try {
        const nodeIds = selectedNodeIds as NodeId[];
        
        if (importExportService) {
          // Use provided service
          if (format === 'json') {
            return await importExportService.exportToJson(nodeIds, {
              parentNodeId,
              selectedNodeIds: nodeIds,
              onSuccess,
              onError,
            });
          } else {
            return await importExportService.exportToZip(nodeIds, {
              parentNodeId,
              selectedNodeIds: nodeIds,
              onSuccess,
              onError,
            });
          }
        }

        // Fallback to direct API call
        const client = await WorkerAPIClient.getSingleton();
        const api = client.getAPI() as any;
        
        const result: ExportResult = await api.exportTreeNodes({
          nodeIds: selectedNodeIds,
          format,
        });
        
        if (result.success && result.blob) {
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename || `export.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          onSuccess?.('Export completed successfully');
          return true;
        } else {
          throw new Error(result.error || 'Export failed');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError?.(message);
        console.error('Export failed:', error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [selectedNodeIds, parentNodeId, onSuccess, onError, importExportService]
  );

  return {
    loading,
    handleTemplateImport,
    handleFileImport,
    handleExport,
  };
}