# @hierarchidb/ui-import-export-plugin

Import/Export plugin for HierarchiDB TreeTable with plugin architecture support.

## Overview

This package provides import and export functionality for TreeTable as a plugin, allowing you to add import/export capabilities without modifying existing code. It supports:

- **Template Import**: Import from predefined templates
- **File Import**: Import from JSON files
- **JSON Export**: Export selected nodes as JSON
- **ZIP Export**: Export selected nodes as ZIP archive
- **Plugin Architecture**: Non-breaking extension of TreeTable

## Installation

```bash
pnpm add @hierarchidb/ui-import-export-plugin
```

## Basic Usage

### Using as a Plugin

```typescript
import { TreeTableWithPlugins } from '@hierarchidb/ui/treeconsole/treetable';
import { 
  createImportExportPlugin, 
  DefaultImportExportService 
} from '@hierarchidb/ui-import-export-plugin';

// Create the plugin
const importExportService = new DefaultImportExportService();
const importExportPlugin = createImportExportPlugin(importExportService, {
  enableTemplateImport: true,
  enableFileImport: true,
  enableJsonExport: true,
  enableZipExport: true,
  showInToolbar: true,
  showInContextMenu: true,
  availableTemplates: [
    {
      id: 'my-template',
      name: 'My Custom Template',
      description: 'A custom template for my use case',
      category: 'Custom',
    },
  ],
});

// Use with TreeTable
function MyTreeTable() {
  return (
    <TreeTableWithPlugins
      plugins={[importExportPlugin]}
      // ... other TreeTable props
    />
  );
}
```

### Using Components Directly

```typescript
import { ImportExportButton, useImportExport } from '@hierarchidb/ui-import-export-plugin';

function CustomToolbar() {
  const {
    loading,
    handleTemplateImport,
    handleFileImport,
    handleExport,
  } = useImportExport({
    parentNodeId: 'parent-123' as NodeId,
    selectedNodeIds: ['node-1', 'node-2'] as NodeId[],
    onSuccess: (message) => console.log('Success:', message),
    onError: (error) => console.error('Error:', error),
  });

  return (
    <ImportExportButton
      disabled={loading}
      onImportFile={() => {
        // Handle file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) handleFileImport(file);
        };
        input.click();
      }}
      onImportTemplate={handleTemplateImport}
      onExportJson={() => handleExport('json')}
      onExportZip={() => handleExport('zip')}
      availableTemplates={[
        { id: 'template-1', name: 'Template 1' },
      ]}
    />
  );
}
```

## Plugin Configuration

### ImportExportPluginConfig

```typescript
interface ImportExportPluginConfig {
  // Feature toggles
  enableTemplateImport?: boolean;     // Default: true
  enableFileImport?: boolean;         // Default: true
  enableJsonExport?: boolean;         // Default: true
  enableZipExport?: boolean;          // Default: false
  
  // UI configuration
  showInToolbar?: boolean;            // Default: true
  showInContextMenu?: boolean;        // Default: true
  requireSelection?: boolean;         // Default: false
  buttonPosition?: 'start' | 'end' | 'before-more' | 'after-more'; // Default: 'before-more'
  
  // Templates
  availableTemplates?: TemplateDefinition[];
}
```

### Template Definition

```typescript
interface TemplateDefinition {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
  category?: string;
  requiredPermissions?: string[];
}
```

## Custom Import/Export Service

You can provide your own import/export service by implementing the `ImportExportService` interface:

