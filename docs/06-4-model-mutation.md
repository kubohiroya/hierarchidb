# 06-4 Mutation Service & Command Model

## 1. Overview

TreeMutationService manages all write operations through a command-based architecture with comprehensive validation, error handling, and undo/redo support. All mutations flow through Worker layer which enforces business rules and propagates errors back to UI through the API.

## 2. Command Model Foundation

### 2.1 Command Envelope Structure

All commands share a common envelope format for consistency and traceability:

```typescript
export interface CommandEnvelope<K extends string, P> {    
  commandId: UUID;              // Unique command identifier
  groupId: UUID;                // Groups related commands for atomic operations
  kind: K;                      // Command type discriminator
  payload: P;                   // Command-specific data
  issuedAt: Timestamp;          // Command timestamp
  sourceViewId?: string;        // Origin view/component for debugging
  onNameConflict?: 'error' | 'auto-rename';  // Name conflict resolution policy
}
```

### 2.2 Command Result Structure

```typescript
export interface CommandResult {
  seq: number;                  // Global sequence number for ordering
  success: boolean;             // Operation success flag
  nodeId?: TreeNodeId;          // Created/modified node ID
  newNodeIds?: TreeNodeId[];    // For bulk operations (duplicate, paste, import)
  error?: {
    code: string;               // Error code for programmatic handling
    message: string;            // Human-readable error message
    details?: any;              // Additional error context
  };
}
```

### 2.3 Command Buffer Architecture

- **Type**: Ring buffer (circular queue)
- **Capacity**: 200 commands (configurable)
- **Storage**: Memory-only (cleared on page reload)
- **Purpose**: Enables undo/redo functionality
- **Eviction**: Oldest commands automatically removed when buffer is full
- **Grouping**: Commands with same `groupId` treated as atomic unit

## 3. Working Copy Operations

Working copies provide isolated editing environments, preventing incomplete edits from affecting the main tree.

### 3.1 Node Creation Flow

#### 3.1.1 Create Working Copy for New Node

```typescript
interface CreateWorkingCopyForCreatePayload {
  workingCopyId: UUID;
  parentTreeNodeId: TreeNodeId;
  nodeType: string;
  name: string;                 // Will be normalized by Worker
  description?: string;
  metadata?: Record<string, any>;
}
```

**Worker Processing**:
- Generates new `treeNodeId`
- Sets `workingCopyOf` to same ID (marks as creation)
- Normalizes name for consistency
- Stores in EphemeralDB
- **NOT undoable** (no side effects)

#### 3.1.2 Discard Creation

```typescript
interface DiscardWorkingCopyPayload {
  workingCopyId: UUID;
}
```

**Worker Processing**:
- Removes from EphemeralDB
- No CoreDB changes
- **NOT undoable** (cleanup only)

#### 3.1.3 Commit New Node

```typescript
interface CommitWorkingCopyForCreatePayload {
  workingCopyId: UUID;
  onNameConflict?: 'error' | 'auto-rename';  // Default: 'auto-rename'
}
```

**Worker Processing**:
- Validates parent exists
- Checks name conflicts among siblings
- Applies conflict resolution policy
- Moves from EphemeralDB to CoreDB
- Removes working copy
- **IS undoable** (creates inverse delete command)

**Returns**: `{ seq: number; nodeId: TreeNodeId }`

### 3.2 Node Update Flow

#### 3.2.1 Create Working Copy for Edit

```typescript
interface CreateWorkingCopyPayload {
  workingCopyId: UUID;
  sourceTreeNodeId: TreeNodeId;
}
```

**Worker Processing**:
- Shallow copies source node
- Generates new `treeNodeId` for working copy
- Sets `workingCopyOf` to source node ID
- Sets `copiedAt` timestamp
- Stores in EphemeralDB
- **NOT undoable** (no permanent changes)

#### 3.2.2 Discard Edits

Same as discard for creation - removes working copy without applying changes.

#### 3.2.3 Commit Edits

```typescript
interface CommitWorkingCopyPayload {
  workingCopyId: UUID;
  expectedUpdatedAt?: Timestamp;  // For optimistic locking
  onNameConflict?: 'error' | 'auto-rename';
}
```

