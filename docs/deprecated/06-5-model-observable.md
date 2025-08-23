# 06-5 Observable Service Model

## 1. Overview

The TreeObservableService provides real-time reactive tree monitoring through both modern RxJS Observables and legacy callback-based APIs. It enables granular subscriptions to tree changes with comprehensive version control and error recovery.

## 2. Architecture Overview

### 2.1 System Design
- **URL-based Subscription**: UI subscribes via `/t/:treeId/:pageTreeNodeId` path
- **Multi-tab Support**: Same tree can be subscribed from multiple tabs with real-time sync
- **Persistent State**: Worker persists expanded state per tree root
- **Differential Updates**: Only changed nodes are transmitted to minimize bandwidth

### 2.2 Update Flow
```
UI Component → Subscribe → Worker Observable Service
     ↑                            ↓
     ←── Version-controlled Updates ──
```

## 3. Interface Definition

### 3.1 Complete Service Interface

```typescript
import type { Observable } from 'rxjs';
import type {
  CommandEnvelope,
  TreeChangeEvent,
  TreeNodeId,
  TreeNode,
  ExpandedStateChanges,
  SubTreeChanges,
  ObserveNodePayload,
  ObserveChildrenPayload,
  ObserveSubtreePayload,
  ObserveWorkingCopiesPayload,
} from '@hierarchidb/core';

export interface TreeObservableService {
  // === Modern Observable API ===
  
  observeNode(
    cmd: CommandEnvelope<'observeNode', ObserveNodePayload>
  ): Promise<Observable<TreeChangeEvent>>;

  observeChildren(
    cmd: CommandEnvelope<'observeChildren', ObserveChildrenPayload>
  ): Promise<Observable<TreeChangeEvent>>;

  observeSubtree(
    cmd: CommandEnvelope<'observeSubtree', ObserveSubtreePayload>
  ): Promise<Observable<TreeChangeEvent>>;

  observeWorkingCopies(
    cmd: CommandEnvelope<'observeWorkingCopies', ObserveWorkingCopiesPayload>
  ): Promise<Observable<TreeChangeEvent>>;

  // === Resource Management ===
  
  getActiveSubscriptions(): Promise<number>;
  cleanupOrphanedSubscriptions(): Promise<void>;

  // === Legacy V1 API (Deprecated) ===
  
  subscribeSubTree(
    pageTreeNodeId: TreeNodeId,
    notifyExpandedChangesCallback: (changes: ExpandedStateChanges) => void,
    notifySubTreeChangesCallback: (changes: SubTreeChanges) => void
  ): Promise<{
    initialSubTree: Promise<SubTreeChanges>;
    unsubscribeSubTree: () => void;
  }>;

  toggleNodeExpanded(pageTreeNodeId: TreeNodeId): Promise<void>;
  
  listChildren(
    parentId: TreeNodeId, 
    doExpandNode?: boolean
  ): Promise<SubTreeChanges>;
  
  getNodeAncestors(pageNodeId: TreeNodeId): Promise<TreeNode[]>;
  
  searchByNameWithDepth(
    rootNodeId: TreeNodeId,
    query: string,
    opts: { maxDepth: number; maxVisited?: number }
  ): Promise<TreeNode[]>;
}
```

## 4. Modern Observable API

### 4.1 Core Concepts

#### Command Envelope Pattern
All observe methods use CommandEnvelope for consistency:
```typescript
interface CommandEnvelope<K, P> {
  commandId: UUID;           // Unique request ID
  groupId: UUID;             // Session/group ID
  kind: K;                   // Operation type
  payload: P;                // Request data
  issuedAt: Timestamp;       // Request time
  sourceViewId?: string;     // Origin component
}
```

#### TreeChangeEvent Structure
```typescript
interface TreeChangeEvent {
  type: 'node-added' | 'node-updated' | 'node-deleted' | 
        'children-changed' | 'subtree-changed' | 'working-copy-changed';
  nodeId: TreeNodeId;
  node?: TreeNode;                    // Full node data
  changes?: Partial<TreeNode>;        // Changed fields only
  timestamp: number;
  version: number;                    // For ordering
  source?: string;                    // Change origin
}
```

### 4.2 Observable Methods

#### `observeNode()` - Single Node Monitoring
```typescript
interface ObserveNodePayload {
  nodeId: TreeNodeId;
  includeMetadata?: boolean;
}

// Example: Monitor specific node
const node$ = await service.observeNode({
  commandId: generateId(),
  groupId: sessionId,
  kind: 'observeNode',
  payload: { nodeId: 'node-123' },
  issuedAt: Date.now()
});

node$.subscribe(event => {
  if (event.type === 'node-updated') {
    updateNodeUI(event.changes);
  }
});
```

