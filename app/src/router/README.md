# Router Module

This directory contains the TanStack Router implementation for HierarchiDB, supporting both browser and hash routing modes.

## Structure

```
router/
├── __tests__/          # Unit tests for router functionality
├── context/            # Shared context providers (AppProviders)
├── routes/             # TanStack Router route definitions
│   ├── rootRoute.tsx       # Root route with UI plugin initialization
│   ├── indexRoute.tsx      # Home page (/)
│   ├── infoRoute.tsx       # Info page (/info)
│   ├── mapRoute.tsx        # Map page (/map)
│   ├── authRoutes.tsx      # Auth routes (/auth/*)
│   ├── utilityRoutes.tsx   # Utility routes (/tags, /plugins, etc.)
│   └── tree/               # Tree routes (Phase 3)
│       ├── layoutRoute.tsx   # /t/:treeId layout
│       ├── pageRoute.tsx     # /t/:treeId/:pageNodeId page
│       ├── targetRoute.tsx   # /t/:treeId/:pageNodeId/:targetNodeId
│       ├── nodeTypeRoute.tsx # /t/:treeId/:pageNodeId/:targetNodeId/:nodeType
│       └── dialogRoute.tsx   # /t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action
├── loaders/            # Data loading functions
│   ├── uiPlugins.ts        # UI plugin setup
│   ├── mapLoader.ts        # Map zxy parameter handling
│   ├── treeLoaders.ts      # Tree data loading (Phase 3)
│   ├── workerClient.ts     # Worker initialization service (Phase 4)
│   └── __tests__/          # Loader tests
│       ├── uiPlugins.test.ts
│       ├── mapLoader.test.ts
│       ├── treeLoaders.test.ts
│       └── workerClient.test.ts  # Phase 4 tests
└── index.tsx           # Main router factory and utilities
```

## Usage

The router engine is controlled by the `VITE_ROUTER_ENGINE` environment variable:

- `react-router` (default): Uses React Router v7
- `tanstack`: Uses TanStack Router

### Router Mode

The router mode is controlled by `VITE_ROUTER_MODE`:

- `browser` (default): Standard browser history routing
- `hash`: Hash-based routing (useful for GitHub Pages)

### Example Configuration

In `.env.development`:
```bash
# Use TanStack Router with browser mode
VITE_ROUTER_ENGINE=tanstack
VITE_ROUTER_MODE=browser
```

In `.env.production`:
```bash
# Use React Router with hash mode for GitHub Pages
VITE_ROUTER_ENGINE=react-router
VITE_ROUTER_MODE=browser
VITE_USE_HASH_ROUTING=true
```

## Key Functions

### `createHierarchiRouter(config)`

Creates a TanStack Router instance with the specified configuration.

**Parameters:**
- `config.mode`: `'browser'` or `'hash'`
- `config.basename`: Optional base path for routing (e.g., `/hierarchidb`)

**Returns:** Promise resolving to TanStack Router instance

**Note:** This is now an async function that dynamically imports route definitions.

### `getRouterMode()`

Determines the router mode from environment variables.

**Returns:** `'browser'` or `'hash'`

### `getBasePath()`

Gets the base path from environment variables with proper formatting.

**Returns:** Base path string (e.g., `/hierarchidb` or `/`)

## Route Structure

### Top-Level Routes (Phase 2 - Complete)

All top-level routes have been migrated to TanStack Router:

- `/` - Home page with tree type selection
- `/info` - Application information and licenses
- `/map` - Map view with URL-synchronized position (zxy parameter)
- `/tags` - Tag list and search
- `/tags/:uuid` - Tag detail page
- `/auth/login` - Login page
- `/auth/callback` - OAuth callback handler
- `/auth/silent-renew` - Silent token renewal
- `/plugins` - Plugin registry
- `/plugin-demo` - Plugin demo page
- `/worker-test` - Worker API test page
- `/test` - Simple test page

### Tree Routes (Phase 3 - Complete)

Tree-related routes have been migrated to TanStack Router:

- `/t/:treeId` - Tree layout (loads tree data)
- `/t/:treeId/:pageNodeId` - Page with TreeConsoleIntegration and AppBar
- `/t/:treeId/:pageNodeId/:targetNodeId` - Target node selection
- `/t/:treeId/:pageNodeId/:targetNodeId/:nodeType` - Node type with NotFound handling
- `/t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action` - Dialog route (including TrashDialog)

