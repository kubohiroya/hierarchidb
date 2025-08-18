# TreeConsole Worker API Methods

## Overview

TreeConsole will use the existing `@hierarchidb/api` interfaces directly through Comlink RPC. No additional API layer is needed.

## Using Existing API

The TreeConsole package will import and use these existing services from `@hierarchidb/api`:

### TreeObservableService
- `observeNode()` - Subscribe to single node changes
- `observeChildren()` - Subscribe to children changes
- `observeSubtree()` - Subscribe to subtree changes
- `observeWorkingCopies()` - Subscribe to working copy changes

### TreeMutationService
- `createWorkingCopyForCreate()` - Create new node working copy
- `createWorkingCopy()` - Create edit working copy
- `commitWorkingCopy()` - Commit changes
- `discardWorkingCopy()` - Discard changes
- `moveNodes()` - Move nodes to new parent
- `duplicateNodes()` - Duplicate nodes
- `pasteNodes()` - Paste copied nodes
- `moveToTrash()` - Move to trash
- `permanentDelete()` - Permanently delete
- `recoverFromTrash()` - Recover from trash
- `undo()` - Undo last operation
- `redo()` - Redo operation

### TreeQueryService
- `getNode()` - Get single node
- `getChildren()` - Get child nodes
- `getDescendants()` - Get all descendants
- `getAncestors()` - Get ancestor path
- `searchNodes()` - Search nodes by query

## Implementation Pattern

```typescript
import { WorkerAPI } from '@hierarchidb/api';
import * as Comlink from 'comlink';

// In UI component
const workerApi = Comlink.wrap<WorkerAPI>(
  new Worker(new URL('./worker', import.meta.url))
);

// Use directly
await workerApi.moveNodes({
  commandId: generateId(),
  groupId: generateGroupId(),
  kind: 'moveNodes',
  payload: { nodeIds, toParentId },
  issuedAt: Date.now()
});
```

## No Additional Abstractions

The design follows HierarchiDB's principle of minimal abstraction:
- Direct use of `CommandEnvelope` from `@hierarchidb/core`
- Direct use of service interfaces from `@hierarchidb/api`
- No intermediate API layers or redundant type definitions