**Worker Processing**:
- Validates optimistic lock if provided
- Checks name conflicts if name changed
- Replaces original node with working copy data
- Updates `updatedAt` timestamp
- Removes working copy
- **IS undoable** (stores original state)

**Returns**: `{ seq: number }`

## 4. Physical Operations

### 4.1 Move Operations

```typescript
interface MoveNodesPayload {
  nodeIds: TreeNodeId[];
  toParentId: TreeNodeId;
  position?: number;            // Insert position in parent's children
  onNameConflict?: 'error' | 'auto-rename';
}
```

#### 4.1.1 Validation Rules (Worker-enforced)

**Circular Reference Prevention**:
- **Cannot move to self**: `E_CIRCULAR_REFERENCE` error
- **Cannot move to own parent**: No-op, but returns success
- **Cannot move to descendant**: `E_CIRCULAR_REFERENCE` error

**Example validation in Worker**:
```typescript
// Worker validation pseudo-code
for (const nodeId of nodeIds) {
  if (nodeId === toParentId) {
    throw new Error('E_CIRCULAR_REFERENCE: Cannot move node into itself');
  }
  
  const ancestors = await getAncestors(toParentId);
  if (ancestors.some(a => a.id === nodeId)) {
    throw new Error('E_CIRCULAR_REFERENCE: Cannot move node into its descendant');
  }
}
```

**Other Validations**:
- Target parent must exist: `E_PARENT_NOT_FOUND`
- Name conflicts handled per policy
- Maintains tree consistency

#### 4.1.2 Error Propagation

Worker errors propagate through Comlink RPC to UI:

```typescript
// UI receives structured error
try {
  await api.moveNodes(command);
} catch (error) {
  if (error.code === 'E_CIRCULAR_REFERENCE') {
    showError('Cannot move folder into itself or its subfolders');
  }
}
```

### 4.2 Duplicate Operations

```typescript
interface DuplicateNodesPayload {
  nodeIds: TreeNodeId[];
  toParentId: TreeNodeId;
  includeDescendants?: boolean;  // Default: true
  onNameConflict?: 'error' | 'auto-rename';
}
```

#### 4.2.1 Validation Rules

**Same as Move**:
- Cannot duplicate to self
- Cannot duplicate to descendant
- Target must exist

**Additional Rules**:
- New IDs generated for all nodes
- References (`referredBy`) not copied
- Suffix added to names by default ("Copy of...")

**Returns**: `{ seq: number; newNodeIds: TreeNodeId[] }`

### 4.3 Paste Operations

```typescript
interface PasteNodesPayload {
  nodes: Record<TreeNodeId, TreeNode>;  // Clipboard content
  nodeIds: TreeNodeId[];                 // Which nodes to paste
  toParentId: TreeNodeId;
  pasteMode?: 'copy' | 'link';          // Default: 'copy'
  onNameConflict?: 'error' | 'auto-rename';
}
```

#### 4.3.1 Validation Rules

**Circular Reference Check**:
- Even though clipboard has new IDs, validates structure
- Prevents pasting parent into child relationship

**Processing**:
- Assigns new IDs to all nodes
- Preserves internal relationships
- Handles name conflicts

**Returns**: `{ seq: number; newNodeIds: TreeNodeId[] }`

### 4.4 Trash Operations

#### 4.4.1 Move to Trash

```typescript
interface MoveToTrashPayload {
  nodeIds: TreeNodeId[];
  preserveReferences?: boolean;  // Default: false
}
```

**Validation**:
- Checks for active references
- If references exist and !preserveReferences: `E_REFERENCE_EXISTS` error
- Stores original parent for recovery

**Processing**:
- Moves to special TrashRoot parent
- Sets `trashedAt` timestamp
- Preserves `originalParentId`

#### 4.4.2 Permanent Delete

```typescript
interface PermanentDeletePayload {
  nodeIds: TreeNodeId[];
  force?: boolean;               // Skip confirmation
}
```

**Validation**:
- Only works on nodes already in trash: `E_NOT_IN_TRASH` error
- Cannot be undone warning

**Processing**:
- Removes from CoreDB permanently
- Cascades to all descendants
- **NOT undoable** (data loss)

