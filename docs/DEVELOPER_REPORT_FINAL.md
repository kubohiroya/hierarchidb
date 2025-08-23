# HierarchiDB Developer Report

## 1. Project Overview

HierarchiDB is a high-performance tree-structured data management framework for browser environments. It implements a 4-layer architecture with strict UI-Worker separation via Comlink RPC, dual database strategy (CoreDB/EphemeralDB), and a plugin-based node type system.

### Key Technologies
- **Frontend**: React 18, MUI (Material-UI), TypeScript
- **Database**: Dexie.js (IndexedDB wrapper), dual database pattern
- **Worker Communication**: Comlink RPC for UI-Worker separation
- **Build System**: Turborepo monorepo with pnpm
- **Testing**: Vitest for unit tests, Playwright for E2E
- **Authentication**: OAuth2/OIDC with JWT tokens

## 2. Architecture

### 4-Layer System Architecture
```
UI Layer (React/MUI) ←→ Comlink RPC ←→ Worker Layer ←→ Dexie (CoreDB/EphemeralDB)
```

### Core Design Patterns

#### Working Copy Pattern
1. Create working copy in EphemeralDB (isolated editing space)
2. Edit working copy without affecting main data
3. Commit to CoreDB or discard changes
4. Supports full undo/redo via ring buffer

#### Branded Type System for ID Safety
```typescript
type NodeId = string & { readonly __brand: 'NodeId' };
type TreeId = string & { readonly __brand: 'TreeId' };
type EntityId = string & { readonly __brand: 'EntityId' };

// Usage
const nodeId = 'node-123' as NodeId;
const treeId = 'tree-456' as TreeId;
```

#### Command Pattern
- All mutations through CommandManager
- Commands are serializable for undo/redo
- Worker processes commands with lifecycle hooks

#### Subscription System
- UI subscribes to node changes
- Worker detects diffs and publishes updates
- Automatic cleanup on unsubscribe

## 3. Package Architecture

The project uses a monorepo structure with 43 packages organized in dependency layers:

### Foundation Layer (Depth 0)
- **`@hierarchidb/core`** - Pure TypeScript types, branded IDs, patterns, utilities (25 packages depend on it)

### API Contract Layer (Depth 1)
- **`@hierarchidb/api`** - Comlink RPC interfaces between UI and Worker layers (8 packages depend on it)

### Implementation Layer (Depth 2)
- **`@hierarchidb/worker`** - Database operations, command processing, lifecycle management

### UI Foundation Layer (Depth 0-2)
- **`@hierarchidb/ui-core`** - Base UI components (12 packages depend on it)
- **`@hierarchidb/ui-client`** - Worker connection management and React hooks
- **`@hierarchidb/ui-theme`** - MUI theme configuration

### UI Feature Layer (Depth 2-3)
- **`@hierarchidb/ui-auth`** - Authentication components
- **`@hierarchidb/ui-i18n`** - Internationalization support
- **`@hierarchidb/ui-routing`** - React Router utilities
- **`@hierarchidb/ui-navigation`** - Navigation components
- **`@hierarchidb/ui-layout`** - Layout components
- **Specialized UI packages** - File handling, dialogs, maps, monitoring, etc.

### TreeConsole Components (Depth 1-3)
- **Parts packages** - Breadcrumb, footer, toolbar, treetable components
- **`@hierarchidb/ui-treeconsole-base`** - Main TreeConsole orchestrator

### Plugin Layer (Depth 2-3)
- **`@hierarchidb/plugin-basemap`** - Map tile management
- **`@hierarchidb/plugin-folder`** - Folder node type
- **`@hierarchidb/plugin-project`** - Project node type
- **`@hierarchidb/plugin-shape`** - Geographic shape data
- **`@hierarchidb/plugin-spreadsheet`** - Spreadsheet functionality
- **`@hierarchidb/plugin-stylemap`** - Map styling

### Application Layer (Depth 4)
- **`@hierarchidb/app`** - Main React application with routing

## 4. Database Strategy

