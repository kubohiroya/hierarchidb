# LinkButton Refactoring Examples

This document provides examples of how to refactor existing button patterns to use the enhanced LinkButton component.

## 1. Dialog Submit Button with Loading State

### Before
```tsx
// From: /src/lib/components/dialogs/SubmitDialog/SubmitDialogActionPanel.tsx
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  if (!canSubmit) return;
  
  setIsSubmitting(true);
  try {
    await saveData();
    navigate("../..", { replace: true });
  } catch (error) {
    console.error("Failed to submit:", error);
  } finally {
    setIsSubmitting(false);
  }
};

<Button
  variant="contained"
  disabled={!canSubmit || isSubmitting}
  onClick={handleSubmit}
>
  {isSubmitting ? "Saving..." : "Submit"}
</Button>
```

### After
```tsx
<LinkButton
  to="../.."
  replace
  validate={() => canSubmit}
  onSave={async () => await saveData()}
  loadingText="Saving..."
  onError={(error) => console.error("Failed to submit:", error)}
  variant="contained"
>
  Submit
</LinkButton>
```

### Benefits
- Eliminates manual loading state management
- Built-in error handling
- Cleaner, more declarative code
- Automatic navigation on success

## 2. Delete Button with Confirmation Dialog

### Before
```tsx
// From: /src/lib/components/dialogs/ResourceRemoveDialog.tsx
const [removing, setRemoving] = useState(false);
const [confirmOpen, setConfirmOpen] = useState(false);

const handleDelete = async () => {
  setRemoving(true);
  try {
    // Check references
    const refs = await checkReferences();
    if (refs.length > 0) {
      await removeReferences(refs);
    }
    await deleteResource(resourceId);
    onDeleteComplete();
  } catch (error) {
    console.error("Delete failed:", error);
  } finally {
    setRemoving(false);
  }
};

<>
  <Button
    variant="contained"
    color="error"
    onClick={() => setConfirmOpen(true)}
    disabled={removing}
    startIcon={removing ? <CircularProgress size={20} /> : <Delete />}
  >
    Delete
  </Button>
  <ConfirmDialog
    open={confirmOpen}
    onConfirm={handleDelete}
    onCancel={() => setConfirmOpen(false)}
    title="Delete Resource"
    message="Are you sure you want to delete this resource?"
  />
</>
```

### After
```tsx
<LinkButton
  confirmDialog={{
    enabled: true,
    title: "Delete Resource",
    message: "Are you sure you want to delete this resource?",
    confirmButtonProps: { color: "error" }
  }}
  steps={[
    {
      execute: async () => {
        const refs = await checkReferences();
        if (refs.length > 0) {
          await removeReferences(refs);
        }
      },
      onError: (error) => console.error("Reference removal failed:", error)
    },
    {
      execute: async () => await deleteResource(resourceId),
      successMessage: "Resource deleted successfully"
    }
  ]}
  onSuccess={onDeleteComplete}
  onError={(error) => console.error("Delete failed:", error)}
  variant="contained"
  color="error"
  startIcon={<Delete />}
  loadingText="Deleting..."
>
  Delete
</LinkButton>
```

### Benefits
- Integrated confirmation dialog
- Multi-step process with individual error handling
- No manual state management for dialog or loading
- Clear separation of concerns

## 3. Save and Navigate Pattern

### Before
```tsx
// From: /src/lib/shared/components/resources/ResourceDialog.tsx
const handleSubmit = useCallback(async () => {
  if (!resourceState.canSubmitForm) return;
  
  isSubmittingRef.current = true;
  
  try {
    // Convert draft to final node type
    if (resourceState.shapesId) {
      await treeNodesDB.updateNodeTx(resourceState.shapesId, {
        type: getFinalNodeType(),
      });
    }
    
    if (mode === "create") {
      sessionStorage.removeItem(sessionStorageKey);
    }
    
    navigate("../..", { replace: true });
  } catch (error) {
    devError("Failed to submit resource:", error);
    isSubmittingRef.current = false;
  }
}, [resourceState, mode, sessionStorageKey, navigate, getFinalNodeType, treeNodesDB]);

<Button
  type="submit"
  variant="contained"
  disabled={!resourceState.canSubmitForm || isSubmittingRef.current}
  onClick={handleSubmit}
>
  {isSubmittingRef.current ? "Saving..." : "Create"}
</Button>
```

### After
```tsx
<LinkButton
  to="../.."
  replace
  validate={() => resourceState.canSubmitForm}
  onSave={async () => {
    if (resourceState.shapesId) {
      await treeNodesDB.updateNodeTx(resourceState.shapesId, {
        type: getFinalNodeType(),
      });
    }
  }}
  onCleanup={async () => {
    if (mode === "create") {
      sessionStorage.removeItem(sessionStorageKey);
    }
  }}
  onError={(error) => devError("Failed to submit resource:", error)}
  loadingText="Saving..."
  variant="contained"
  type="submit"
>
  Create
</LinkButton>
```

