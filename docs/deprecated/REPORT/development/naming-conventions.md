# Naming Conventions for Node Operations

## Overview

This document defines the standardized terminology for node operations in HierarchiDB. These conventions must be followed consistently across all code, APIs, and documentation.

## Core Terminology Rules

### 1. `moveToTrash`
**Purpose**: Moving nodes to the trash (soft delete)  
**Usage Context**: 
- When users want to remove nodes but keep them recoverable
- Default deletion action in the UI
- API methods for trash operations

**Examples**:
```typescript
// Correct
await api.moveToTrash({ nodeIds: [...] });
await api.moveToTrashFolder({ ... });

// Incorrect (don't use these)
await api.delete({ nodeIds: [...] });  // Wrong: ambiguous
await api.remove({ nodeIds: [...] });  // Wrong: remove is for permanent deletion
```

### 2. `remove`
**Purpose**: Permanently deleting nodes from trash  
**Usage Context**:
- Emptying trash
- Permanent deletion of already-trashed items
- Non-recoverable deletion operations

**Examples**:
```typescript
// Correct
await api.remove({ nodeIds: [...] });  // Permanently delete from trash
await api.removeFolder({ ... });

// Incorrect (don't use these)
await api.permanentDelete({ ... });  // Wrong: too verbose
await api.delete({ ... });  // Wrong: ambiguous
```

### 3. `discard`
**Purpose**: Discarding working copies without committing  
**Usage Context**:
- Canceling edit operations
- Cleaning up temporary working copies
- Reverting uncommitted changes

**Examples**:
```typescript
// Correct
await api.discardWorkingCopy({ workingCopyId: ... });
await ephemeralDB.discardWorkingCopy(id);

// Incorrect (don't use these)
await api.deleteWorkingCopy({ ... });  // Wrong: delete is for database operations
await api.removeWorkingCopy({ ... });  // Wrong: remove is for permanent deletion
```

### 4. `delete`
**Purpose**: Internal database operations only  
**Usage Context**:
- Dexie database operations
- IndexedDB operations
- Low-level database cleanup

**Examples**:
```typescript
// Correct (internal use only)
await db.nodes.delete(id);  // Dexie operation
await coreDB.deleteNode(id);  // Internal database method
indexedDB.deleteDatabase(name);  // IndexedDB operation

// Incorrect (don't expose in public APIs)
await api.deleteNode({ ... });  // Wrong: use moveToTrash or remove instead
```

## API Method Naming

### Command Types
```typescript
// Correct naming
type CommandKind = 
  | 'moveToTrash'      // Moving to trash
  | 'recoverFromTrash'  // Restoring from trash
  | 'remove'            // Permanent deletion
  | 'discardWorkingCopy' // Canceling edits
  | 'discardWorkingCopyForCreate' // Canceling creation

// Avoid these names
// ❌ 'delete' - Too ambiguous
// ❌ 'permanentDelete' - Use 'remove' instead
// ❌ 'destroy' - Not descriptive enough
// ❌ 'eliminate' - Not standard terminology
```

### Payload Types
```typescript
// Correct naming
interface MoveToTrashPayload { ... }
interface RemovePayload { ... }       // Not PermanentDeletePayload
interface DiscardWorkingCopyPayload { ... }

// Service methods
interface TreeMutationService {
  moveToTrash(payload: MoveToTrashPayload): Promise<Result>;
  remove(payload: RemovePayload): Promise<Result>;  // Not permanentDelete
  recoverFromTrash(payload: RecoverFromTrashPayload): Promise<Result>;
  discardWorkingCopy(payload: DiscardWorkingCopyPayload): Promise<Result>;
}
```

## UI Text Guidelines

### Button Labels
- **"Move to Trash"** - For moving items to trash
- **"Remove"** - For permanent deletion from trash
- **"Empty Trash"** - For removing all trash items
- **"Restore"** - For recovering from trash
- **"Discard Changes"** - For canceling edits

### Confirmation Messages
```typescript
// Correct
"Are you sure you want to move these items to trash?"
"Are you sure you want to remove these items? This action cannot be undone."
"Discard unsaved changes?"

// Avoid
"Are you sure you want to delete?"  // Ambiguous
"Permanently delete these items?"   // Use "remove" instead
```

### Icon Associations
- 🗑️ `Delete` icon → "Move to Trash" action
- ❌ `Clear` icon → "Remove" action (permanent)
- ♻️ `Restore` icon → "Restore from Trash" action
- 🚫 `Cancel` icon → "Discard" action

## Migration Guide

When updating existing code:

1. **Search and Replace**:
   - `permanentDelete` → `remove`
   - `PermanentDeletePayload` → `RemovePayload`
   - `deleteWorkingCopy` → `discardWorkingCopy` (except Dexie operations)

2. **Review Context Menus**:
   - Ensure "Remove" in regular context means "Move to Trash"
   - Use "Remove" for permanent deletion only in trash context

3. **Update Tests**:
   - Test descriptions should use correct terminology
   - Mock method names should match the new conventions

## Enforcement

### ESLint Rules
Consider adding custom ESLint rules to enforce these conventions:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-properties': [
      'error',
      {
        object: 'api',
        property: 'permanentDelete',
        message: 'Use api.remove() instead of api.permanentDelete()'
      },
      {
        object: 'api',
        property: 'delete',
        message: 'Use api.moveToTrash() or api.remove() instead of api.delete()'
      }
    ]
  }
};
```

### Code Review Checklist
- [ ] Uses `moveToTrash` for trash operations
- [ ] Uses `remove` for permanent deletion (not `permanentDelete`)
- [ ] Uses `discard` for working copy cancellation
- [ ] Uses `delete` only for internal database operations
- [ ] UI text follows the guidelines
- [ ] Test descriptions use correct terminology

## Rationale

These conventions were established to:

1. **Avoid Ambiguity**: `delete` is too generic and doesn't indicate whether the action is reversible
2. **Match User Expectations**: Users expect "Move to Trash" to be recoverable
3. **Prevent Conflicts**: JavaScript's `delete` operator could cause confusion
4. **Improve Code Clarity**: Explicit action names make code self-documenting
5. **Ensure Consistency**: Uniform terminology across the entire codebase

## Examples in Practice

### Creating a Delete Button
```typescript
// Correct implementation
function DeleteButton({ nodeIds }: Props) {
  const handleClick = async () => {
    if (isInTrash) {
      // In trash context: permanent removal
      await api.remove({ nodeIds });
    } else {
      // Regular context: move to trash
      await api.moveToTrash({ nodeIds });
    }
  };
  
  return (
    <Button onClick={handleClick}>
      {isInTrash ? 'Remove' : 'Move to Trash'}
    </Button>
  );
}
```

### Working Copy Operations
```typescript
// Correct implementation
async function cancelEdit(workingCopyId: string) {
  // Use discard for working copies
  await api.discardWorkingCopy({ workingCopyId });
  
  // NOT: await api.deleteWorkingCopy({ workingCopyId });
  // NOT: await api.removeWorkingCopy({ workingCopyId });
}
```

## References

- [API Documentation](../api/mutations.md)
- [UI Component Guidelines](../ui/components.md)
- [Database Operations](../database/operations.md)

---

**Last Updated**: 2025-01-19  
**Version**: 1.0.0  
**Maintainer**: Development Team

⚠️ **Important**: This is a living document. Any changes to these conventions must be discussed with the team and applied consistently across the entire codebase.