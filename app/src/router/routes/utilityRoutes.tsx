/**
 * Utility Routes for TanStack Router
 * 
 * Includes:
 * - /tags - Tag list and search
 * - /tags/:uuid - Tag detail page
 * - /plugins - Plugin registry
 * - /plugin-demo - Plugin demo page
 * - /worker-test - Worker API test page
 * - /test - Simple test page
 */

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './rootRoute.js';

// Import existing components from React Router routes
import TagsRoute from '../../routes/tags.js';
import TagDetailRoute from '../../routes/tags.($uuid).js';
import PluginsRoute from '../../routes/plugins.js';
import PluginDemoRoute from '../../routes/plugin-demo.js';
import WorkerTestRoute from '../../routes/worker-test.js';
import TestRoute from '../../routes/test.js';

export const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tags',
  component: TagsRoute,
});

export const tagDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tags/$uuid',
  component: TagDetailRoute,
});

export const pluginsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plugins',
  component: PluginsRoute,
});

export const pluginDemoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plugin-demo',
  component: PluginDemoRoute,
});

export const workerTestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/worker-test',
  component: WorkerTestRoute,
});

export const testRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/test',
  component: TestRoute,
});
