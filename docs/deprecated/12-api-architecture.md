# API Architecture and Hierarchy

## Overview

HierarchiDB implements a multi-layered API architecture that provides different levels of abstraction for various use cases. This document describes the three main API layers and their intended usage patterns.

## API Layer Hierarchy

### 1. Low-Level Command API (Foundation Layer)

**Purpose**: Direct service method calls with maximum control and flexibility.

**Characteristics**:
- Direct calls to service implementations
- Manual workflow orchestration required
- Full control over command lifecycle
- Most verbose but most flexible

**Example**:
```typescript
// Manual Working Copy workflow
await mutationService.createWorkingCopyForCreate({
  type: 'createWorkingCopyForCreate',
  payload: {
    workingCopyId: 'wc-123',
    parentTreeNodeId: parentId,
    name: name,
    description: description,
  },
  commandId: 'cmd-001',
  timestamp: Date.now(),
});

await mutationService.commitWorkingCopyForCreate({
  type: 'commitWorkingCopyForCreate', 
  payload: { workingCopyId: 'wc-123' },
  commandId: 'cmd-002',
  timestamp: Date.now(),
});
```

**Use Cases**:
- Internal service implementation
- Complex custom workflows
- Debugging and testing edge cases
- Maximum performance scenarios

### 2. Mid-Level Worker API (Command Envelope Layer)

**Purpose**: Structured command-based interface for UI-Worker communication.

**Characteristics**:
- Command Pattern implementation
- Serializable command envelopes
- Suitable for Comlink RPC
- Standardized error handling
- Still requires multiple steps for complete operations

**Example**:
```typescript
// Command Envelope pattern
await workerAPI.createWorkingCopyForCreate({
  payload: {
    workingCopyId: 'wc-123',
    parentTreeNodeId: parentId,
    name: name,
  },
  commandId: 'cmd-001',
  groupId: 'group-001',
  kind: 'createWorkingCopyForCreate',
  issuedAt: Date.now(),
});

await workerAPI.commitWorkingCopyForCreate({
  payload: { workingCopyId: 'wc-123' },
  commandId: 'cmd-002',
  groupId: 'group-001',
  kind: 'commitWorkingCopyForCreate',
  issuedAt: Date.now(),
});
```

**Use Cases**:
- UI-Worker communication via Comlink
- Command logging and auditing
- Undo/Redo implementation
- Cross-process communication

### 3. High-Level Orchestrated API (Developer Layer)

**Purpose**: Developer-friendly interface that orchestrates complete workflows in single calls.

**Characteristics**:
- Single method call for complete operations
- Built-in validation and error handling
- Automatic cleanup on failure
- Optimized for developer productivity
- Atomic operations

**Example**:
```typescript
// Single call orchestrates complete workflow
const result = await workerAPI.createFolder({
  treeId: 'test-tree',
  parentNodeId: parentId,
  name: 'Test Folder',
  description: 'Optional description',
});

const updateResult = await workerAPI.updateFolderName({
  nodeId: folderId,
  newName: 'New Name',
});

const moveResult = await workerAPI.moveFolder({
  nodeId: folderId,
  toParentId: newParentId,
  onNameConflict: 'auto-rename',
});
```

**Use Cases**:
- Application development
- Integration testing
- Rapid prototyping
- Most common operations

## Current Orchestrated APIs

### Folder Management
```typescript
// Create folder with validation
createFolder(params: {
  treeId: string;
  parentNodeId: TreeNodeId;
  name: string;
  description?: string;
}): Promise<{ success: boolean; nodeId?: TreeNodeId; error?: string }>

// Update folder name with validation  
updateFolderName(params: {
  nodeId: TreeNodeId;
  newName: string;
}): Promise<{ success: boolean; error?: string }>

// Move folder with circular reference detection
moveFolder(params: {
  nodeId: TreeNodeId;
  toParentId: TreeNodeId;
  onNameConflict?: 'error' | 'auto-rename';
}): Promise<{ success: boolean; error?: string }>
```

### Built-in Features
- **Input Validation**: Name length, empty string checks
- **Error Handling**: Comprehensive error messages
- **Circular Reference Detection**: Prevents invalid tree structures
- **Automatic Cleanup**: Working Copy cleanup on failure
- **Name Conflict Resolution**: Auto-rename capabilities

