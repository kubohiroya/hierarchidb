# @hierarchidb/ui-dialog

Runtime plugin dialog components for HierarchiDB.

## Overview

This package contains dialog components specifically designed for plugin runtime operations. These components were previously located in `@hierarchidb/ui-dialog` but have been moved here for better architectural separation between UI presentation components and runtime plugin functionality.

## Components

- `CommonDialog` - Main plugin dialog component for create/edit operations
- `CommonDialogActions` - Standard dialog action buttons
- `UnsavedChangesDialog` - Dialog for handling unsaved changes
- `CommonDialogTitle` - Standardized dialog title component
- Additional utility dialogs (Import, Export, Confirmation, Error, Loading)

## Usage

```typescript
import { CommonDialog } from '@hierarchidb/runtime-plugin-base-dialog';

// Use in your plugin component
<CommonDialog
  mode="create"
  open={open}
  title="Create New Item"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
>
  {/* Your form content */}
</CommonDialog>
```

## Components

### CommonDialog

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