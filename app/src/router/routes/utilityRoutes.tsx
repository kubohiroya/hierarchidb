/**
 * Utility Routes for TanStack Router
 * 
 * Includes:
 * - /tags - Tag list and search
 * - /tags/:uuid - Tag detail page
 * - /plugins - Plugin registry
 */

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './rootRoute.js';

// Import existing components from React Router routes
import TagsRoute from '../../routes/tags.js';
import TagDetailRoute from '../../routes/tags.($uuid).js';
import PluginsRoute from '../../routes/plugins.js';

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