```typescript
import type { ImportExportService } from '@hierarchidb/ui-import-export-plugin';

class CustomImportExportService implements ImportExportService {
  async importFromTemplate(templateId: string, options: ImportExportOptions): Promise<NodeId[] | null> {
    // Your custom template import logic
    console.log('Importing template:', templateId);
    return ['new-node-1', 'new-node-2'] as NodeId[];
  }

  async importFromFile(file: File, options: ImportExportOptions): Promise<NodeId[] | null> {
    // Your custom file import logic
    const content = await file.text();
    const data = JSON.parse(content);
    // Process data and create nodes
    return ['imported-node-1'] as NodeId[];
  }

  async exportToJson(nodeIds: NodeId[], options?: ImportExportOptions): Promise<boolean> {
    // Your custom JSON export logic
    const data = await this.collectNodeData(nodeIds);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, 'export.json');
    return true;
  }

  async exportToZip(nodeIds: NodeId[], options?: ImportExportOptions): Promise<boolean> {
    // Your custom ZIP export logic
    // ... implementation
    return true;
  }

  private async collectNodeData(nodeIds: NodeId[]) {
    // Collect and structure node data for export
  }

  private downloadBlob(blob: Blob, filename: string) {
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

// Use with plugin
const customService = new CustomImportExportService();
const plugin = createImportExportPlugin(customService);
```

## Advanced Usage

### Multiple Template Categories

```typescript
const templatesWithCategories = [
  {
    id: 'population-2023',
    name: 'Population 2023',
    category: 'Demographics',
    description: 'World population data for 2023',
  },
  {
    id: 'business-org',
    name: 'Business Organization',
    category: 'Organization',
    description: 'Standard business structure template',
  },
  {
    id: 'project-structure',
    name: 'Project Structure',
    category: 'Development',
    description: 'Software project structure template',
  },
];

const plugin = createImportExportPlugin(service, {
  availableTemplates: templatesWithCategories,
  enableZipExport: true,
  buttonPosition: 'end',
});
```

### Context Menu Integration

The plugin automatically adds import/export options to the TreeTable context menu when `showInContextMenu` is enabled:

- **Import from File** - Triggers file selection dialog
- **Import from Template** - Shows submenu with available templates
- **Export as JSON** - Exports selected nodes as JSON
- **Export as ZIP** - Exports selected nodes as ZIP (if enabled)

### Toolbar Position

Choose where the Import/Export button appears in the toolbar:

- `'start'` - At the beginning of the toolbar
- `'end'` - At the end of the toolbar
- `'before-more'` - Before the "More actions" button (default)
- `'after-more'` - After the "More actions" button

## Error Handling

The plugin provides comprehensive error handling with notifications:

```typescript
const plugin = createImportExportPlugin(service, {
  // Errors are automatically shown via context.showNotification
  // Success messages are also displayed
});

// You can also handle errors in your custom service
class MyService implements ImportExportService {
  async importFromFile(file: File, options: ImportExportOptions): Promise<NodeId[] | null> {
    try {
      // ... import logic
      options.onSuccess?.('Import completed successfully');
      return nodeIds;
    } catch (error) {
      options.onError?.(`Import failed: ${error.message}`);
      return null;
    }
  }
}
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  ImportExportService,
  ImportExportPluginConfig,
  TemplateDefinition,
  ImportResult,
  ExportResult,
  ImportExportOptions,
} from '@hierarchidb/ui-import-export-plugin';
```

## Migration from Standalone Package

If you were using the standalone `@hierarchidb/ui-import-export` package, migration is straightforward:

```typescript
// Before (standalone components)
import { ImportExportButton } from '@hierarchidb/ui-import-export';

// After (plugin)
import { createImportExportPlugin } from '@hierarchidb/ui-import-export-plugin';

// Components are still available for direct use
import { ImportExportButton } from '@hierarchidb/ui-import-export-plugin';
```

## Examples

See the `/examples` directory for complete usage examples:

- `basic-plugin.tsx` - Basic plugin usage
- `custom-service.tsx` - Custom import/export service
- `advanced-templates.tsx` - Advanced template configuration
- `standalone-components.tsx` - Using components without plugin system

## API Reference

### Components

- `ImportExportButton` - Main button component
- `ImportExportMenu` - Dropdown menu component

### Hooks

- `useImportExport` - Main hook for import/export functionality

### Plugin

- `createImportExportPlugin` - Creates the plugin instance

### Services

- `DefaultImportExportService` - Default implementation

### Types

All TypeScript interfaces and types for full type safety.