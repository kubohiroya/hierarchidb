# Version Migration Guide

## Overview

This document provides guidance for migrating between major versions of HierarchiDB, including breaking changes, migration strategies, and compatibility considerations.

## Prerequisites

- Understanding of current system architecture
- Backup of existing data
- Knowledge of semantic versioning

## When to Read This Document

- Before upgrading to a new major version
- When planning breaking changes
- When maintaining backward compatibility

## Version History

### v2.0.0 (Current)
- Branded type system for IDs
- Unified plugin architecture
- Working copy pattern implementation
- TreeConsole UI component

### v1.0.0 (Legacy)
- Initial architecture
- Basic tree operations
- Simple plugin system

## Migration from v1.x to v2.0

### Breaking Changes

#### 1. ID Type System

**Before (v1.x):**
```typescript
// Plain string IDs
const nodeId: string = "node-123";
const treeId: string = "tree-456";

interface TreeNode {
  id: string;
  parentId: string;
  treeId: string;
}
```

**After (v2.0):**
```typescript
// Branded types for type safety
import { NodeId, TreeId } from '@hierarchidb/core';

const nodeId = "node-123" as NodeId;
const treeId = "tree-456" as TreeId;

interface TreeNode {
  id: NodeId;
  parentNodeId: NodeId;
  treeId: TreeId;
}
```

**Migration Script:**
```typescript
// migrate-ids.ts
import { NodeId, TreeId, EntityId } from '@hierarchidb/core';

async function migrateDatabase() {
  const nodes = await db.nodes.toArray();
  
  for (const node of nodes) {
    await db.nodes.update(node.id, {
      id: node.id as NodeId,
      parentNodeId: node.parentId as NodeId,
      treeId: node.treeId as TreeId
    });
  }
}
```

#### 2. Node Type System

**Before (v1.x):**
```typescript
enum TreeRootNodeTypes {
  Root = 'Root',
  Trash = 'Trash'
}

const nodeType = TreeRootNodeTypes.Root;
```

**After (v2.0):**
```typescript
// Use string literals instead of enums
const nodeType: 'Root' | 'Trash' = 'Root';

// Or use constants
const ROOT_NODE_TYPE = 'Root' as const;
const TRASH_NODE_TYPE = 'Trash' as const;
```

#### 3. API Changes

**Before (v1.x):**
```typescript
// Direct service imports
import { TreeService } from '@hierarchidb/core';

const service = new TreeService();
await service.createNode(data);
```

**After (v2.0):**
```typescript
// Worker-based API via Comlink
import { getWorkerAPI } from '@hierarchidb/ui-client';

const api = await getWorkerAPI();
await api.createNode(data);
```

### Database Migration

#### Schema Changes

```typescript
// migration-v2.ts
import Dexie from 'dexie';

class DatabaseMigration extends Dexie {
  constructor() {
    super('HierarchiDB');
    
    // v1 schema
    this.version(1).stores({
      trees: 'id',
      nodes: 'id, parentId, treeId'
    });
    
    // v2 schema with renamed fields
    this.version(2).stores({
      trees: '&treeId, treeRootNodeId',
      nodes: '&treeNodeId, parentNodeId, treeId'
    }).upgrade(async trans => {
      // Migrate existing data
      await trans.table('nodes').toCollection().modify(node => {
        node.treeNodeId = node.id;
        node.parentNodeId = node.parentId;
        delete node.id;
        delete node.parentId;
      });
    });
  }
}
```

### Plugin Migration

#### Plugin Definition Changes

**Before (v1.x):**
```typescript
export const plugin = {
  name: 'MyPlugin',
  version: '1.0.0',
  handler: MyHandler
};
```

**After (v2.0):**
```typescript
import { NodeTypeDefinition } from '@hierarchidb/core';

export const MyNodeDefinition: NodeTypeDefinition = {
  nodeType: 'mytype',
  database: {
    entityStore: 'mytypes',
    schema: { '&id': '', 'nodeId': '' },
    version: 1
  },
  entityHandler: new MyEntityHandler(),
  lifecycle: {
    afterCreate: async (node, context) => {},
    beforeDelete: async (node, context) => {}
  },
  ui: {
    dialogComponent: MyDialog,
    panelComponent: MyPanel
  }
};
```

## Data Migration Strategies

### 1. In-place Migration

