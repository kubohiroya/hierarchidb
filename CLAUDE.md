# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HierarchiDB is a high-performance tree-structured data management framework for browser environments. It implements a 4-layer architecture with strict UI-Worker separation via Comlink RPC, dual database strategy (CoreDB/EphemeralDB), and a plugin-based node type system.

## Essential Commands

### Development
- `pnpm install` - Install dependencies (enforces pnpm via preinstall hook)
- `pnpm dev` - Start all development servers in parallel (Turborepo)
- `pnpm build` - Build all packages respecting dependency order
- `pnpm build --force` - Force rebuild without cache

### Testing & Quality
- `pnpm typecheck` - TypeScript checking across all packages
- `pnpm lint` - ESLint validation
- `pnpm format` - Prettier formatting
- `pnpm test` - Unit tests (Vitest)
- `pnpm test:run` - Run tests once without watch
- `pnpm e2e` - E2E tests (Playwright)

### Package-Specific Commands
- `pnpm --filter @hierarchidb/[package] dev` - Run specific package in dev mode
- `pnpm --filter @hierarchidb/[package] build` - Build specific package
- `pnpm --filter @hierarchidb/[package] test` - Test specific package
- `pnpm storybook:ui-core` - Launch UI component Storybook

### Turborepo Usage (Development Operations)
- **Watch specific packages**: `turbo run dev --filter=@hierarchidb/core --filter=@hierarchidb/api --parallel`
- **Build with dependencies**: `turbo run build --filter=@hierarchidb/app` (builds all dependencies first)
- **Force rebuild without cache**: `TURBO_FORCE=true turbo run build --filter=@hierarchidb/core`
- **Development workflow**:
  1. Start app with HMR: `pnpm dev --filter @hierarchidb/app`
  2. Watch library changes: `pnpm --filter @hierarchidb/worker dev` (runs tsc --watch)
  3. For multiple packages: `turbo run dev --filter=@hierarchidb/app --filter=@hierarchidb/core --parallel`

### Document Analysis Tool
- **Analyze docs structure**: `pnpm analyze:docs` - Generates report in docs/_analysis.md
- Checks document flow, similarity between chapters, and suggests missing sections
- Reports help identify gaps and redundancies in documentation

### Build Verification Checklist
After making changes, ALWAYS run in order:
1. `pnpm typecheck` - Must pass without errors
2. `pnpm lint` - Must pass without errors
3. `pnpm test:run` - All tests must pass
4. `pnpm build` - Must complete successfully

## Architecture

### 4-Layer System
```
UI Layer (React/MUI) ←→ Comlink RPC ←→ Worker Layer ←→ Dexie (CoreDB/EphemeralDB)
```

### Core Patterns

**Working Copy Pattern**
1. Create working copy in EphemeralDB
2. Edit working copy (isolated from main data)
3. Commit to CoreDB or discard
4. Supports full undo/redo via ring buffer

**Command Pattern**
- All mutations go through CommandManager
- Commands are serializable for undo/redo
- Worker processes commands with lifecycle hooks

**Subscription System**
- UI subscribes to node changes
- Worker detects diffs and publishes updates
- Automatic cleanup on unsubscribe

### Package Dependencies

```
core (types only)
  ↑
api (interfaces)
  ↑
worker + ui-client (implementations)
  ↑
ui-* packages (components)
  ↑
app (main application)
```

### Critical Packages

- `packages/core/` - Pure TypeScript types, no runtime code
- `packages/api/` - Comlink interface contracts between UI and Worker
- `packages/worker/` - Database operations, command processing, lifecycle management
- `packages/ui-client/` - Worker connection management, React hooks
- `packages/app/` - React Router v7 file-based routing application

## Code Rules

### TypeScript Strictness
- `any` type forbidden - use `unknown` with type guards
- Non-null assertions (`!`) prohibited - use proper null checks
- All imports must use `~/*` paths (configured via tsconfig)
- `tsc-alias` resolves paths during build
- Use `readonly` for function parameters
- Magic strings/numbers forbidden - use constants with `as const`
- Prefer early returns to reduce nesting
- Use assertion functions instead of non-null assertions:
```typescript
function assertNonNull<T>(v: T | null | undefined, msg='required'): asserts v is T {
  if (v == null) throw new Error(msg);
}
```

### Import Paths
- Use `~/*` for package-internal imports
- Use `@hierarchidb/*` for cross-package imports
- ESLint enforces no relative imports

