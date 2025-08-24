# LinkButton Component

A powerful, unified button component that handles complex workflows including validation, confirmation dialogs, database operations, and navigation with proper state management.

## Features

- 🔄 **Loading States**: Automatic loading state management with customizable loading text
- ✅ **Validation**: Built-in validation with error handling
- 💬 **Confirmation Dialogs**: Integrated confirmation dialogs for destructive actions
- 📝 **Multi-Step Workflows**: Sequential step execution with individual error handling
- 🧹 **Cleanup Operations**: Automatic cleanup before navigation
- 🚀 **Navigation**: Seamless integration with React Router
- 🛡️ **Double-Click Prevention**: Built-in protection against accidental double-clicks
- ♿ **Accessibility**: Full ARIA support and keyboard navigation
- 🔧 **Backward Compatible**: Supports legacy props from previous implementations

## Installation

The component is already included in the project. Import it from:

```tsx
import { LinkButton } from '@/containers/ui/LinkButton';
```

## Basic Usage

### Simple Navigation
```tsx
<LinkButton to="/dashboard" variant="contained">
  Go to Dashboard
</LinkButton>
```

### With Validation
```tsx
<LinkButton
  to="/next"
  validate={() => form.isValid()}
  onError={(err) => showError(err.message)}
  variant="contained"
>
  Submit
</LinkButton>
```

### With Confirmation Dialog
```tsx
<LinkButton
  confirmDialog={{
    enabled: true,
    title: "Delete Item",
    message: "Are you sure you want to delete this item?",
    confirmText: "Delete",
    cancelText: "Cancel"
  }}
  onSave={async () => await deleteItem(itemId)}
  onSuccess={() => showToast("Item deleted")}
  color="error"
  startIcon={<DeleteIcon />}
>
  Delete
</LinkButton>
```

### Multi-Step Process
```tsx
<LinkButton
  to="/success"
  replace
  steps={[
    {
      validate: () => form.isValid(),
      execute: async () => await validateData(),
    },
    {
      execute: async () => await saveData(),
      successMessage: "Data saved successfully"
    },
    {
      execute: async () => await notifyServer(),
      onError: (error) => console.warn("Notification failed:", error)
    }
  ]}
  loadingText="Processing..."
  onSuccess={() => analytics.track("FormSubmitted")}
>
  Submit Form
</LinkButton>
```

## API Reference

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `to` | `string` | - | Navigation destination path |
| `replace` | `boolean` | `false` | Replace current history entry |
| `state` | `any` | - | State to pass with navigation |
| `validate` | `() => Promise<boolean> \| boolean` | - | Validation function |
| `validationErrors` | `string[]` | - | Validation error messages |
| `confirmDialog` | `ConfirmDialogConfig` | - | Confirmation dialog configuration |
| `onSave` | `() => Promise<void>` | - | Primary save operation |
| `onCleanup` | `() => Promise<void>` | - | Cleanup before navigation |
| `steps` | `WorkflowStep[]` | - | Multi-step workflow configuration |
| `onBeforeAction` | `() => Promise<boolean> \| boolean` | - | Called before any action |
| `onSuccess` | `() => void` | - | Success callback |
| `onError` | `(error: unknown) => void` | - | Error handler |
| `loadingText` | `string` | - | Text during loading |
| `preventDoubleClick` | `boolean` | `true` | Prevent double-clicks |
| `showSuccessMessage` | `boolean` | `false` | Show success messages |
| `successMessage` | `string` | - | Success message text |
| `ariaLabel` | `string` | - | Accessibility label |

### ConfirmDialogConfig

```typescript
interface ConfirmDialogConfig {
  enabled: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonProps?: Partial<LoadingButtonProps>;
}
```

### WorkflowStep

```typescript
interface WorkflowStep {
  validate?: () => Promise<boolean> | boolean;
  execute: () => Promise<void>;
  onError?: (error: Error) => void;
  successMessage?: string;
}
```

## Hook Usage

For advanced use cases, you can use the `useLinkButton` hook directly:

```tsx
import { useLinkButton } from '@/containers/ui/LinkButton';

function CustomButton() {
  const { loading, confirmOpen, handleClick, handleConfirm, handleCancel } = useLinkButton({
    to: "/next",
    onSave: async () => await saveData(),
    confirmDialog: {
      enabled: true,
      message: "Are you sure?"
    }
  });

  // Custom implementation using hook state
}
```

## Migration Guide

See [REFACTORING_EXAMPLES.md](./REFACTORING_EXAMPLES.md) for detailed examples of migrating existing button patterns to LinkButton.

## Testing

The component includes comprehensive tests. Run them with:

```bash
npm test LinkButton.test.tsx
```

## Best Practices

1. **Always handle errors**: Provide an `onError` handler for better UX
2. **Use appropriate validation**: Simple checks with `validate`, complex with step validation
3. **Provide loading feedback**: Use `loadingText` for operations that take time
4. **Consider confirmation**: Use `confirmDialog` for destructive actions
5. **Clean up properly**: Use `onCleanup` for any necessary cleanup
6. **Think in steps**: Break complex operations into steps for better error handling

## Examples

For more examples and migration patterns, see:
- [REFACTORING_EXAMPLES.md](./REFACTORING_EXAMPLES.md)
- Component tests in `LinkButton.test.tsx`

## Contributing

When adding new features to LinkButton:
1. Maintain backward compatibility
2. Add comprehensive tests
3. Update documentation
4. Consider accessibility implications