### CoreDB (Long-lived, IndexedDB)
- **TreeEntity** - Tree metadata with TreeId branding
- **TreeNodeEntity** - Node hierarchy with NodeId branding
- **TreeRootStateEntity** - Root node states
- **Plugin entity stores** - Custom entity types with EntityId branding

### EphemeralDB (Short-lived, cleared on browser close)
- **WorkingCopyEntity** - Edit sessions with consistent NodeId keys
- **TreeViewStateEntity** - UI state persistence
- **ViewEntity** - Temporary view configurations

### Key Schema Properties
```typescript
// Dexie schema with branded type integration
trees: '&treeId, treeRootNodeId, treeTrashRootNodeId, superRootNodeId'
nodes: '&treeNodeId, parentNodeId, &[parentNodeId+name], [parentNodeId+updatedAt], removedAt, originalParentNodeId, *references'
rootStates: '&[treeId+treeRootNodeType], treeId, treeRootNodeId'
```

## 5. Plugin System

### Node Type Registration
```typescript
const MyNodeDefinition: NodeTypeDefinition<Entity, SubEntity, WorkingCopy> = {
  nodeType: 'mytype', // String literal, not enum
  database: { 
    entityStore: 'mytypes',
    schema: {
      '&id': 'EntityId', // Primary key with branded type
      'nodeId': 'NodeId', // Foreign key to TreeNode
      'parentEntityId?': 'EntityId',
      'createdAt, updatedAt, version': '',
    },
    version: 1 
  },
  entityHandler: new MyEntityHandler(),
  lifecycle: {
    afterCreate: async (node: TreeNode, context) => { 
      console.log('Created node:', node.id);
    },
    beforeDelete: async (node: TreeNode, context) => { 
      await context.cleanupRelatedEntities(node.id);
    }
  },
  ui: {
    dialogComponent: MyDialog,
    panelComponent: MyPanel
  }
};

// Register at startup
NodeTypeRegistry.getInstance().register(MyNodeDefinition);
```

### Entity Handler Pattern
```typescript
class MyEntityHandler extends BaseEntityHandler<MyEntity> {
  async createEntity(nodeId: NodeId, data: Partial<MyEntity>): Promise<MyEntity> {
    const entityId = generateEntityId() as EntityId;
    const entity: MyEntity = {
      id: entityId,
      nodeId: nodeId,
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    
    await this.table.add(entity);
    return entity;
  }
}
```

## 6. Development Guidelines

### Essential Commands
```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Start all development servers
pnpm build            # Build all packages
pnpm build --force    # Force rebuild without cache

# Testing & Quality
pnpm typecheck        # TypeScript checking
pnpm lint             # ESLint validation
pnpm format           # Prettier formatting
pnpm test             # Unit tests (Vitest)
pnpm test:run         # Run tests once
pnpm e2e              # E2E tests (Playwright)

# Package-specific
pnpm --filter @hierarchidb/[package] dev
pnpm --filter @hierarchidb/[package] build
pnpm --filter @hierarchidb/[package] test
```

### TypeScript Strictness Rules
- `any` type forbidden - use `unknown` with type guards
- Non-null assertions (`!`) prohibited - use proper null checks
- All imports must use `~/*` paths (configured via tsconfig)
- Use `readonly` for function parameters
- Magic strings/numbers forbidden - use constants with `as const`

### Branded Type Usage
```typescript
// ✅ Correct: Cast when creating IDs
const nodeId = generateNodeId() as NodeId;
const entityId = crypto.randomUUID() as EntityId;

// ✅ Correct: Cast when receiving external data
const validNodeIds = externalIds.filter(id => 
  typeof id === 'string' && id.length > 0
) as NodeId[];

// ✅ Correct: Cast constants
const ROOT_NODE_ID = 'root' as NodeId;

// ❌ Incorrect: Direct assignment
const nodeId: NodeId = 'some-id'; // Type error
```

### Import Path Rules
- Use `~/*` for package-internal imports
- Use `@hierarchidb/*` for cross-package imports
- ESLint enforces no relative imports