### Root Route Features

The root route (`rootRoute.tsx`) provides:

1. **UI Plugin Initialization**: Calls `setupUIPlugins()` in `beforeLoad`
2. **Common Context**: Provides `uiPluginsReady` flag to all child routes
3. **App Providers**: Wraps all routes with common providers

### Loaders

#### setupUIPlugins

Located in `loaders/uiPlugins.ts`, this function:
- Loads all UI plugin modules via dynamic imports
- Returns a registry of loaded plugins
- Provides cleanup via `teardown()` function

#### mapLoader

Located in `loaders/mapLoader.ts`, this provides:
- `parseZxyParam()`: Parse map position from URL (bug fixed: `parts.length !== 3`)
- `formatZxyParam()`: Format position for URL
- `mapLoader()`: TanStack Router loader function

#### treeLoaders

Located in `loaders/treeLoaders.ts`, this module:
- Re-exports existing loader functions from `~/loader.js` for TanStack Router
- Provides type definitions for tree route context
- Functions: `loadTree`, `loadPageNode`, `loadTargetNode`, `loadNodeType`, `loadNodeAction`
- Maintains compatibility with existing loader implementation

**Design Note**: Phase 3 implementation reuses existing loader.ts functions to minimize changes and maintain consistency with React Router routes.

## Testing

Run the router tests:
```bash
pnpm -C app test -- router/__tests__/engine-toggle.test.ts
pnpm -C app test -- router/loaders/__tests__/
```

Test Results:
- Router engine tests: 13 tests passing
- Loader tests: 30+ tests passing (21 mapLoader + 4 uiPlugins + 5 treeLoaders)

**Note**: Full E2E tests require building all packages first.

## Migration Status

**Phase 1**: ✅ Complete
- TanStack Router dependency added
- Router factory function implemented
- Feature flag support added
- AppProviders abstraction created
- Unit tests passing

**Phase 2**: ✅ Complete
- Top-level routes migrated to TanStack Router
- UI plugin initialization integrated
- Route definitions for `/`, `/info`, `/map`, `/tags`, `/auth/*`, etc.
- Map zxy parameter bug fixed
- Comprehensive loader tests (25 tests)

**Phase 3**: ✅ Complete
- Tree routes migrated to TanStack Router (`/t/*`)
- All 5 tree route levels implemented (layout → page → target → nodeType → dialog)
- treeLoaders.ts created for tree data loading
- Existing React Router components reused for TreeConsoleIntegration
- NotFound dialog handling integrated
- TrashDialog special case handled
- Unit tests added (treeLoaders.test.ts)

**Phase 4**: ✅ Complete
- Worker initialization service implemented (`workerClient.ts`)
- Retry/timeout functionality with exponential backoff
- AbortSignal support for cancellable initialization
- 9 unit tests passing (workerClient.test.ts)
- Full integration with TanStack Router `beforeLoad` hooks

**Phase 5**: Future
- React Router removal
- Final cleanup and documentation

## Implementation Notes

### Async Router Creation

The `createHierarchiRouter` function is now async because it uses dynamic imports to avoid circular dependencies:

```typescript
const router = await createHierarchiRouter({ mode: 'browser' });
```

### Route Reuse Strategy

Phases 2 and 3 reuse existing React Router component implementations to minimize changes:

```typescript
// Example: indexRoute reuses existing component
import IndexPage from '../../routes/_index.js';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});

// Example: pageRoute reuses TreeConsoleIntegration component
import TreePageLayout from '../../../routes/t.($treeId).($pageNodeId).js';

export const treePageRoute = createRoute({
  getParentRoute: () => treeLayoutRoute,
  path: '$pageNodeId',
  loader: async ({ params }) => { /* ... */ },
  component: TreePageLayout,
});
```

This approach allows for incremental migration and easier rollback if needed.

### Tree Route Hierarchy

The tree routes are nested hierarchically in TanStack Router:

```typescript
treeLayoutRoute (t/:treeId)
  └── treePageRoute (t/:treeId/:pageNodeId)
      └── treeTargetRoute (t/:treeId/:pageNodeId/:targetNodeId)
          └── treeNodeTypeRoute (t/:treeId/:pageNodeId/:targetNodeId/:nodeType)
              └── treeDialogRoute (t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action)
```

Each level loads its specific data and passes it down through TanStack Router's context system.

