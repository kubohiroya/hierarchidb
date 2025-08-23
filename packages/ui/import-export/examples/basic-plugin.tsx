/**
 * Basic Import/Export Plugin Usage Example
 * 
 * This example shows how to use the Import/Export plugin with TreeTable
 * in its simplest form.
 */

import React from 'react';
import { TreeTableWithPlugins } from '@hierarchidb/ui/treeconsole/treetable';
import { 
  createImportExportPlugin, 
  DefaultImportExportService 
} from '@hierarchidb/ui-import-export-plugin';
import type { NodeId } from '@hierarchidb/00-core';

// Sample tree data
const sampleData = [
  {
    id: 'root-1' as NodeId,
    name: 'Documents',
    nodeType: 'folder',
    parentNodeId: null,
    hasChildren: true,
    children: [
      {
        id: 'node-1' as NodeId,
        name: 'Report.pdf',
        nodeType: 'file',
        parentNodeId: 'root-1' as NodeId,
        hasChildren: false,
      },
      {
        id: 'node-2' as NodeId,
        name: 'Presentation.pptx',
        nodeType: 'file',
        parentNodeId: 'root-1' as NodeId,
        hasChildren: false,
      },
    ],
  },
];

export function BasicPluginExample() {
  // Create the import/export service
  const importExportService = new DefaultImportExportService();
  
  // Create the plugin with basic configuration
  const importExportPlugin = createImportExportPlugin(importExportService, {
    enableTemplateImport: true,
    enableFileImport: true,
    enableJsonExport: true,
    enableZipExport: false, // Disabled for simplicity
    showInToolbar: true,
    showInContextMenu: true,
    requireSelection: false, // Allow export without selection
  });

  // Simple notification handler
  const handleNotification = (type: string, message: string) => {
    console.log(`${type.toUpperCase()}: ${message}`);
    // In a real app, you would show this in a toast notification
  };

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <h2>Basic Import/Export Plugin Example</h2>
      
      <TreeTableWithPlugins
        plugins={[importExportPlugin]}
        data={sampleData}
        onNotification={handleNotification}
        columns={[
          { id: 'name', header: 'Name', accessorKey: 'name' },
          { id: 'type', header: 'Type', accessorKey: 'nodeType' },
        ]}
        enableSelection
        enableExpansion
        height={400}
      />
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5' }}>
        <h3>Features Available:</h3>
        <ul>
          <li>✅ Import from JSON File (toolbar button)</li>
          <li>✅ Import from Template (toolbar button → dropdown)</li>
          <li>✅ Export as JSON (toolbar button → dropdown)</li>
          <li>✅ Context menu integration (right-click on nodes)</li>
          <li>❌ ZIP export (disabled in this example)</li>
        </ul>
        
        <h3>How to Test:</h3>
        <ol>
          <li>Click the Import/Export button in the toolbar</li>
          <li>Try importing from a template</li>
          <li>Select some nodes and export as JSON</li>
          <li>Right-click on nodes to see context menu options</li>
        </ol>
      </div>
    </div>
  );
}