#### `observeChildren()` - Direct Children Monitoring
```typescript
interface ObserveChildrenPayload {
  parentId: TreeNodeId;
  includeWorkingCopies?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
}

// Triggers on:
// - Child added/removed
// - Child property changes
// - Children reordering
```

#### `observeSubtree()` - Subtree Monitoring
```typescript
interface ObserveSubtreePayload {
  rootNodeId: TreeNodeId;
  depth?: number;              // -1 for unlimited
  includeCollapsed?: boolean;
  includeWorkingCopies?: boolean;
}

// Example: Tree view subscription
const subtree$ = await service.observeSubtree({
  commandId: generateId(),
  groupId: sessionId,
  kind: 'observeSubtree',
  payload: {
    rootNodeId: rootId,
    depth: 3,                  // 3 levels deep
    includeCollapsed: false    // Skip collapsed branches
  },
  issuedAt: Date.now()
});
```

#### `observeWorkingCopies()` - Edit Session Monitoring
```typescript
interface ObserveWorkingCopiesPayload {
  treeId?: string;     // Filter by tree
  userId?: string;     // Filter by user
}

// Essential for collaborative editing
// Shows who is editing what in real-time
```

## 5. Legacy Callback API (V1)

### 5.1 Main Subscription Method

#### `subscribeSubTree()`
```typescript
const { initialSubTree, unsubscribeSubTree } = await service.subscribeSubTree(
  pageNodeId,
  (expandedChanges) => handleExpandedState(expandedChanges),
  (subTreeChanges) => handleTreeChanges(subTreeChanges)
);

// Apply initial state
const initial = await initialSubTree;
applyInitialState(initial);

// Cleanup
unsubscribeSubTree();
```

### 5.2 Data Structures

#### ExpandedStateChanges
```typescript
interface ExpandedStateChanges {
  version: number;                              // Monotonic version
  timestamp: number;
  changes: Record<TreeNodeId, boolean | null>;  // null = remove
}
```

#### SubTreeChanges
```typescript
interface SubTreeChanges {
  version: number;                              // Monotonic version
  timestamp: number;
  rootNodeId: TreeNodeId;
  changes: Record<TreeNodeId, TreeNode | null>; // null = delete
  expanded: Record<TreeNodeId, boolean>;        // Current state
}
```

### 5.3 Auxiliary Methods

- `toggleNodeExpanded(nodeId)` - Toggle expand/collapse
- `listChildren(parentId, doExpand)` - Get children with optional expansion
- `getNodeAncestors(nodeId)` - Get path from root
- `searchByNameWithDepth(rootId, query, opts)` - Depth-limited search

## 6. Version Control & Consistency

### 6.1 Version Contract

1. **Initial Snapshot**: `subscribeSubTree` returns `{ initialSubTree, unsubscribeSubTree }`
   - `initialSubTree` captured after subscription registration
   - Ensures version consistency on same stream

2. **Version Monotonicity**: 
   - `version` increases monotonically per `treeId + treeRootNodeType` stream
   - Old versions discarded (idempotent merge assumed)

3. **Delivery Order**:
   - Same stream: delivery order = version order guaranteed
   - Different streams: order undefined

### 6.2 Merge Rules

#### Expanded State Merge
```typescript
// Merge expanded changes
for (const [nodeId, state] of Object.entries(changes)) {
  if (state === null) {
    delete expanded[nodeId];  // Remove
  } else {
    expanded[nodeId] = state;  // true = fully expanded
  }
}
```

#### SubTree Merge
```typescript
// Merge node changes
for (const [nodeId, node] of Object.entries(changes)) {
  if (node === null) {
    delete nodes[nodeId];      // Delete node
  } else {
    nodes[nodeId] = node;      // Add/update node
  }
}
```

## 7. Error Handling & Recovery

### 7.1 Error Types

```typescript
enum ObservableErrorCode {
  // Node Errors
  E_NODE_NOT_FOUND = 'E_NODE_NOT_FOUND',
  E_SUBTREE_NOT_FOUND = 'E_SUBTREE_NOT_FOUND',
  
  // Permission Errors
  E_PERMISSION_DENIED = 'E_PERMISSION_DENIED',
  
  // Resource Errors
  E_SUBSCRIPTION_LIMIT = 'E_SUBSCRIPTION_LIMIT',
  E_BACKPRESSURE = 'E_BACKPRESSURE',
  
  // Validation Errors
  E_INVALID_DEPTH = 'E_INVALID_DEPTH'
}
```