### Benefits
- Clear separation of save and cleanup operations
- Automatic navigation handling
- Built-in validation
- No manual ref management for submit state

## 4. Multi-Step Save Process

### Before
```tsx
// Common pattern in stepper dialogs
const handleNext = async () => {
  setLoading(true);
  try {
    // Step 1: Validate
    if (!isFormValid()) {
      showError("Please fill all required fields");
      return;
    }
    
    // Step 2: Create draft if needed
    if (currentStep === 1 && !draftId) {
      const draft = await createDraft();
      setDraftId(draft.id);
    }
    
    // Step 3: Save current step data
    await saveStepData(currentStep, formData);
    
    // Step 4: Navigate to next step
    setCurrentStep(currentStep + 1);
  } catch (error) {
    console.error("Failed to proceed:", error);
  } finally {
    setLoading(false);
  }
};

<Button onClick={handleNext} disabled={loading}>
  {loading ? "Saving..." : "Next"}
</Button>
```

### After
```tsx
<LinkButton
  steps={[
    {
      validate: () => isFormValid(),
      execute: async () => {
        if (currentStep === 1 && !draftId) {
          const draft = await createDraft();
          setDraftId(draft.id);
        }
      }
    },
    {
      execute: async () => await saveStepData(currentStep, formData),
      successMessage: "Step saved"
    }
  ]}
  onSuccess={() => setCurrentStep(currentStep + 1)}
  onError={(error) => console.error("Failed to proceed:", error)}
  loadingText="Saving..."
>
  Next
</LinkButton>
```

### Benefits
- Sequential step execution with individual error handling
- Built-in validation at each step
- Success messages for user feedback
- Cleaner, more maintainable code

## 5. Cancel Button with Unsaved Changes Warning

### Before
```tsx
// From: /src/lib/components/dialogs/UnsavedChangesDialog.tsx
const handleCancel = async () => {
  if (hasUnsavedChanges) {
    setConfirmOpen(true);
  } else {
    navigate("..", { replace: true });
  }
};

const handleConfirmCancel = async () => {
  try {
    await cleanupDraft();
    navigate("..", { replace: true });
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
};

<>
  <Button variant="outlined" onClick={handleCancel}>
    Cancel
  </Button>
  <ConfirmDialog
    open={confirmOpen}
    onConfirm={handleConfirmCancel}
    message="You have unsaved changes. Are you sure you want to cancel?"
  />
</>
```

### After
```tsx
<LinkButton
  to=".."
  replace
  confirmDialog={{
    enabled: hasUnsavedChanges,
    title: "Unsaved Changes",
    message: "You have unsaved changes. Are you sure you want to cancel?",
    cancelText: "Keep Editing",
    confirmText: "Discard Changes"
  }}
  onCleanup={async () => {
    if (hasUnsavedChanges) {
      await cleanupDraft();
    }
  }}
  onError={(error) => console.error("Cleanup failed:", error)}
  variant="outlined"
>
  Cancel
</LinkButton>
```

### Benefits
- Conditional confirmation based on state
- Integrated cleanup operations
- No separate dialog component needed
- Clear user-facing button labels

## Migration Checklist

When refactoring to use LinkButton, look for these patterns:

- [ ] Buttons with manual loading state (`useState` for loading/submitting)
- [ ] Buttons with separate confirmation dialogs
- [ ] Submit handlers with try/catch blocks
- [ ] Navigation after async operations
- [ ] Multi-step processes with sequential operations
- [ ] Cleanup operations before navigation
- [ ] Validation before action execution
- [ ] Double-click prevention logic
- [ ] Error handling with user feedback

## Common Patterns Summary

| Pattern | LinkButton Props |
|---------|-----------------|
| Loading state | `loadingText` |
| Confirmation | `confirmDialog` |
| Validation | `validate` |
| Save operation | `onSave` |
| Multi-step | `steps` |
| Cleanup | `onCleanup` |
| Navigation | `to`, `replace` |
| Error handling | `onError` |
| Success callback | `onSuccess` |
| Before action | `onBeforeAction` |

## Best Practices

1. **Use steps for complex workflows**: If you have multiple async operations, use the `steps` array instead of a single `onSave`
2. **Leverage validation**: Use the `validate` prop for simple checks, or step validation for complex workflows
3. **Provide user feedback**: Use `loadingText` and `successMessage` for better UX
4. **Handle errors gracefully**: Always provide an `onError` handler
5. **Clean up resources**: Use `onCleanup` for any cleanup operations
6. **Consider confirmation**: Use `confirmDialog` for destructive actions
7. **Maintain backward compatibility**: The component still supports legacy props like `onBeforeNavigate`