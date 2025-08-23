import type { NodeId } from '@hierarchidb/00-core';
import { WorkerAPIClient } from '@hierarchidb/10-ui-client';
import type { 
  ImportExportService, 
  ImportExportOptions, 
  ImportResult, 
  ExportResult 
} from '../types';

export class DefaultImportExportService implements ImportExportService {
  async importFromTemplate(
    templateId: string, 
    options: ImportExportOptions
  ): Promise<NodeId[] | null> {
    const { parentNodeId, onSuccess, onError } = options;
    
    if (!parentNodeId) {
      onError?.('No parent node selected');
      return null;
    }

    try {
      const client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI() as any;
      
      const result: ImportResult = await api.importFromTemplate({
        templateId,
        targetParentId: parentNodeId,
      });
      
      if (result.success) {
        const nodeCount = result.nodeIds?.length || 0;
        onSuccess?.(`Template imported successfully: ${nodeCount} nodes created`);
        return result.nodeIds || [];
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onError?.(message);
      console.error('Template import failed:', error);
      return null;
    }
  }

  async importFromFile(
    file: File, 
    options: ImportExportOptions
  ): Promise<NodeId[] | null> {
    const { parentNodeId, onSuccess, onError } = options;
    
    if (!parentNodeId) {
      onError?.('No parent node selected');
      return null;
    }

    try {
      const content = await file.text();
      const data = JSON.parse(content);
      
      const client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI() as any;
      
      const result: ImportResult = await api.importFromFile({
        data,
        targetParentId: parentNodeId,
      });
      
      if (result.success) {
        const nodeCount = result.nodeIds?.length || 0;
        onSuccess?.(`File imported successfully: ${nodeCount} nodes created`);
        return result.nodeIds || [];
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onError?.(message);
      console.error('File import failed:', error);
      return null;
    }
  }

  async exportToJson(
    nodeIds: NodeId[], 
    options?: ImportExportOptions
  ): Promise<boolean> {
    const { onSuccess, onError } = options || {};
    
    if (nodeIds.length === 0) {
      onError?.('No nodes selected for export');
      return false;
    }

    try {
      const client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI() as any;
      
      const result: ExportResult = await api.exportTreeNodes({
        nodeIds,
        format: 'json',
      });
      
      if (result.success && result.blob) {
        // Create download link
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        onSuccess?.('JSON export completed successfully');
        return true;
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onError?.(message);
      console.error('JSON export failed:', error);
      return false;
    }
  }

  async exportToZip(
    nodeIds: NodeId[], 
    options?: ImportExportOptions
  ): Promise<boolean> {
    const { onSuccess, onError } = options || {};
    
    if (nodeIds.length === 0) {
      onError?.('No nodes selected for export');
      return false;
    }

    try {
      const client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI() as any;
      
      const result: ExportResult = await api.exportTreeNodes({
        nodeIds,
        format: 'zip',
      });
      
      if (result.success && result.blob) {
        // Create download link
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'export.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        onSuccess?.('ZIP export completed successfully');
        return true;
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onError?.(message);
      console.error('ZIP export failed:', error);
      return false;
    }
  }
}