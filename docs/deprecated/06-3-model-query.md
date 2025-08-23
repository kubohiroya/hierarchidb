# 06-3 Query Service Model

## Overview

The TreeQueryService provides read-only operations for querying tree structures, searching nodes, and exporting data. It forms the foundation for all data retrieval operations in HierarchiDB.

## Interface Definition

```typescript
import type {
  CommandResult,
  TreeNode,
  Tree,
  TreeNodeId,
  // Payload types
  GetTreePayload,
  GetNodePayload,
  GetChildrenPayload,
  GetDescendantsPayload,
  GetAncestorsPayload,
  SearchNodesPayload,
  CopyNodesPayload,
  ExportNodesPayload,
} from '@hierarchidb/core';

export interface TreeQueryService {
  // Tree operations
  getTrees(): Promise<Tree[]>;
  getTree(payload: GetTreePayload): Promise<Tree | undefined>;

  // Node operations
  getNode(payload: GetNodePayload): Promise<TreeNode | undefined>;
  getChildren(payload: GetChildrenPayload): Promise<TreeNode[]>;
  getDescendants(payload: GetDescendantsPayload): Promise<TreeNode[]>;
  getAncestors(payload: GetAncestorsPayload): Promise<TreeNode[]>;

  // Search operations
  searchNodes(payload: SearchNodesPayload): Promise<TreeNode[]>;

  // Copy/Export operations
  copyNodes(payload: CopyNodesPayload): Promise<CommandResult>;
  exportNodes(payload: ExportNodesPayload): Promise<CommandResult>;
}
```

## Operation Categories

### 1. Tree Operations

#### `getTrees()`
- Returns all available trees in the system
- No parameters required
- Used for tree selection UI and navigation

#### `getTree(payload)`
- Retrieves a specific tree by ID
- Returns `undefined` if tree doesn't exist
- Payload structure:
  ```typescript
  interface GetTreePayload {
    treeId: string;
  }
  ```

### 2. Node Operations

#### `getNode(payload)`
- Retrieves a single node by ID
- Returns `undefined` if node doesn't exist
- Includes all node metadata and properties
- Payload structure:
  ```typescript
  interface GetNodePayload {
    nodeId: TreeNodeId;
    includeWorkingCopy?: boolean;
  }
  ```

#### `getChildren(payload)`
- Returns direct children of a node
- Sorted by name (normalized) in ascending order
- Empty array if no children exist
- Payload structure:
  ```typescript
  interface GetChildrenPayload {
    parentId: TreeNodeId;
    includeWorkingCopies?: boolean;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  }
  ```

#### `getDescendants(payload)`
- Returns all descendants recursively
- Can be limited by depth
- Performance consideration for large subtrees
- Payload structure:
  ```typescript
  interface GetDescendantsPayload {
    nodeId: TreeNodeId;
    maxDepth?: number;
    includeWorkingCopies?: boolean;
  }
  ```

#### `getAncestors(payload)`
- Returns path from root to node
- Ordered from root to immediate parent
- Essential for breadcrumb navigation
- Payload structure:
  ```typescript
  interface GetAncestorsPayload {
    nodeId: TreeNodeId;
  }
  ```

### 3. Search Operations

#### `searchNodes(payload)`
- Full-text search across node properties
- Supports various search strategies
- Can be scoped to subtrees
- Payload structure:
  ```typescript
  interface SearchNodesPayload {
    query: string;
    rootNodeId?: TreeNodeId;
    searchIn?: ('name' | 'description' | 'content')[];
    maxResults?: number;
    caseSensitive?: boolean;
  }
  ```

### 4. Copy/Export Operations

#### `copyNodes(payload)`
- Copies nodes to clipboard (in-memory)
- Preserves node structure and relationships
- Returns CommandResult with operation status
- Payload structure:
  ```typescript
  interface CopyNodesPayload {
    nodeIds: TreeNodeId[];
    includeDescendants?: boolean;
  }
  ```

#### `exportNodes(payload)`
- Exports nodes to external format (JSON)
- Includes full node data and metadata
- Suitable for backup and transfer
- Payload structure:
  ```typescript
  interface ExportNodesPayload {
    nodeIds: TreeNodeId[];
    format?: 'json' | 'yaml' | 'csv';
    includeDescendants?: boolean;
    includeMetadata?: boolean;
  }
  ```

## Performance Considerations

### Caching Strategy
- Node data cached at Worker level
- Cache invalidation on mutations
- LRU eviction for memory management

### Query Optimization
- Use `getChildren` for pagination
- Limit `getDescendants` depth for large trees
- Consider virtual scrolling for UI display

### Batch Operations
- Multiple queries can be parallelized
- Use Promise.all for concurrent fetching
- Worker handles request queuing

## Error Handling

### Common Error Codes
- `E_NODE_NOT_FOUND`: Node doesn't exist
- `E_TREE_NOT_FOUND`: Tree doesn't exist
- `E_PERMISSION_DENIED`: Access control violation (future)
- `E_INVALID_PAYLOAD`: Malformed request data

### Error Response Format
```typescript
interface QueryError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

## Usage Examples

### Basic Node Retrieval
```typescript
// Get a specific node
const node = await queryService.getNode({
  nodeId: 'node-123'
});

// Get children with sorting
const children = await queryService.getChildren({
  parentId: 'node-123',
  sortBy: 'name',
  sortOrder: 'asc'
});
```

### Navigation Support
```typescript
// Build breadcrumb
const ancestors = await queryService.getAncestors({
  nodeId: currentNodeId
});

// Expand tree branch
const descendants = await queryService.getDescendants({
  nodeId: branchNodeId,
  maxDepth: 2
});
```

### Search Implementation
```typescript
// Search within subtree
const results = await queryService.searchNodes({
  query: 'design document',
  rootNodeId: projectRootId,
  searchIn: ['name', 'description'],
  maxResults: 50
});
```

## Integration with Other Services

### Observable Service
- Query results can trigger subscriptions
- Initial data fetched via QueryService
- Updates received via ObservableService

### Mutation Service
- Query before mutation for validation
- Query after mutation for UI update
- Working copy queries during edit

## Best Practices

1. **Minimize Round-trips**
   - Batch related queries
   - Use appropriate depth limits
   - Cache frequently accessed data

2. **Handle Undefined Results**
   - Always check for undefined returns
   - Provide fallback UI states
   - Log unexpected missing data

3. **Optimize Search**
   - Use specific search scopes
   - Implement debouncing in UI
   - Consider pagination for results

4. **Memory Management**
   - Clear unused query results
   - Implement result pagination
   - Monitor Worker memory usage