### React Patterns
- Controlled components only
- Required accessibility attributes
- Virtual scrolling for lists >100 items (TanStack Virtual)
- Use MUI theme tokens, no hardcoded styles

### Worker Layer Rules
- UI never directly accesses IndexedDB
- All database operations through Worker layer
- Transactions must have clear boundaries
- Use lifecycle hooks for extensibility

## 7. Build & Deployment

### Build Verification Checklist
After making changes, ALWAYS run in order:
1. `pnpm typecheck` - Must pass without errors
2. `pnpm lint` - Must pass without errors
3. `pnpm test:run` - All tests must pass
4. `pnpm build` - Must complete successfully

### Package Export Configuration
```json
// Correct package.json configuration
{
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

### Deployment Targets

#### GitHub Pages
- Set `VITE_APP_NAME` to repository name
- Build: `pnpm build`
- Deploy `packages/app/dist` directory

#### Cloudflare Workers
```bash
# BFF (Backend for Frontend)
cd packages/bff
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET
pnpm deploy

# CORS Proxy
cd packages/cors-proxy
wrangler secret put BFF_JWT_SECRET
pnpm deploy
```

## 8. Authentication & Security

### OAuth2 Flow
1. UI initiates OAuth with provider (Google, etc.)
2. BFF (Cloudflare Worker) handles OAuth callback
3. BFF generates JWT token
4. CORS Proxy validates JWT for API requests

### Security Configuration
- **Non-sensitive values** (client IDs, URLs): Use `.env` files
- **Sensitive values** (secrets, keys): Use Cloudflare Secrets
- Never commit secrets to repository
- Environment-specific configuration files

## 9. Testing Strategy

### Unit Testing (Vitest)
- Use `fake-indexeddb` for database tests
- Test branded type casting patterns
- Mock Worker communication with Comlink

```typescript
// Test pattern example
describe('NodeId operations', () => {
  it('should handle NodeId casting correctly', async () => {
    const testNodeId = 'test-node-123' as NodeId;
    const node: TreeNode = {
      id: testNodeId,
      nodeType: 'folder',
      name: 'Test Node',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    
    await coreDB.createNode(node);
    const retrieved = await coreDB.getNode(testNodeId);
    expect(retrieved?.id).toBe(testNodeId);
  });
});
```

### Integration Testing
- Worker API communication tests
- Database transaction tests
- Plugin lifecycle tests

### E2E Testing (Playwright)
- TreeConsole operations
- Plugin interactions
- Authentication flows

## 10. Performance Guidelines

- Use `useMemo`/`useCallback` for expensive computations
- Keep Dexie transactions short and focused
- Implement virtual scrolling for large lists
- Code split at package boundaries
- Ring buffer for undo/redo (prevents memory leaks)

## 11. Common Issues & Solutions

### TypeScript Issues After ID Changes
- Missing `as NodeId` / `as TreeId` type casts
- Using deprecated `TreeRootNodeTypes` enum (use string literals)
- Incorrect branded type assignments in test files
- Missing type imports in worker package files

### Debug Worker Communication
```typescript
// Enable Comlink debug mode
Comlink.transferHandlers.set('DEBUG', {
  canHandle: () => true,
  serialize: (obj) => console.log('Serialize:', obj)
});
```

### Refactoring Guidelines
When performing large-scale refactoring:
- Use codemods (jscodeshift, ts-morph) instead of find-and-replace
- Always run with `--dry-run` first
- Test incrementally with `pnpm typecheck` after each step
- Commit after each successful codemod for easy rollback

## 12. Future Considerations

### Architectural Improvements
- Enhanced plugin isolation
- Improved error handling and recovery
- Performance optimization for large datasets
- Better caching strategies

### Development Experience
- Enhanced debugging tools
- Better development documentation
- Improved testing utilities
- Code generation tools for plugins

---

This document provides a comprehensive overview of the HierarchiDB architecture and development practices. For specific implementation details, refer to the individual package documentation and source code examples.