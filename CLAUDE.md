# CLAUDE.md

Note for all AI assistants: the canonical guide for AI contributors in this repo is AGENTS.md. If any guidance here conflicts with AGENTS.md, follow AGENTS.md.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HierarchiDB is a high-performance tree-structured data management framework for browser environments. It implements a 4-layer architecture with strict UI-Worker separation via Comlink RPC, dual database strategy (CoreDB/EphemeralDB), and a plugin-based node type system.

## Essential Commands

プロンプトでのユーザとの会話は**日本語**に固定すること。

### Development
- `pnpm install` - Install dependencies (enforces pnpm via preinstall hook)
- `pnpm dev` - Start development with environment configuration
- `turbo run dev --parallel` - Start all development servers in parallel
- `pnpm build` - Build all packages with production environment
- `pnpm build:turbo` - Build using Turborepo directly
- `TURBO_FORCE=true pnpm build` - Force rebuild without cache

### Testing & Quality
- `pnpm typecheck` - TypeScript checking across all packages
- `pnpm lint` - ESLint validation
- `pnpm format` - Prettier formatting  
- `pnpm test` - Run unit tests in watch mode (Vitest)
- `pnpm test:run` - Run tests once without watch
- `pnpm e2e` - E2E tests (Playwright)
- `pnpm check:licenses` - Check license compatibility
- `pnpm analyze:licenses` - Detailed license analysis

### Package-Specific Commands
- `pnpm --filter @hierarchidb/[package] dev` - Run specific package in dev mode
- `pnpm --filter @hierarchidb/[package] build` - Build specific package
- `pnpm --filter @hierarchidb/[package] test` - Test specific package
- `pnpm storybook:ui-core` - Launch UI component Storybook

### Analysis Tools
- `pnpm analyze:docs` - Generate documentation analysis report
- `pnpm count:lines` - Count lines of code by package
- `pnpm analyze:ui` - Analyze UI component duplication
- `pnpm validate:exports` - Validate package.json export configurations
- `pnpm fix:exports` - Auto-fix package export mismatches

## Architecture

### 4-Layer System
```
UI Layer (React/MUI) ←→ Comlink RPC ←→ Worker Layer ←→ Dexie (CoreDB/EphemeralDB)
```

### Package Naming Conventions

**IMPORTANT**: The codebase uses specific package naming patterns that must be maintained:

#### Common Packages
- `@hierarchidb/common-core` - Core types and utilities
- `@hierarchidb/common-api` - API interfaces
- `@hierarchidb/common-type` - Shared type definitions
- `@hierarchidb/common-plugin-base` - Base plugin classes

#### Runtime UI Packages
- `@hierarchidb/runtime-ui-datasource` - Data source UI components
- `@hierarchidb/runtime-ui-plugin-dialog` - Plugin dialog components
- `@hierarchidb/runtime-ui-search-result-window` - Search result window
- `@hierarchidb/runtime-ui-tour` - Tour components
- `@hierarchidb/runtime-ui-appbar` - Application bar
- `@hierarchidb/runtime-ui-landingpage` - Landing page

#### Runtime Worker Packages
- `@hierarchidb/runtime-worker-worker` - Worker implementation
- `@hierarchidb/runtime-worker-plugin-registry` - Plugin registry
- `@hierarchidb/runtime-worker-worker-bootstrap` - Worker initialization

#### Runtime Shared Packages
- `@hierarchidb/runtime-shared-fetch-metadata` - Metadata fetching
- `@hierarchidb/runtime-shared-client` - Client functionality
- `@hierarchidb/runtime-shared-batch-processor` - Batch processing
- `@hierarchidb/runtime-shared-*-datasource` - Data source definitions (shape, location, route, folder)

#### UI Packages
- `@hierarchidb/ui-core` - Base UI components
- `@hierarchidb/ui-*` - Feature-specific UI packages
- `@hierarchidb/ui-treeconsole-*` - TreeConsole component parts

#### Plugin Packages
- `@hierarchidb/*-plugin` - Node type plugins (e.g., folder-plugin, shape-plugin)

