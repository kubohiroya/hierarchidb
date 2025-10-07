/**
 * Utility Routes for TanStack Router
 * 
 * Includes:
 * - /tags - Tag list and search
 * - /tags/:uuid - Tag detail page
 * - /plugin-loader - Plugin registry
 */

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './rootRoute.js';

// Import existing components from React Router routes
import TagsRoute from './tags.js';
import TagDetailRoute from './tags.($uuid).js';
import PluginsRoute from './plugins.js';

export const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tags',
  component: TagsRoute,
});

export const tagDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tags/$uuid',
  component: () => {
    const { uuid } = tagDetailRoute.useParams();
    return <TagDetailRoute uuid={uuid} />;
  },
});

export const pluginsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plugin-loader',
  component: PluginsRoute,
});
