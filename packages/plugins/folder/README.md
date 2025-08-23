# @hierarchidb/plugin-folder

Basic folder plugin for HierarchiDB UI layer that provides container functionality for organizing files and other items in a hierarchical structure.

## Overview

This plugin implements the folder node type in the unified UI plugin system. Folders are container nodes that don't require entity data - they use only TreeNode information from the worker layer.

## Features

- **Folder Creation**: Create new folders with validation
- **Folder Editing**: Rename folders and update descriptions
- **Hierarchical Organization**: Folders can contain other folders and items
- **Validation**: Comprehensive input validation for names and descriptions
- **Context Menus**: Rich context menu support
- **Bulk Operations**: Support for batch operations on multiple folders

## Components

### FolderIcon
Icon component that can display open/closed states for folders.

```tsx
import { FolderIcon } from '@hierarchidb/plugin-folder';

<FolderIcon open={isExpanded} color="primary" />
```

### FolderCreateDialog
Dialog component for creating new folders.

```tsx
import { FolderCreateDialog } from '@hierarchidb/plugin-folder';

<FolderCreateDialog
  parentNodeId="parent-123"
  onSubmit={handleCreate}
  onCancel={handleCancel}
/>
```

### FolderEditDialog
Dialog component for editing existing folders.

```tsx
import { FolderEditDialog } from '@hierarchidb/plugin-folder';

<FolderEditDialog
  nodeId="folder-123"
  currentData={folderData}
  onSubmit={handleUpdate}
  onCancel={handleCancel}
/>
```

## Plugin Configuration

The folder plugin is configured as follows:

- **Node Type**: `folder`
- **Data Source**: TreeNode only (no entity required)
- **Capabilities**: Full CRUD, hierarchical, bulk operations
- **Menu Group**: `basic`
- **Create Order**: 1 (appears first in create menus)

## Data Types

### FolderCreateData
```typescript
interface FolderCreateData {
  name: string;
  description?: string;
}
```

### FolderEditData
```typescript
interface FolderEditData {
  name?: string;
  description?: string;
}
```

### FolderDisplayData
```typescript
interface FolderDisplayData {
  id: TreeNodeId;
  name: string;
  description?: string;
  hasChildren: boolean;
  childCount: number;
  createdAt: number;
  updatedAt: number;
}
```

## Validation Rules

### Folder Names
- Required (cannot be empty)
- Maximum 255 characters
- Cannot contain: `< > : " / \ | ? *`
- Whitespace is trimmed
- Must be unique within parent folder

### Descriptions
- Optional
- Maximum 1000 characters
- Whitespace is trimmed

## Context Menu Actions

The folder plugin provides these context menu items:

- **New Folder**: Create a subfolder
- **Rename**: Edit the folder name
- **Properties**: View folder properties
- **Copy Path**: Copy the folder path to clipboard

## Hooks and Events

The plugin implements comprehensive UI action hooks:

- **beforeShowCreateDialog**: Permission checking
- **onValidateCreateForm**: Input validation
- **afterCreate**: Success handling and navigation
- **beforeStartEdit**: Edit permission checking
- **afterUpdate**: Update success handling
- **beforeDelete**: Deletion confirmation with children warning
- **afterDelete**: Cleanup and refresh
- **onContextMenu**: Dynamic context menu generation

## Testing

The plugin includes comprehensive tests:

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build the plugin
pnpm build

# Type checking
pnpm typecheck
```

## Usage in Applications

### Registration
```typescript
import { UIPluginRegistry } from '@hierarchidb/ui-core';
import { FolderUIPlugin } from '@hierarchidb/plugin-folder';

// Register the plugin
UIPluginRegistry.getInstance().register(FolderUIPlugin);
```

### Integration
Once registered, folders will automatically appear in:
- Create menus (as the first option)
- Tree views with appropriate icons
- Context menus with folder-specific actions
- Bulk operation interfaces

## Architecture

This plugin is part of HierarchiDB's unified UI plugin system:

- **Worker Layer**: Uses existing TreeNode management (no changes required)
- **UI Layer**: Unified plugin interface for consistent UX
- **Data Adapter**: Bridges Worker API with UI plugin system
- **Component Library**: Reusable UI components with Material-UI

## Dependencies

- `@hierarchidb/core`: Core types and interfaces
- `@hierarchidb/ui-core`: UI plugin system and utilities
- `@mui/material`: Material-UI components
- `@mui/icons-material`: Material-UI icons
- `react`: React framework

## Future Ideas

### Hashtag Support with Relational Entities

As a future enhancement, we could implement hashtag functionality for folders where:

- **Hashtags as Relational Entities**: Each tag could be treated as a RelationalEntity in the Worker layer
- **Folder Characterization**: Tags would help express and identify folder characteristics
- **Tag-based Discovery**: Users could list and browse folders that share common tags
- **Cross-folder Relationships**: Tags would create implicit relationships between folders

This would require:
1. Worker-side entity handling for tag management
2. RelationalEntity implementation for tag-folder associations
3. UI components for tag input and display
4. Search and filter capabilities based on tags

Currently, the folder plugin operates as a Worker-less plugin (TreeNode only). When implementing these features in the future, proper null checks should be maintained for backward compatibility with systems that don't have the Worker-side tag services available.

## License

MIT