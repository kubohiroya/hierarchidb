# Router Module

This directory contains the TanStack Router implementation for HierarchiDB, supporting both browser and hash routing modes.

## Structure

```
router/
├── __tests__/          # Unit tests for router functionality
├── context/            # Shared context providers (AppProviders)
├── routes/             # TanStack Router route definitions (to be added in Phase 2)
├── loaders/            # Data loading functions (to be added in Phase 2+)
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

**Returns:** TanStack Router instance

### `getRouterMode()`

Determines the router mode from environment variables.

**Returns:** `'browser'` or `'hash'`

### `getBasePath()`

Gets the base path from environment variables with proper formatting.

**Returns:** Base path string (e.g., `/hierarchidb` or `/`)

## Testing

Run the router tests:
```bash
pnpm -C app test -- router/__tests__/engine-toggle.test.ts
```

## Migration Status

**Phase 1 (Current)**: ✅ Complete
- TanStack Router dependency added
- Router factory function implemented
- Feature flag support added
- AppProviders abstraction created
- Unit tests passing

**Phase 2**: Planned
- Top-level routes migration
- UI plugin initialization
- Route definitions for `/`, `/info`, `/map`, `/tags`, etc.

**Phase 3-5**: Future
- Tree routes migration (`/t/*`)
- Worker initialization refactor
- React Router removal