### 7.2 Error Recovery Strategies

#### Automatic Retry with Backoff
```typescript
observable$.pipe(
  retryWhen(errors => errors.pipe(
    scan((acc, err) => acc + 1, 0),
    delayWhen(attempt => timer(Math.min(1000 * 2 ** attempt, 30000)))
  ))
).subscribe(handler);
```

#### Connection Recovery
- Callback exceptions caught by Worker (subscription continues)
- On disconnect/restart:
  - Auto re-subscribe attempted
  - Fresh `initialSubTree` sent
  - UI discards old versions, rebuilds from new initial

## 8. Performance Optimization

### 8.1 Subscription Management

1. **Minimize Active Subscriptions**
   ```typescript
   // React cleanup pattern
   useEffect(() => {
     const sub = observable$.subscribe(handler);
     return () => sub.unsubscribe();
   }, []);
   ```

2. **Share Subscriptions**
   ```typescript
   // Share between containers
   const shared$ = observable$.pipe(
     shareReplay({ bufferSize: 1, refCount: true })
   );
   ```

3. **Avoid Duplicate Subscriptions**
   - Check existing subscriptions before creating new
   - Use debounce/multicast at higher level

### 8.2 Update Batching

#### Microtask Coalescing
```typescript
// Worker batches within microtask
changes$.pipe(
  bufferTime(16),              // ~60fps
  filter(batch => batch.length > 0),
  map(batch => mergeBatch(batch))
).subscribe(merged => applyMerged(merged));
```

#### Throttling Guidelines
- UI notifications: Max ~60Hz
- Large updates: Consider pagination
- `searchByNameWithDepth`: Default `maxVisited: 10000`

### 8.3 Memory Management

1. **Subscription Pooling**
   - Reuse subscriptions for same targets
   - Reference counting for cleanup
   - Auto-dispose on zero refs

2. **Data Throttling**
   - Limit update frequency
   - Sample high-frequency streams
   - Virtual scrolling for large trees

## 9. Usage Patterns

### 9.1 Tree View Pattern
```typescript
// Combine subtree with expansion state
const treeView$ = combineLatest([
  subtree$,
  expansionState$
]).pipe(
  map(([tree, expansion]) => ({
    nodes: tree.changes,
    expanded: expansion
  }))
);
```

### 9.2 File Browser Pattern
```typescript
// Monitor current directory
const currentDir$ = switchMap(currentPath$ => 
  service.observeChildren({
    // ...
    payload: { parentId: currentPath }
  })
);
```

### 9.3 Collaborative Editing Pattern
```typescript
// Show who's editing what
const editors$ = service.observeWorkingCopies({
  // ...
  payload: { treeId: currentTree }
});

editors$.subscribe(event => {
  if (event.type === 'working-copy-changed') {
    updateEditIndicators(event);
  }
});
```

## 10. Migration Guide

### From V1 to Modern API

**Before (Callback-based):**
```typescript
const { unsubscribeSubTree } = await service.subscribeSubTree(
  nodeId,
  expandedHandler,
  changesHandler
);
// Later: unsubscribeSubTree();
```

**After (Observable-based):**
```typescript
const sub = await service.observeSubtree({
  commandId: generateId(),
  groupId: sessionId,
  kind: 'observeSubtree',
  payload: { rootNodeId: nodeId, depth: -1 },
  issuedAt: Date.now()
});

const subscription = sub.subscribe(handleEvent);
// Later: subscription.unsubscribe();
```

## 11. Best Practices

1. **Prefer Modern API**: Better TypeScript support, RxJS composability
2. **Always Cleanup**: Unsubscribe on unmount to prevent memory leaks
3. **Handle Errors Gracefully**: Implement retry logic with backoff
4. **Optimize for Performance**: Use shallow subscriptions, virtual scrolling
5. **Batch Updates**: Process rapid changes in batches
6. **Monitor Resource Usage**: Track active subscriptions, implement limits

## 12. Constraints & Non-Goals

- **Session/Tab Isolation**: Tree updates propagate, UI state (selection/scroll) does not
- **Security Model**: Local Worker assumed, auth/authz in separate layer
- **Consistency Model**: Strong ordering within stream, no global ordering across streams
- **Scalability Limits**: Consider pagination for >10,000 nodes