### Core Patterns

**Working Copy Pattern**
- Creates isolated edit sessions in EphemeralDB
- Changes can be committed to CoreDB or discarded
- Maintains data integrity during edits

**ID Type System (Branded Types)**
```typescript
// Core branded types - ALWAYS cast strings to these types
type NodeId = string & { readonly __brand: 'NodeId' };
type TreeId = string & { readonly __brand: 'TreeId' };
type EntityId = string & { readonly __brand: 'EntityId' };

// Usage
const nodeId = 'node-123' as NodeId;  // Required cast
const treeId = generateId() as TreeId;  // Required cast
```

**Command Pattern**
- All mutations go through CommandManager
- Supports undo/redo via ring buffer
- Commands are serializable

### Critical Package Relationships

1. **Foundation Layer**
   - `common-core` → Pure types, no runtime (most depended upon)
   - `common-type` → Shared type definitions
   - `common-api` → Comlink RPC interfaces

2. **Implementation Layer**  
   - `runtime-worker` → Database operations, depends on common-core and common-api
   - Cannot be imported by plugins (architectural rule)

3. **Plugin Layer**
   - Plugins extend `@hierarchidb/common-plugin-base` classes
   - Must NOT depend on runtime-worker
   - Use common-api interfaces for Worker communication

## Plugin System

### Base Classes (from @hierarchidb/common-plugin-base)

```typescript
// Entity handler hierarchy
BaseEntityHandler<TEntity, TWorkingCopy>
  ├── MetadataEntityHandler  // For entities with metadata/tags
  ├── HierarchicalEntityHandler  // For tree structures
  └── (Custom handlers)

// Usage example
import { MetadataEntityHandler } from '@hierarchidb/common-plugin-base';

export class LocationEntityHandler extends MetadataEntityHandler<
  LocationEntity,
  LocationWorkingCopy,
  CreateLocationData,
  LocationFilterCriteria
> {
  // Implementation
}
```

### Node Type Registration
- Use string literals for nodeType (NOT enums)
- Entity handlers must extend base classes
- All IDs must be cast to branded types

## Database Strategy

### CoreDB (Persistent)
- TreeEntity, TreeNodeEntity, TreeRootStateEntity
- Plugin-specific entity stores
- Uses branded types for all IDs

### EphemeralDB (Temporary)
- WorkingCopyEntity for edit sessions
- UI state and view configurations
- Cleared on browser close

## Common Issues & Solutions

### TypeScript Branded Type Errors
- Always cast string literals to branded types
- Use `as NodeId`, `as EntityId`, `as TreeId`
- Never use direct assignment to branded types

### Build Issues
1. Run `pnpm typecheck` first to catch type errors
2. Build dependencies before dependent packages
3. Use `TURBO_FORCE=true` to bypass cache if needed

## Development Workflow

### Turborepo Watch Mode
```bash
# Recommended: Start everything with one command
turbo run dev --parallel

# Alternative: Separate terminals for better logs
# Terminal 1: Watch library packages
turbo run dev --parallel --filter='!@hierarchidb/app'
# Terminal 2: Start application
cd app && pnpm dev
```

### Adding New Features
1. Create/modify packages following naming conventions
2. Extend appropriate base classes from common-plugin-base
3. Use branded types for all IDs
4. Run `pnpm typecheck` before committing
5. Ensure no circular dependencies

### Testing
```typescript
// Use fake-indexeddb for database tests
import 'fake-indexeddb/auto';

// Always cast IDs in tests
const nodeId = 'test-node' as NodeId;
const entity = await handler.createEntity(nodeId, data);
```

## Environment Configuration

### Development
- `VITE_APP_NAME=` (empty for no base path)
- Uses `.env.development`

### Production  
- `VITE_APP_NAME=hierarchidb` (sets base path)
- Uses `.env.production`

## Deployment

### GitHub Pages
```bash
pnpm build
# Deploy app/dist directory
```

### Cloudflare Workers
```bash
cd packages/backend/bff
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET
pnpm deploy
```
