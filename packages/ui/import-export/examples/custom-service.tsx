/**
 * Custom Import/Export Service Example
 * 
 * This example demonstrates how to create a custom import/export service
 * with specialized behavior for your application.
 */

import React from 'react';
import { TreeTableWithPlugins } from '@hierarchidb/ui/treeconsole/treetable';
import { 
  createImportExportPlugin,
  type ImportExportService,
  type ImportExportOptions,
} from '@hierarchidb/ui-import-export-plugin';
import type { NodeId } from '@hierarchidb/00-core';

/**
 * Custom Import/Export Service Implementation
 * 
 * This service adds custom validation, transformation, and user feedback.
 */
class CustomImportExportService implements ImportExportService {
  private nodeCounter = 0;

  async importFromTemplate(
    templateId: string, 
    options: ImportExportOptions
  ): Promise<NodeId[] | null> {
    console.log('Custom template import:', templateId);
    
    try {
      // Simulate API call delay
      await this.delay(1000);
      
      // Custom template handling based on ID
      const templateData = this.getTemplateData(templateId);
      
      if (!templateData) {
        throw new Error(`Template "${templateId}" not found`);
      }
      
      // Create nodes with custom IDs
      const nodeIds = await this.createNodesFromTemplate(templateData, options.parentNodeId!);
      
      options.onSuccess?.(
        `Successfully imported "${templateData.name}": ${nodeIds.length} nodes created`
      );
      
      return nodeIds;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      options.onError?.(`Template import failed: ${message}`);
      return null;
    }
  }

