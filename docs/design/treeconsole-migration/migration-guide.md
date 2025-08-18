# TreeConsole Migration Guide: Old Worker Architecture to New @packages/api

## Overview

The existing TreeConsole implementation in `references/eria-cartograph/app0` uses an old Worker architecture. This guide explains how to migrate it to use the new `@packages/api` and `@packages/worker` implementation.

## Key Migration Points

### 1. Replace Direct Database Access

**Old Pattern (FORBIDDEN):**
```typescript
// Direct database access from UI
import { TreeNodesDB } from '@/shared/db/TreeNodesDB';
const db = TreeNodesDB.getInstance();
const nodes = await db.getNodes(nodeId);
```

**New Pattern (REQUIRED):**
```typescript
// Use WorkerAPI through Comlink
import { WorkerAPI } from '@hierarchidb/api';
import * as Comlink from 'comlink';

const worker = new Worker(new URL('@hierarchidb/worker', import.meta.url));
const api = Comlink.wrap<WorkerAPI>(worker);

// Use CommandEnvelope pattern
const result = await api.getChildren({
  commandId: generateId(),
  groupId: generateGroupId(),
  kind: 'getChildren',
  payload: { parentTreeNodeId: nodeId },
  issuedAt: Date.now()
});
```

### 2. Replace Custom Worker Service Calls

**Old Pattern:**
```typescript
// Custom DataManagementWorkerService
import { DataManagementWorkerService } from '@/shared/workers/DataManagementWorkerService';
const service = DataManagementWorkerService.getInstance();
await service.moveNodes(nodeIds, targetId);
```

**New Pattern:**
```typescript
// Use WorkerAPI.moveNodes
await api.moveNodes({
  commandId: generateId(),
  groupId: generateGroupId(),
  kind: 'moveNodes',
  payload: { 
    nodeIds, 
    toParentId: targetId,
    onNameConflict: 'auto-rename'
  },
  issuedAt: Date.now()
});
```

### 3. Replace Subscription Pattern

**Old Pattern:**
```typescript
// Custom subscription
const unsubscribe = service.subscribeSubTree(
  nodeId,
  (expandedChanges) => { /* ... */ },
  (subTreeChanges) => { /* ... */ }
);
```

**New Pattern:**
```typescript
// Use Observable pattern
const observable = await api.observeSubtree({
  commandId: generateId(),
  groupId: generateGroupId(),
  kind: 'observeSubtree',
  payload: { 
    rootNodeId: nodeId,
    includeInitialSnapshot: true
  },
  issuedAt: Date.now()
});

// Subscribe using Comlink
const unsubscribe = Comlink.proxy((change: TreeChangeEvent) => {
  // Handle change
});
```

### 4. Replace Undo/Redo

**Old Pattern:**
```typescript
// Custom CommandManager
import { CommandManager } from '@/features/tree-data/services/CommandManager';
commandManager.undo();
commandManager.redo();
```

**New Pattern:**
```typescript
// Use WorkerAPI undo/redo
await api.undo({
  commandId: generateId(),
  groupId: groupId,
  kind: 'undo',
  payload: { groupId },
  issuedAt: Date.now()
});
```

### 5. Replace Working Copy Pattern

**Old Pattern:**
```typescript
// Custom working copy management
await service.createDraft(nodeId);
await service.commitDraft(nodeId);
```

**New Pattern:**
```typescript
// Use WorkerAPI working copy methods
const workingCopyId = generateId();

// For create
await api.createWorkingCopyForCreate({
  commandId: generateId(),
  groupId: generateGroupId(),
  kind: 'createWorkingCopyForCreate',
  payload: {
    workingCopyId,
    parentTreeNodeId: parentId,
    name: 'New Node',
    description: ''
  },
  issuedAt: Date.now()
});

// For edit
await api.createWorkingCopy({
  commandId: generateId(),
  groupId: generateGroupId(),
  kind: 'createWorkingCopy',
  payload: {
    workingCopyId,
    sourceTreeNodeId: nodeId
  },
  issuedAt: Date.now()
});

// Commit
await api.commitWorkingCopy({
  commandId: generateId(),
  groupId: generateGroupId(),
  kind: 'commitWorkingCopy',
  payload: {
    workingCopyId,
    expectedUpdatedAt: timestamp,
    onNameConflict: 'auto-rename'
  },
  issuedAt: Date.now()
});
```

## Component Migration Checklist

### TreeTableConsolePanel.tsx
- [ ] Remove `DataManagementWorkerService` import
- [ ] Replace with `WorkerAPI` from `@hierarchidb/api`
- [ ] Update all service calls to use CommandEnvelope pattern
- [ ] Remove direct database access

### useTreeViewController.tsx
- [ ] Remove `useWorkerCommandManager` hook
- [ ] Replace with direct `WorkerAPI` calls
- [ ] Update subscription pattern to use Observables
- [ ] Remove custom command types

### TreeConsoleToolbar.tsx
- [ ] Update undo/redo to use `WorkerAPI.undo/redo`
- [ ] Remove custom toolbar command handling

### TreeConsoleContent.tsx
- [ ] Update drag & drop to use `WorkerAPI.moveNodes`
- [ ] Remove custom tree state management

### TreeConsoleBreadcrumb.tsx
- [ ] Update navigation to use `WorkerAPI.getAncestors`
- [ ] Remove custom path resolution

## Helper Functions

Create these utility functions to simplify migration:

```typescript
// utils/command-helpers.ts
import { v4 as uuid } from 'uuid';
import type { CommandEnvelope } from '@hierarchidb/core';

export function createCommand<K extends string, P>(
  kind: K,
  payload: P,
  groupId?: string
): CommandEnvelope<K, P> {
  return {
    commandId: uuid(),
    groupId: groupId || uuid(),
    kind,
    payload,
    issuedAt: Date.now()
  };
}

// Usage
await api.moveNodes(
  createCommand('moveNodes', { nodeIds, toParentId })
);
```

## Testing Migration

1. **Unit Tests**: Update to mock `WorkerAPI` instead of custom services
2. **Integration Tests**: Ensure CommandEnvelope pattern works correctly
3. **E2E Tests**: Verify UI behavior remains unchanged

## Common Pitfalls

1. **Don't access Dexie directly** - All database operations through WorkerAPI
2. **Don't create custom Worker services** - Use existing WorkerAPI
3. **Don't bypass CommandEnvelope** - All mutations need proper command structure
4. **Don't forget error handling** - WorkerAPI errors propagate through Comlink

## Benefits After Migration

- Consistent API usage across all packages
- Better type safety with CommandEnvelope
- Simplified Worker communication
- Automatic undo/redo support
- Proper working copy pattern
- Observable-based subscriptions