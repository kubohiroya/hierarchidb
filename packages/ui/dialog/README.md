# @hierarchidb/ui-dialog

Common dialog components and utilities for HierarchiDB plugin system.

## Overview

This package provides reusable dialog components that implement the dialog specification from `docs/X-dialog.md`. It ensures consistent UI/UX across all plugin dialogs and implements the working copy pattern for data management.

## Features

- **Common Dialog Components**: Standardized dialog layouts with consistent styling
- **Working Copy Pattern**: Automatic management of temporary edit states
- **Multi-step Dialogs**: Built-in stepper navigation for complex workflows
- **Unsaved Changes Protection**: Automatic detection and confirmation dialogs
- **Draft Support**: Save incomplete work as drafts
- **TypeScript Support**: Full type definitions for all components

## Installation

```bash
pnpm add @hierarchidb/ui-dialog
```

## Usage

### Simple Dialog

```tsx
import { CommonPluginDialog } from '@hierarchidb/ui-dialog';

function MyPluginDialog({ open, onClose }) {
  const [formData, setFormData] = useState({ name: '', description: '' });
  
  return (
    <CommonPluginDialog
      mode="create"
      open={open}
      title="Create Item"
      onSubmit={async (data) => {
        // Save data
        console.log('Submitted:', data);
      }}
      onCancel={onClose}
      formData={formData}
      onFormDataChange={setFormData}
      isValid={formData.name.length > 0}
    >
      {/* Your form content */}
      <TextField
        label="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
    </CommonPluginDialog>
  );
}
```

### Multi-step Dialog with Custom Footer

```tsx
import { StepperDialog, CustomFooterProps } from '@hierarchidb/ui-dialog';

function MyStepperDialog({ open, onClose }) {
  const [canStartBatch, setCanStartBatch] = useState(false);
  
  const steps = [
    {
      label: 'Basic Info',
      content: <BasicInfoStep />,
      validate: () => formData.name.length > 0,
    },
    {
      label: 'Configuration',
      content: <ConfigurationStep />,
      optional: true,
    },
    {
      label: 'Processing',
      content: <ProcessingStep />,
    },
  ];
  
  // Custom footer with additional "Start Batch" button
  const renderCustomFooter = (props: CustomFooterProps) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, width: '100%' }}>
      <Button onClick={props.isFirstStep ? props.onCancel : props.onBack} variant="outlined">
        {props.isFirstStep ? 'Cancel' : 'Back'}
      </Button>
      
      <Stack direction="row" spacing={2}>
        {!props.isLastStep && (
          <Button onClick={props.onNext} variant="contained" disabled={!props.canGoNext}>
            Next
          </Button>
        )}
        
        {props.currentStep >= 2 && ( // Show from step 3 onwards
          <Button 
            onClick={handleStartBatch} 
            variant="contained" 
            color="success"
            disabled={!canStartBatch}
          >
            Start Batch
          </Button>
        )}
        
        {props.isLastStep && (
          <Button onClick={props.onSubmit} variant="contained">
            Save
          </Button>
        )}
      </Stack>
    </Box>
  );
  
  return (
    <StepperDialog
      mode="create"
      open={open}
      title="Create Configuration"
      steps={steps}
      customFooterContent={renderCustomFooter}
      onSubmit={async (data) => {
        console.log('Submitted:', data);
      }}
      onCancel={onClose}
    />
  );
}
```

### Working Copy Hook

```tsx
import { useWorkingCopy } from '@hierarchidb/ui-dialog';

function MyEditDialog({ nodeId }) {
  const {
    workingCopy,
    updateWorkingCopy,
    commitChanges,
    discardChanges,
    isDirty,
  } = useWorkingCopy({
    mode: 'edit',
    nodeId,
    initialData: { /* load from database */ },
    onCommit: async (data) => {
      // Save to permanent storage
      await saveToDatabase(data);
    },
  });
  
  return (
    <CommonPluginDialog
      mode="edit"
      open={true}
      hasUnsavedChanges={isDirty}
      onSubmit={commitChanges}
      onCancel={discardChanges}
    >
      {/* Form content using workingCopy.data */}
    </CommonPluginDialog>
  );
}
```

## Components

### CommonPluginDialog

Base dialog component with built-in unsaved changes detection.

**Props:**
- `mode`: 'create' | 'edit'
- `open`: boolean
- `title`: string
- `icon`: ReactNode (optional)
- `onSubmit`: (data) => Promise<void>
- `onCancel`: () => void
- `hasUnsavedChanges`: boolean (optional)
- `supportsDraft`: boolean (optional)
- `onSaveDraft`: (data) => Promise<void> (optional)

### StepperDialog

Multi-step dialog with stepper navigation and fullscreen support.

**Props:**
- All CommonPluginDialog props
- `steps`: Array of step configurations
- `activeStep`: number (optional, for controlled mode)
- `onStepChange`: (step: number) => void (optional)
- `nonLinear`: boolean (optional, allows jumping between steps)
- `fullScreen`: boolean (optional, initial fullscreen state)
- `headerActions`: ReactNode (optional, additional header buttons)
- `customFooterContent`: (props: CustomFooterProps) => ReactNode (optional, custom footer)

**Features:**
- **Fullscreen Toggle**: Built-in fullscreen/windowed mode switching
- **Custom Footer**: Replace default navigation with custom button layout  
- **Non-linear Navigation**: Jump between steps when validation allows
- **Auto-validation**: Steps validate automatically before allowing progression
- **Draft Support**: Save incomplete work with `supportsDraft` prop

### UnsavedChangesDialog

Confirmation dialog for discarding unsaved changes.

**Props:**
- `open`: boolean
- `title`: string
- `message`: string
- `showSaveDraft`: boolean
- `onDiscard`: () => void
- `onSaveDraft`: () => void (optional)
- `onCancel`: () => void

### CommonDialogTitle

Standardized dialog title with icon and draft indicator.

### CommonDialogActions

Standardized dialog action buttons with consistent layout.

## Hooks

### useWorkingCopy

Manages temporary working copy state with auto-save support.

**Options:**
- `mode`: 'create' | 'edit'
- `nodeId`: TreeNodeId (for edit mode)
- `parentNodeId`: TreeNodeId (for create mode)
- `initialData`: Initial form data
- `autoSave`: boolean (default: true)
- `autoSaveDelay`: number (milliseconds, default: 1000)
- `onSave`: Save working copy to temporary storage
- `onCommit`: Commit to permanent storage
- `onDiscard`: Clean up working copy

**Returns:**
- `workingCopy`: Current working copy state
- `updateWorkingCopy`: Update function
- `commitChanges`: Commit to permanent storage
- `discardChanges`: Discard and clean up
- `saveAsDraft`: Save as draft
- `isDirty`: Has unsaved changes
- `isProcessing`: Operation in progress
- `error`: Current error if any

### useDialogContext

Access shared dialog state within dialog components.

## Migration Guide

### From Custom Dialogs

1. Replace your Dialog wrapper with `CommonPluginDialog`
2. Move form content to children
3. Add working copy management with `useWorkingCopy`
4. Implement validation and pass `isValid` prop

### From Inline Dialogs

1. Extract dialog to separate component
2. Use `CommonPluginDialog` as wrapper
3. Implement proper data flow with props
4. Add unsaved changes detection

## Best Practices

1. **Always use working copy pattern** for edit operations
2. **Implement validation** at each step for multi-step dialogs
3. **Handle errors gracefully** with try-catch in submit handlers
4. **Provide loading states** during async operations
5. **Support draft saving** for complex forms
6. **Use TypeScript** for better type safety

## License

Proprietary - Part of HierarchiDB