  async importFromFile(
    file: File, 
    options: ImportExportOptions
  ): Promise<NodeId[] | null> {
    console.log('Custom file import:', file.name);
    
    try {
      // Validate file size
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File size exceeds 10MB limit');
      }
      
      // Validate file type
      if (!file.name.endsWith('.json')) {
        throw new Error('Only JSON files are supported');
      }
      
      const content = await file.text();
      
      // Custom JSON validation
      let data;
      try {
        data = JSON.parse(content);
      } catch {
        throw new Error('Invalid JSON format');
      }
      
      // Validate data structure
      if (!this.validateImportData(data)) {
        throw new Error('Invalid data structure for import');
      }
      
      // Transform and create nodes
      const nodeIds = await this.createNodesFromData(data, options.parentNodeId!);
      
      options.onSuccess?.(
        `Successfully imported "${file.name}": ${nodeIds.length} nodes created`
      );
      
      return nodeIds;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      options.onError?.(`File import failed: ${message}`);
      return null;
    }
  }

  async exportToJson(
    nodeIds: NodeId[], 
    options?: ImportExportOptions
  ): Promise<boolean> {
    console.log('Custom JSON export:', nodeIds);
    
    try {
      if (nodeIds.length === 0) {
        throw new Error('No nodes selected for export');
      }
      
      // Custom data collection with metadata
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'CustomImportExportService',
          nodeCount: nodeIds.length,
          version: '1.0',
        },
        nodes: await this.collectNodeData(nodeIds),
      };
      
      // Create enhanced JSON with formatting
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Custom filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `hierarchidb-export-${timestamp}.json`;
      
      this.downloadBlob(blob, filename);
      
      options?.onSuccess?.(
        `Successfully exported ${nodeIds.length} nodes to ${filename}`
      );
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      options?.onError?.(`JSON export failed: ${message}`);
      return false;
    }
  }

  async exportToZip(
    nodeIds: NodeId[], 
    options?: ImportExportOptions
  ): Promise<boolean> {
    console.log('Custom ZIP export:', nodeIds);
    
    try {
      // For this example, we'll create a simple ZIP-like structure
      // In a real implementation, you'd use a ZIP library like JSZip
      
      const files: Record<string, string> = {};
      
      // Create individual JSON files for each node
      for (const nodeId of nodeIds) {
        const nodeData = await this.getNodeData(nodeId);
        files[`${nodeData.name || nodeId}.json`] = JSON.stringify(nodeData, null, 2);
      }
      
      // Create a manifest file
      files['manifest.json'] = JSON.stringify({
        exportedAt: new Date().toISOString(),
        nodeCount: nodeIds.length,
        files: Object.keys(files).filter(f => f !== 'manifest.json'),
      }, null, 2);
      
      // For demonstration, we'll export as a single text file
      // In reality, you'd create an actual ZIP archive
      const content = Object.entries(files)
        .map(([filename, content]) => `=== ${filename} ===\n${content}\n`)
        .join('\n');
      
      const blob = new Blob([content], { type: 'text/plain' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `hierarchidb-export-${timestamp}.txt`;
      
      this.downloadBlob(blob, filename);
      
      options?.onSuccess?.(
        `Successfully exported ${nodeIds.length} nodes to ${filename} (ZIP simulation)`
      );
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      options?.onError?.(`ZIP export failed: ${message}`);
      return false;
    }
  }

  // Helper methods
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getTemplateData(templateId: string) {
    const templates = {
      'project-structure': {
        name: 'Project Structure',
        nodes: [
          { name: 'src', type: 'folder' },
          { name: 'docs', type: 'folder' },
          { name: 'tests', type: 'folder' },
          { name: 'README.md', type: 'file' },
        ],
      },
      'team-organization': {
        name: 'Team Organization',
        nodes: [
          { name: 'Engineering', type: 'folder' },
          { name: 'Design', type: 'folder' },
          { name: 'Product', type: 'folder' },
          { name: 'Marketing', type: 'folder' },
        ],
      },
    };
    
    return templates[templateId as keyof typeof templates];
  }

  private validateImportData(data: any): boolean {
    // Custom validation logic
    return Array.isArray(data) || (data && Array.isArray(data.nodes));
  }

  private async createNodesFromTemplate(templateData: any, parentNodeId: NodeId): Promise<NodeId[]> {
    // Simulate node creation
    return templateData.nodes.map(() => `custom-node-${++this.nodeCounter}` as NodeId);
  }

  private async createNodesFromData(data: any, parentNodeId: NodeId): Promise<NodeId[]> {
    // Simulate node creation from file data
    const nodes = Array.isArray(data) ? data : data.nodes;
    return nodes.map(() => `imported-node-${++this.nodeCounter}` as NodeId);
  }

  private async collectNodeData(nodeIds: NodeId[]): Promise<any[]> {
    // Simulate data collection
    return nodeIds.map(id => ({
      id,
      name: `Node ${id}`,
      type: 'file',
      exportedAt: new Date().toISOString(),
    }));
  }

  private async getNodeData(nodeId: NodeId): Promise<any> {
    // Simulate individual node data retrieval
    return {
      id: nodeId,
      name: `Node ${nodeId}`,
      type: 'file',
      content: `Content for ${nodeId}`,
    };
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export function CustomServiceExample() {
  // Create custom service instance
  const customService = new CustomImportExportService();
  
  // Create plugin with custom templates
  const importExportPlugin = createImportExportPlugin(customService, {
    enableTemplateImport: true,
    enableFileImport: true,
    enableJsonExport: true,
    enableZipExport: true, // Enable ZIP for demonstration
    showInToolbar: true,
    showInContextMenu: true,
    availableTemplates: [
      {
        id: 'project-structure',
        name: 'Project Structure',
        description: 'Standard software project structure',
        category: 'Development',
      },
      {
        id: 'team-organization',
        name: 'Team Organization',
        description: 'Basic team organizational structure',
        category: 'Organization',
      },
    ],
  });

  const sampleData = [
    {
      id: 'root-1' as NodeId,
      name: 'Workspace',
      nodeType: 'folder',
      parentNodeId: null,
      hasChildren: true,
    },
  ];

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <h2>Custom Import/Export Service Example</h2>
      
      <TreeTableWithPlugins
        plugins={[importExportPlugin]}
        data={sampleData}
        onNotification={(type, message) => {
          console.log(`[${type.toUpperCase()}] ${message}`);
          // Show notification in UI
        }}
        columns={[
          { id: 'name', header: 'Name', accessorKey: 'name' },
          { id: 'type', header: 'Type', accessorKey: 'nodeType' },
        ]}
        enableSelection
        enableExpansion
        height={400}
      />
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f8ff' }}>
        <h3>Custom Features:</h3>
        <ul>
          <li>✅ File size validation (10MB limit)</li>
          <li>✅ Enhanced JSON export with metadata</li>
          <li>✅ Custom template data generation</li>
          <li>✅ ZIP export simulation</li>
          <li>✅ Detailed error messages</li>
          <li>✅ Progress feedback</li>
        </ul>
        
        <h3>Available Templates:</h3>
        <ul>
          <li><strong>Project Structure</strong> - Standard software project layout</li>
          <li><strong>Team Organization</strong> - Basic team organizational structure</li>
        </ul>
      </div>
    </div>
  );
}