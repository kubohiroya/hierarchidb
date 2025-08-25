# @hierarchidb/runtime-plugin-dialog

Runtime plugin dialog components for HierarchiDB.

## Overview

This package contains dialog components specifically designed for plugin runtime operations. These components were previously located in `@hierarchidb/ui-dialog` but have been moved here for better architectural separation between UI presentation components and runtime plugin functionality.

## Migration from ui-dialog

The following components have been migrated from `@hierarchidb/ui-dialog`:

- `CommonPluginDialog` - Main plugin dialog component for create/edit operations
- `CommonDialogActions` - Standard dialog action buttons
- `UnsavedChangesDialog` - Dialog for handling unsaved changes
- `CommonDialogTitle` - Standardized dialog title component
- Additional utility dialogs (Import, Export, Confirmation, Error, Loading)

### Why the Migration?

1. **Architectural Clarity**: Plugin-related components belong in the runtime layer, not the UI presentation layer
2. **Dependency Management**: Runtime components can have different dependencies than pure UI components
3. **Plugin System Integration**: Closer integration with plugin lifecycle and management
4. **Separation of Concerns**: Clear distinction between general UI components and plugin-specific functionality

## Usage

```typescript
import { CommonPluginDialog } from '@hierarchidb/runtime-plugin-dialog';

// Use in your plugin component
<CommonPluginDialog
  mode="create"
  open={open}
  title="Create New Item"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
>
  {/* Your form content */}
</CommonPluginDialog>
```

## Backward Compatibility

For backward compatibility, `@hierarchidb/ui-dialog` re-exports these components. However, it's recommended to update your imports to use this package directly:

```typescript
// Old (still works but deprecated)
import { CommonPluginDialog } from '@hierarchidb/ui-dialog';

// New (recommended)
import { CommonPluginDialog } from '@hierarchidb/runtime-plugin-dialog';
```

## Components

### CommonPluginDialog

Main dialog component for plugin operations with support for:
- Create and edit modes
- Unsaved changes detection
- Draft saving
- Fullscreen mode
- Custom actions

### UnsavedChangesDialog

Handles unsaved changes with options to:
- Discard changes
- Save as draft (if supported)
- Cancel and continue editing

### CommonDialogActions

Standard action buttons for dialogs:
- Submit/Save
- Cancel
- Additional custom actions

## Dependencies

- React 18+
- Material-UI v6
- @hierarchidb/common-core

## License

MIT