import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHierarchiRouter, getBasePath, getRouterMode } from '../../index.js';

function createMockRoute() {
  return {
    addChildren: () => createMockRoute(),
  };
}

// Mock UI plugin setup to avoid loading actual plugin-loaders
vi.mock('../../loaders/uiPlugins.js', () => ({
  setupUIPlugins: vi.fn().mockResolvedValue({
    registry: {},
    servicesReady: Promise.resolve(),
    teardown: async () => {},
  }),
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createRoute: vi.fn(() => createMockRoute()),
    createRouter: vi.fn(({ history }) => ({ history })),
    createBrowserHistory: vi.fn(() => ({ location: {} })),
    createHashHistory: vi.fn(() => ({ location: {} })),
    createMemoryHistory: vi.fn(() => ({ location: {} })),
  };
});

vi.mock('../../routes/rootRoute.js', () => ({
  rootRoute: createMockRoute(),
}));

vi.mock('../../routes/indexRoute.js', () => ({
  indexRoute: createMockRoute(),
}));

vi.mock('../../routes/infoRoute.js', () => ({
  infoRoute: createMockRoute(),
}));

vi.mock('../../routes/mapRoute.js', () => ({
  mapRoute: createMockRoute(),
}));

vi.mock('../../routes/maintenanceRoute.js', () => ({
  maintenanceRoute: createMockRoute(),
}));

vi.mock('../../routes/auth/index.js', () => ({
  authLoginRoute: createMockRoute(),
  authCallbackRoute: createMockRoute(),
  authSilentRenewRoute: createMockRoute(),
}));

vi.mock('../../routes/utilityRoutes.js', () => ({
  tagsRoute: createMockRoute(),
  tagDetailRoute: createMockRoute(),
  pluginsRoute: createMockRoute(),
}));

vi.mock('../../routes/tree/baseRoute.js', () => ({
  treeBaseRoute: createMockRoute(),
}));

vi.mock('../../routes/tree/layoutRoute.js', () => ({
  treeLayoutRoute: createMockRoute(),
}));

vi.mock('../../routes/tree/indexRoute.js', () => ({
  treeLayoutIndexRoute: createMockRoute(),
}));

vi.mock('../../routes/tree/pageRoute.js', () => ({
  treePageRoute: createMockRoute(),
}));

vi.mock('../../routes/tree/tagsRoute.js', () => ({
  treeTagsRoute: createMockRoute(),
  treeTagDetailRoute: createMockRoute(),
}));

vi.mock('../../routes/tree/targetRoute.js', () => ({
  treeTargetRoute: createMockRoute(),
}));

vi.mock('../../routes/tree/nodeTypeRoute.js', () => ({
  treeNodeTypeRoute: createMockRoute(),
}));

vi.mock('../../routes/tree/dialogRoute.js', () => ({
  treeDialogRoute: createMockRoute(),
  treeDialogModeRoute: createMockRoute(),
  treeDialogModeStepRoute: createMockRoute(),
}));

vi.mock('../../routes/folder/baseRoute.js', () => ({
  folderBaseRoute: createMockRoute(),
}));

vi.mock('../../routes/folder/folderRoutes.js', () => ({
  folderTreeRoute: createMockRoute(),
  folderTreeIndexRoute: createMockRoute(),
  folderPageRoute: createMockRoute(),
  folderPageIndexRoute: createMockRoute(),
  folderViewRoute: createMockRoute(),
  folderViewSortRoute: createMockRoute(),
}));

vi.mock('maplibre-gl', () => ({
  Map: class MapMock {},
  default: { Map: class MapDefaultMock {} },
}));

vi.mock('@watergis/maplibre-gl-export', () => ({
  MaplibreExportControl: class MaplibreExportControlMock {},
}));

describe('createHierarchiRouter', () => {
  beforeEach(() => {
    // Reset environment variables
    vi.unstubAllEnvs();
  });

  it('should create a router with browser mode', async () => {
    const router = await createHierarchiRouter({ mode: 'browser' });

    expect(router).toBeDefined();
    expect(router.history).toBeDefined();
    expect(router.history.location).toBeDefined();
  }, 30_000);

  it('should create a router with hash mode', async () => {
    const router = await createHierarchiRouter({ mode: 'hash' });

    expect(router).toBeDefined();
    expect(router.history).toBeDefined();
    expect(router.history.location).toBeDefined();
  }, 30_000);

  it('should apply basename when provided', async () => {
    const router = await createHierarchiRouter({
      mode: 'browser',
      basename: '/hierarchidb',
    });

    expect(router).toBeDefined();
    expect(router.history).toBeDefined();
  }, 30_000);

  it('should not apply basename for hash mode', async () => {
    const router = await createHierarchiRouter({
      mode: 'hash',
      basename: '/hierarchidb',
    });

    expect(router).toBeDefined();
    expect(router.history).toBeDefined();
  }, 30_000);
});

describe('getRouterMode', () => {
  it('should return "browser" by default', () => {
    expect(getRouterMode()).toBe('browser');
  });

  it('should return "hash" when VITE_ROUTER_MODE is "hash"', () => {
    vi.stubEnv('VITE_ROUTER_MODE', 'hash');
    expect(getRouterMode()).toBe('hash');
  });

  it('should return "browser" when VITE_ROUTER_MODE is "browser"', () => {
    vi.stubEnv('VITE_ROUTER_MODE', 'browser');
    expect(getRouterMode()).toBe('browser');
  });

  it('should handle case insensitivity', () => {
    vi.stubEnv('VITE_ROUTER_MODE', 'HASH');
    expect(getRouterMode()).toBe('hash');
  });

  it('should default to "browser" for invalid values', () => {
    vi.stubEnv('VITE_ROUTER_MODE', 'invalid');
    expect(getRouterMode()).toBe('browser');
  });

  it('should return "hash" when VITE_USE_HASH_ROUTING is true', () => {
    vi.stubEnv('VITE_USE_HASH_ROUTING', 'true');
    expect(getRouterMode()).toBe('hash');
  });

  it('should return "browser" when VITE_USE_HASH_ROUTING is false', () => {
    vi.stubEnv('VITE_USE_HASH_ROUTING', 'false');
    expect(getRouterMode()).toBe('browser');
  });

  it('should default to "browser" in development mode when not overridden', () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITE_USE_HASH_ROUTING', 'true');
    expect(getRouterMode()).toBe('browser');
  });

  it('should default to "hash" in production mode when not overridden', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_USE_HASH_ROUTING', 'false');
    expect(getRouterMode()).toBe('hash');
  });
});

describe('getBasePath', () => {
  it('returns the base path statically injected by Vite', () => {
    expect(getBasePath()).toBe('/');
  });
});