## Implementation Pattern

Each Orchestrated API follows this pattern:

```typescript
async orchestratedOperation(params: OperationParams): Promise<OperationResult> {
  try {
    // 1. Input validation
    if (!params.requiredField) {
      return { success: false, error: 'Validation message' };
    }
    
    // 2. Business logic validation
    if (await checkBusinessRules(params)) {
      return { success: false, error: 'Business rule violation' };
    }
    
    // 3. Execute underlying operations
    const result = await this.lowLevelOperation({
      payload: transformParams(params),
      commandId: generateId(),
      groupId: generateGroupId(),
      kind: 'operationKind',
      issuedAt: Date.now(),
    });
    
    // 4. Transform and return result
    return {
      success: result.success,
      nodeId: result.nodeId,
      error: result.error,
    };
    
  } catch (error) {
    // 5. Error handling and cleanup
    await cleanup();
    return { success: false, error: String(error) };
  }
}
```

## Migration Guide

### From Low-Level to Orchestrated

**Before**:
```typescript
// Multiple steps, manual error handling
const workingCopyId = generateId();
try {
  await service.createWorkingCopyForCreate({...});
  const result = await service.commitWorkingCopyForCreate({...});
  if (!result.success) {
    await service.discardWorkingCopyForCreate({workingCopyId});
    throw new Error(result.error);
  }
  return result.nodeId;
} catch (error) {
  // Manual cleanup
  await service.discardWorkingCopyForCreate({workingCopyId});
  throw error;
}
```

**After**:
```typescript
// Single call with automatic error handling
const result = await api.createFolder({
  treeId: 'my-tree',
  parentNodeId: parentId,
  name: 'My Folder',
});

if (!result.success) {
  console.error(result.error);
  return;
}

return result.nodeId;
```

## Performance Considerations

### API Layer Performance Comparison

| Layer | Setup Overhead | Runtime Overhead | Error Handling | Cleanup |
|-------|---------------|------------------|---------------|---------|
| Low-Level | Low | Minimal | Manual | Manual |
| Command Envelope | Medium | Low | Structured | Manual |
| Orchestrated | Medium | Low-Medium | Automatic | Automatic |

### When to Use Each Layer

- **Low-Level**: Performance-critical paths, custom workflows
- **Command Envelope**: UI communication, auditing requirements
- **Orchestrated**: Most application code, testing, prototyping

## Future Extensions

### Planned Orchestrated APIs
```typescript
// Batch operations
createFolderHierarchy(structure: FolderStructure): Promise<BatchResult>
moveMultipleFolders(operations: MoveOperation[]): Promise<BatchResult>

// Business logic APIs
createProjectStructure(template: ProjectTemplate): Promise<ProjectResult>
importFromFileSystem(path: string): Promise<ImportResult>

// Advanced search
searchNodes(query: SearchQuery): Promise<SearchResult>
```

### Template System
```typescript
interface ProjectTemplate {
  name: string;
  structure: {
    [folderName: string]: {
      type: 'folder' | 'file';
      children?: ProjectTemplate['structure'];
      content?: string;
    };
  };
}

// Usage
await api.createProjectStructure({
  name: 'React App',
  template: 'react-typescript',
  features: ['testing', 'storybook'],
});
```

## Best Practices

1. **Choose the Right Layer**:
   - Use Orchestrated APIs for most operations
   - Use Command Envelope for UI communication
   - Use Low-Level only when necessary

2. **Error Handling**:
   - Always check `success` property in Orchestrated APIs
   - Use structured error handling for Command Envelope APIs
   - Implement comprehensive cleanup in Low-Level APIs

3. **Testing Strategy**:
   - Test business logic with Orchestrated APIs
   - Test communication patterns with Command Envelope APIs
   - Test edge cases with Low-Level APIs

4. **Performance Optimization**:
   - Batch operations when possible
   - Use appropriate layer for use case
   - Monitor and profile critical paths

## Conclusion

The three-layer API architecture provides flexibility for different use cases while maintaining consistency and reliability. The Orchestrated API layer significantly improves developer productivity and reduces errors, making it the recommended choice for most application development scenarios.