#### 4.4.3 Recover from Trash

```typescript
interface RecoverFromTrashPayload {
  nodeIds: TreeNodeId[];
  toParentId?: TreeNodeId;      // Override original parent
  onNameConflict?: 'error' | 'auto-rename';
}
```

**Processing**:
- Restores to original or specified parent
- Handles name conflicts
- Clears trash metadata

### 4.5 Import Operations

```typescript
interface ImportNodesPayload {
  nodes: Record<TreeNodeId, TreeNode>;  // External data
  nodeIds: TreeNodeId[];
  toParentId: TreeNodeId;
  importMode?: 'merge' | 'replace' | 'new';  // Default: 'new'
  idMapping?: Record<string, string>;        // Old ID -> New ID mapping
  onNameConflict?: 'error' | 'auto-rename';
}
```

**Import Modes**:
- `new`: Always create new nodes with new IDs
- `merge`: Merge with existing nodes by name
- `replace`: Replace existing nodes

**Returns**: `{ seq: number; newNodeIds: TreeNodeId[] }`

## 5. Undo/Redo System

### 5.1 Architecture

- **Strategy**: Command-based undo (stores inverse operations)
- **Grouping**: Related commands share `groupId`
- **Storage**: Ring buffer prevents memory leaks
- **Conflict Detection**: Validates redo applicability

### 5.2 Undo Operation

```typescript
interface UndoPayload {
  groupId?: UUID;                // Specific group or last
  steps?: number;                // Multi-step undo (default: 1)
}
```

**Processing**:
1. Finds last command group(s)
2. Generates inverse operations
3. Applies inverse as new commands
4. Marks original as undone

### 5.3 Redo Operation

```typescript
interface RedoPayload {
  groupId?: UUID;
  steps?: number;
}
```

**Conflict Detection**:
- Checks if target nodes modified since undo
- Returns `{ seq?: number; success: boolean }`
- If conflict: `success: false` with no changes

### 5.4 Undoable vs Non-Undoable

**Undoable Operations**:
- `commitWorkingCopyForCreate` - Can delete created node
- `commitWorkingCopy` - Can restore original
- `moveNodes` - Can move back
- `duplicateNodes` - Can delete copies
- `pasteNodes` - Can delete pasted
- `moveToTrash` - Can recover
- `recoverFromTrash` - Can re-trash
- `importNodes` - Can delete imported

**Non-Undoable Operations**:
- `createWorkingCopy*` - No permanent effects
- `discardWorkingCopy*` - No permanent effects
- `permanentDelete` - Data lost forever

## 6. Error Handling

### 6.1 Error Codes

```typescript
enum MutationErrorCode {
  // Structure Errors
  E_CIRCULAR_REFERENCE = 'E_CIRCULAR_REFERENCE',     // Move/copy to self or descendant
  E_PARENT_NOT_FOUND = 'E_PARENT_NOT_FOUND',        // Target parent doesn't exist
  E_NODE_NOT_FOUND = 'E_NODE_NOT_FOUND',            // Source node doesn't exist
  
  // Working Copy Errors  
  E_WORKING_COPY_NOT_FOUND = 'E_WORKING_COPY_NOT_FOUND',
  E_WORKING_COPY_STALE = 'E_WORKING_COPY_STALE',
  
  // Conflict Errors
  E_NAME_CONFLICT = 'E_NAME_CONFLICT',              // Sibling with same name exists
  E_OPTIMISTIC_LOCK = 'E_OPTIMISTIC_LOCK',          // Node modified by another process
  
  // Reference Errors
  E_REFERENCE_EXISTS = 'E_REFERENCE_EXISTS',        // Cannot delete, has references
  E_NOT_IN_TRASH = 'E_NOT_IN_TRASH',               // Operation requires trash node
  
  // System Errors
  E_PERMISSION_DENIED = 'E_PERMISSION_DENIED',      // Insufficient permissions
  E_QUOTA_EXCEEDED = 'E_QUOTA_EXCEEDED',            // Storage limit reached
  E_INVALID_OPERATION = 'E_INVALID_OPERATION'       // Operation not allowed
}
```

### 6.2 Error Propagation Flow