```typescript
async function inPlaceMigration() {
  const db = new Dexie('HierarchiDB');
  
  // Open with old schema
  db.version(1).stores(oldSchema);
  
  // Export data
  const data = await db.export();
  
  // Close old database
  db.close();
  
  // Open with new schema
  db.version(2).stores(newSchema);
  
  // Import data with transformation
  await db.import(transformData(data));
}
```

### 2. Side-by-side Migration

```typescript
async function sideBySideMigration() {
  const oldDB = new Dexie('HierarchiDB');
  const newDB = new Dexie('HierarchiDB_v2');
  
  // Read from old
  const oldData = await oldDB.trees.toArray();
  
  // Transform and write to new
  const newData = oldData.map(transformTree);
  await newDB.trees.bulkAdd(newData);
  
  // Swap databases when complete
  await Dexie.delete('HierarchiDB_backup');
  await oldDB.rename('HierarchiDB_backup');
  await newDB.rename('HierarchiDB');
}
```

### 3. Export/Import Migration

```bash
# Export old data
pnpm run export:v1 > backup.json

# Run migration script
pnpm run migrate:v2 < backup.json

# Import to new version
pnpm run import:v2 < migrated.json
```

## Compatibility Layer

### Temporary Backward Compatibility

```typescript
// compat/v1.ts
export class V1CompatibilityLayer {
  constructor(private api: WorkerAPI) {}
  
  // Map old API to new
  async createNode(data: V1NodeData): Promise<V1Node> {
    const v2Data = this.transformToV2(data);
    const v2Node = await this.api.createNode(v2Data);
    return this.transformToV1(v2Node);
  }
  
  private transformToV2(v1: V1NodeData): V2NodeData {
    return {
      id: v1.id as NodeId,
      parentNodeId: v1.parentId as NodeId,
      treeId: v1.treeId as TreeId,
      // ... other mappings
    };
  }
}
```

## Testing Migration

### Migration Test Suite

```typescript
// migration.test.ts
describe('Database Migration v1 to v2', () => {
  let oldDB: Dexie;
  let newDB: Dexie;
  
  beforeEach(async () => {
    // Setup v1 database with test data
    oldDB = await setupV1Database();
    await seedV1Data(oldDB);
  });
  
  it('should migrate all nodes', async () => {
    const migration = new DatabaseMigration();
    await migration.run(oldDB);
    
    newDB = new Dexie('HierarchiDB');
    const nodes = await newDB.table('nodes').toArray();
    
    expect(nodes).toHaveLength(100);
    expect(nodes[0]).toHaveProperty('treeNodeId');
    expect(nodes[0]).not.toHaveProperty('id');
  });
  
  it('should preserve relationships', async () => {
    await migration.run(oldDB);
    
    const tree = await buildTree(newDB);
    expect(tree.root.children).toHaveLength(5);
  });
});
```

## Rollback Procedures

### Emergency Rollback

```typescript
async function rollback() {
  // Check for backup
  const hasBackup = await Dexie.exists('HierarchiDB_backup');
  
  if (!hasBackup) {
    throw new Error('No backup found');
  }
  
  // Restore backup
  await Dexie.delete('HierarchiDB');
  const backup = new Dexie('HierarchiDB_backup');
  await backup.rename('HierarchiDB');
  
  // Clear caches
  localStorage.clear();
  sessionStorage.clear();
  
  // Reload application
  window.location.reload();
}
```

## Version Detection

```typescript
// version-detector.ts
export async function detectVersion(): Promise<string> {
  const db = new Dexie('HierarchiDB');
  
  try {
    db.version(1).stores({ nodes: 'id' });
    await db.open();
    
    // Check for v1 schema
    if (await db.table('nodes').where('id').first()) {
      return '1.0.0';
    }
  } catch {
    // Try v2 schema
    db.version(2).stores({ nodes: '&treeNodeId' });
    await db.open();
    
    if (await db.table('nodes').where('treeNodeId').first()) {
      return '2.0.0';
    }
  }
  
  return 'unknown';
}
```

## Migration Checklist

- [ ] Backup all data
- [ ] Test migration on staging
- [ ] Update documentation
- [ ] Prepare rollback procedure
- [ ] Notify users of breaking changes
- [ ] Run migration during maintenance window
- [ ] Verify data integrity post-migration
- [ ] Monitor for issues
- [ ] Keep backup for 30 days

## Related Documentation

- [Database Schema](../03-DATABASE/01-database-architecture.md)
- [API Reference](../02-ARCHITECTURE/03-api-layer.md)
- [Plugin System](../04-PLUGIN-SYSTEM/01-plugin-architecture.md)