### React Patterns
- Controlled components only
- Required accessibility attributes
- Virtual scrolling for lists >100 items (TanStack Virtual)
- Use MUI theme tokens, no hardcoded styles

### UI Module Structure
UI functionality is split into separate packages:
- `@hierarchidb/ui-core` - Basic UI components (MUI, theme, notifications, icons)
- `@hierarchidb/ui-auth` - Authentication components (OAuth2/OIDC, auth context)
- `@hierarchidb/ui-routing` - React Router navigation and URL helpers
- `@hierarchidb/ui-i18n` - Internationalization with i18next
- `@hierarchidb/ui-client` - Worker connection management, React hooks
- `@hierarchidb/ui-layout` - Layout components
- `@hierarchidb/ui-navigation` - Navigation components
- `@hierarchidb/ui-file` - File handling components
- `@hierarchidb/ui-monitoring` - Performance monitoring
- `@hierarchidb/ui-tour` - User onboarding tours

### Worker Rules
- UI never directly accesses IndexedDB
- All database operations through Worker layer
- Transactions must have clear boundaries
- Use lifecycle hooks for extensibility

## Plugin System

### Node Type Registration
```typescript
// Define node type with all handlers
const MyNodeDefinition: NodeTypeDefinition<Entity, SubEntity, WorkingCopy> = {
  nodeType: 'mytype',
  database: { 
    entityStore: 'mytypes',
    schema: { /* Dexie schema */ },
    version: 1 
  },
  entityHandler: new MyEntityHandler(),
  lifecycle: {
    afterCreate: async (node, context) => { /* hook */ },
    beforeDelete: async (node, context) => { /* hook */ }
  },
  ui: {
    dialogComponent: MyDialog,
    panelComponent: MyPanel
  }
};

// Register at startup
NodeTypeRegistry.getInstance().register(MyNodeDefinition);
```

## Database Strategy

### CoreDB (Long-lived)
- TreeEntity - Tree metadata
- TreeNodeEntity - Node hierarchy
- TreeRootStateEntity - Root node states
- Plugin entity stores

### EphemeralDB (Short-lived)
- WorkingCopyEntity - Edit sessions
- TreeViewStateEntity - UI state
- Cleared on browser close

## Environment Configuration

### Development (`.env.development`)
```
VITE_APP_NAME=
# Empty for development, no base path
```

### Production (`.env.production`)
```
VITE_APP_NAME=hierarchidb
# Sets base path for deployment
```

### Security Configuration Policy
- **Non-sensitive values** (client IDs, redirect URLs): Managed in `.env` files, added to `.gitignore`
- **Sensitive values** (client secrets, JWT keys): Use Cloudflare Secrets (`wrangler secret put`)
- Never commit secrets to repository
- Use environment-specific configuration files

### React Router Base Path
Configured in `packages/app/react-router.config.ts` and `vite.config.ts` using `VITE_APP_NAME`

## Authentication Flow

1. UI initiates OAuth with provider
2. BFF (Cloudflare Worker) handles OAuth callback
3. BFF generates JWT token
4. CORS Proxy validates JWT for API requests

## Performance Guidelines

- Use `useMemo`/`useCallback` for expensive computations
- Keep Dexie transactions short and focused
- Implement virtual scrolling for large lists
- Code split at package boundaries
- Ring buffer for undo/redo (prevents memory leaks)

## Common Development Tasks

### Add New Node Type
1. Create entity handler extending `BaseEntityHandler`
2. Define node type definition
3. Register in `NodeTypeRegistry`
4. Add UI components for dialog/panel
5. Implement lifecycle hooks

### Debug Worker Communication
```typescript
// Enable Comlink debug mode
Comlink.transferHandlers.set('DEBUG', {
  canHandle: () => true,
  serialize: (obj) => console.log('Serialize:', obj)
});
```

### Test Database Operations
```typescript
// Use fake-indexeddb in tests
import 'fake-indexeddb/auto';
// Tests run with in-memory database
```

## Deployment

### GitHub Pages
- Set `VITE_APP_NAME` to repository name
- Build: `pnpm build`
- Deploy `packages/app/dist` directory

### Cloudflare Workers
```bash
# BFF
cd packages/bff
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET
pnpm deploy

# CORS Proxy
cd packages/cors-proxy
wrangler secret put BFF_JWT_SECRET
pnpm deploy
```