```
UI Layer → Comlink RPC → Worker Layer
    ↑                          ↓
    ←── Structured Error ──────
```

### 6.3 Error Recovery Strategies

```typescript
// UI-side error handling
async function handleMutation(operation: () => Promise<CommandResult>) {
  try {
    const result = await operation();
    if (!result.success) {
      switch (result.error?.code) {
        case 'E_CIRCULAR_REFERENCE':
          showError('Cannot move item into itself or its children');
          break;
        case 'E_NAME_CONFLICT':
          const retry = await confirmDialog('Name exists. Rename?');
          if (retry) {
            // Retry with auto-rename
            return handleMutation(() => operation({ 
              ...originalPayload, 
              onNameConflict: 'auto-rename' 
            }));
          }
          break;
        case 'E_OPTIMISTIC_LOCK':
          // Refresh and retry
          await refreshNode();
          return handleMutation(operation);
      }
    }
    return result;
  } catch (error) {
    // Network or system errors
    console.error('System error:', error);
    showError('Operation failed. Please try again.');
  }
}
```

## 7. Transaction Patterns

### 7.1 Atomic Multi-Step Operations

```typescript
const groupId = generateId();

// All operations share groupId for atomic undo
await api.createWorkingCopyForCreate({
  groupId,
  commandId: generateId(),
  kind: 'createWorkingCopyForCreate',
  payload: { /* ... */ }
});

await api.commitWorkingCopyForCreate({
  groupId,  // Same groupId
  commandId: generateId(),
  kind: 'commitWorkingCopyForCreate',
  payload: { /* ... */ }
});

await api.moveNodes({
  groupId,  // Same groupId
  commandId: generateId(),
  kind: 'moveNodes',
  payload: { /* ... */ }
});

// Single undo reverts all three
await api.undo({ groupId });
```

### 7.2 Optimistic Updates

```typescript
// Apply UI change immediately
const optimisticState = applyOptimisticUpdate(currentState, changes);
setUIState(optimisticState);

try {
  const result = await api.commitWorkingCopy({
    // ...
    payload: {
      expectedUpdatedAt: currentState.updatedAt  // Optimistic lock
    }
  });
  
  if (result.success) {
    // Confirm optimistic update
    confirmUpdate(optimisticState);
  } else if (result.error?.code === 'E_OPTIMISTIC_LOCK') {
    // Revert and show conflict
    revertUpdate();
    showConflictDialog(result.error);
  }
} catch (error) {
  revertUpdate();
  showError(error);
}
```

## 8. Best Practices

### 8.1 Always Use Working Copies for Edits
- Create working copy before any modification
- Validate changes before commit
- Handle discard on cancel/navigation

### 8.2 Group Related Operations
- Use same `groupId` for logical operations
- Enables atomic undo/redo
- Improves debugging and tracing

### 8.3 Handle Circular References
- Always validate move/copy targets
- Provide clear error messages
- Prevent operations in UI when possible

### 8.4 Implement Retry Logic
```typescript
const retryWithBackoff = async (
  operation: () => Promise<CommandResult>,
  maxRetries = 3
) => {
  for (let i = 0; i < maxRetries; i++) {
    const result = await operation();
    if (result.success) return result;
    
    if (result.error?.code === 'E_OPTIMISTIC_LOCK') {
      await delay(Math.pow(2, i) * 1000);  // Exponential backoff
      continue;
    }
    
    return result;  // Non-retryable error
  }
  throw new Error('Max retries exceeded');
};
```

### 8.5 Monitor Command Buffer
- Track buffer usage
- Implement command coalescing for rapid operations
- Clear old commands periodically
- Warn users before buffer overflow

## 9. Summary

The Mutation Service provides a robust, validated, and recoverable write interface for tree operations. Key features:

1. **Validation**: Worker enforces all business rules and structural constraints
2. **Error Propagation**: Structured errors flow from Worker to UI through RPC
3. **Working Copies**: Isolated editing prevents partial updates
4. **Undo/Redo**: Command pattern enables full operation reversal
5. **Atomic Operations**: Group related commands for consistency
6. **Conflict Resolution**: Automatic and manual conflict handling options

All mutations must respect tree invariants, particularly the prohibition against circular references in move, duplicate, and paste operations.