# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

hierarchiidb is a high-performance tree-structured data management framework for browser environments. It uses a 4-layer architecture with strict UI-Worker separation via Comlink RPC, dual database strategy (CoreDB/EphemeralDB), and plugin-based node type system.

## Essential Commands

### Development
- `pnpm dev` - Start all development servers (uses Turborepo parallel execution)
- `pnpm build` - Build all packages (respects dependency order)  
- `pnpm typecheck` - Run TypeScript checking across all packages
- `pnpm test` - Run unit tests (Vitest), `pnpm e2e` for E2E (Playwright)
- `pnpm lint` - Run ESLint, `pnpm format` for Prettier

### Package-Specific Development
- `pnpm --filter @hierarchidb/core dev` - Specific package dev mode
- `pnpm storybook:ui-core` - Start Storybook for UI components
- `pnpm --filter @hierarchidb/worker test` - Run tests for specific package

### When Task Complete - ALWAYS RUN:
1. `pnpm typecheck` - TypeScript must pass
2. `pnpm lint` - Linting must pass  
3. `pnpm test` - Tests must pass
4. `pnpm build` - Build must succeed

## Architecture Understanding

### 4-Layer System
```
UI Layer (React/MUI) ←→ Comlink RPC ←→ Worker Layer ←→ Dexie (CoreDB/EphemeralDB)
```

### Key Patterns
- **Working Copy Pattern**: Create working copy → Edit → Commit/Discard (supports undo/redo)
- **AOP Node System**: Plugin-based node types with lifecycle hooks
- **Strict Separation**: UI never accesses IndexedDB directly, only through Worker

### Package Structure
- `/packages/core/` - Types and data models only
- `/packages/api/` - UI-Worker interface contracts
- `/packages/worker/` - Database operations, command processing  
- `/packages/ui*/` - Modular React UI packages (core, auth, routing, i18n)
- `/packages/plugins/` - Node type plugins (e.g., basemap)

## Critical Code Rules

### TypeScript (Strictly Enforced)
- **`any` type is FORBIDDEN** - use `unknown` with type guards
- **Non-null assertion (`!`) is PROHIBITED** - use proper null checks
- **Relative imports FORBIDDEN** - ESLint enforces absolute imports only
- **Type safety required** for all plugin APIs and Comlink interfaces

### React/UI Guidelines
- **Controlled components only** - don't mix controlled/uncontrolled
- **Accessibility mandatory** - labels, roles, keyboard navigation
- **Virtualization required** for large lists (use TanStack Virtual)
- **MUI theme tokens** - never hardcode colors/spacing

### Worker/Database Rules
- **No UI → Database direct access** - all through Worker layer
- **Transaction boundaries clear** - group related operations properly
- **Required indexing** - no full table scans allowed
- **Lifecycle hooks** - use for node type extensions

### Error Handling
- **Explicit error handling** - use Result<T,E> patterns
- **Type-safe error codes** for Comlink API
- **No secrets in logs** - especially production builds

## Plugin Development

### Node Type Definition Pattern
```typescript
export const MyNodeDefinition: NodeTypeDefinition<MyEntity, MySubEntity, MyWorkingCopy> = {
  nodeType: 'mytype',
  database: { entityStore: 'mytypes', schema: {...}, version: 1 },
  entityHandler: new MyEntityHandler(),
  lifecycle: { afterCreate, beforeDelete, ... },
  ui: { dialogComponent, panelComponent, ... },
  api: { workerExtensions: {...}, clientExtensions: {...} }
};
```

### Registration
```typescript
NodeTypeRegistry.getInstance().register(MyNodeDefinition);
```

## Testing Requirements

### Unit Tests (Vitest)
- Business logic functions (pure functions preferred)
- Entity handlers CRUD operations
- Validation logic

### E2E Tests (Playwright)  
- Critical user flows: Create → Edit → Delete → Undo/Redo
- Plugin integration scenarios
- Authentication flows

## Common Patterns

### Command Processing
```typescript
// UI sends command
const result = await workerApi.executeCommand({
  type: 'createNode',
  payload: { parentId, nodeType, data }
});

// Worker processes with lifecycle hooks
await lifecycleManager.handleNodeCreation(parentId, data, nodeType);
```

### Working Copy Flow
```typescript
// 1. Create working copy
const workingCopy = await entityHandler.createWorkingCopy(nodeId);

// 2. Edit (in EphemeralDB)
await entityHandler.updateWorkingCopy(workingCopy.id, changes);

// 3. Commit (to CoreDB) or Discard
await entityHandler.commitWorkingCopy(nodeId, workingCopy);
```

## Authentication Architecture

### OAuth2 Flow
UI → Identity Provider → BFF (Cloudflare Worker) → JWT → CORS Proxy

### Secrets Management
- **Frontend**: No secrets, only client IDs in environment variables
- **Cloudflare Workers**: Secrets via `wrangler secret put`
- **Development**: Use `.env` (gitignored) for non-sensitive config

## Performance Considerations

- **Virtual scrolling** for any list >100 items
- **useMemo/useCallback** for expensive React computations
- **Dexie transactions** kept short and focused
- **Code splitting** at package boundaries
- **Ring buffer** for undo/redo (prevents memory leaks)

## Development Environment

- **Node.js** >= 20.0.0 required
- **pnpm** >= 9.0.0 (enforced by preinstall script)
- **macOS** development (Darwin commands available)
- **Turborepo** for build orchestration
- **Strict TypeScript** configuration across all packages