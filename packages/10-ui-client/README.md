# @hierarchidb/ui-client

Worker communication client for HierarchiDB UI components.

## Overview

This package provides a client for communicating with the HierarchiDB Worker layer via Comlink. It includes:

- **WorkerAPIClient**: Production-ready singleton client for Worker communication
- **Worker utilities**: Helper functions for Worker setup and configuration
- **React hooks**: Easy integration with React components
- **TypeScript support**: Full type safety for all Worker API calls

## Quick Start

### 1. Setup Worker URL

Before using the client, configure the worker URL:

```typescript
import { setWorkerUrl } from '@hierarchidb/ui-client';

// In your app initialization
setWorkerUrl('/path/to/your/worker.js');
```

### 2. Get Client Instance

```typescript
import { WorkerAPIClient } from '@hierarchidb/ui-client';

// Get singleton instance
const client = await WorkerAPIClient.getSingleton();
const api = client.getAPI();
```

### 3. Use API Methods

```typescript
// Query operations
const trees = await api.getTrees();
const tree = await api.getTree({ treeId: 'my-tree' });
const children = await api.getChildren({ parentId: 'parent-node' });

// Observable operations  
const nodeObservable = api.observeNode({ nodeId: 'node-id' });
const subscription = nodeObservable.subscribe({
  next: (event) => console.log('Node changed:', event),
  error: (err) => console.error('Error:', err)
});

// Mutation operations
const result = await api.executeCommand({
  type: 'CREATE_NODE',
  payload: { name: 'New Node', nodeType: 'folder' }
});

// Working copy operations
const workingCopy = await api.createWorkingCopyForCreate({
  parentId: 'parent',
  nodeType: 'folder'
});

await api.commitWorkingCopyForCreate({
  workingCopyId: workingCopy.workingCopyId!
});
```

### 4. React Hook Integration

```typescript
import { useWorkerAPIClient } from '@hierarchidb/ui-client';

function MyComponent() {
  const { api, isLoading, error } = useWorkerAPIClient();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  const handleCreateNode = async () => {
    await api.executeCommand({
      type: 'CREATE_NODE',
      payload: { name: 'New Node' }
    });
  };
  
  return <button onClick={handleCreateNode}>Create Node</button>;
}
```

## API Reference

### WorkerAPIClient

Main client class for Worker communication.

#### Methods

- `static getSingleton(): Promise<WorkerAPIClient>` - Get singleton instance
- `getAPI(): WorkerAPI` - Get the Worker API proxy
- `ping(): Promise<boolean>` - Test Worker connection
- `cleanup(): Promise<void>` - Cleanup and terminate Worker

### Worker Utilities

- `setWorkerUrl(url: string): void` - Configure Worker URL
- `createWorker(): Worker` - Create Worker instance
- `createWorkerAPI(): Remote<WorkerAPI>` - Create Worker API proxy

### TreeQueryService

Query operations for trees and nodes:

- `getTrees()` - Get all trees
- `getTree(params)` - Get specific tree
- `getNode(params)` - Get specific node  
- `getChildren(params)` - Get child nodes
- `getDescendants(params)` - Get descendant nodes
- `getAncestors(params)` - Get ancestor nodes
- `searchNodes(params)` - Search nodes

### TreeObservableService

Observable operations for real-time updates:

- `observeNode(params)` - Observe node changes
- `observeChildren(params)` - Observe children changes
- `observeSubtree(params)` - Observe subtree changes
- `observeWorkingCopies(params)` - Observe working copy changes

### TreeMutationService

Mutation operations:

- `executeCommand(command)` - Execute mutation command
- `createWorkingCopyForCreate(params)` - Create working copy for new node
- `createWorkingCopy(params)` - Create working copy for editing
- `discardWorkingCopy(params)` - Discard working copy
- `commitWorkingCopyForCreate(params)` - Commit new node working copy
- `commitWorkingCopy(params)` - Commit edit working copy
- `copyNodes(params)` - Copy nodes
- `moveNodes(params)` - Move nodes
- `duplicateNodes(params)` - Duplicate nodes
- `pasteNodes(params)` - Paste nodes
- `moveToTrash(params)` - Move nodes to trash
- `remove(params)` - Permanently remove nodes
- `recoverFromTrash(params)` - Recover nodes from trash
- `exportNodes(params)` - Export nodes
- `importNodes(params)` - Import nodes
- `undo()` - Undo last operation
- `redo()` - Redo last undone operation

## Error Handling

The client includes comprehensive error handling:

```typescript
try {
  const result = await api.executeCommand(command);
  if (!result.success) {
    console.error('Command failed:', result.error);
  }
} catch (error) {
  console.error('Communication error:', error);
}
```

## Testing

The package includes comprehensive test suites:

```bash
# Run all tests
pnpm test

# Run specific test files
pnpm test WorkerAPIClient.clean.test.ts
```

### Test-Only Components

- `WorkerAPIClientSimple`: Deprecated mock implementation for testing only
  - **DO NOT USE IN PRODUCTION**
  - Use only for unit tests that need a simple mock

## Architecture

The client follows a layered architecture:

```
React Components
       ↓
useWorkerAPIClient (Hook)
       ↓
WorkerAPIClient (Singleton)
       ↓
Comlink (RPC)
       ↓
Worker (WorkerAPIImpl)
       ↓
Database Layer
```

## Best Practices

1. **Always use WorkerAPIClient** - Never use WorkerAPIClientSimple in production
2. **Configure Worker URL early** - Call setWorkerUrl() during app initialization
3. **Handle errors properly** - Check result.success for mutation operations
4. **Clean up subscriptions** - Always unsubscribe from observables
5. **Use React hooks** - Prefer useWorkerAPIClient for React components

## Migration from WorkerAPIClientSimple

If you were using the deprecated WorkerAPIClientSimple:

```typescript
// ❌ Old - Don't use
import { WorkerAPIClientSimple } from '@hierarchidb/ui-client';
const client = await WorkerAPIClientSimple.create();

// ✅ New - Use this instead  
import { WorkerAPIClient, setWorkerUrl } from '@hierarchidb/ui-client';
setWorkerUrl('/path/to/worker.js');
const client = await WorkerAPIClient.getSingleton();
```

The API surface is the same, but WorkerAPIClient connects to the real Worker implementation instead of returning mock data.