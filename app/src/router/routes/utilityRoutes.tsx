/**
 * Utility Routes for TanStack Router
 *
 * Includes:
 * - /tags - Tag list and search
 * - /tags/:uuid - Tag detail page
 * - /plugin-loaders - Plugin registry
 */

import { createRoute } from '@tanstack/react-router';
import PluginsRoute from './plugins.js';
import { rootRoute } from './rootRoute.js';
import TagDetailRoute from './tags.($uuid).js';
// Import existing components from React Router routes
import TagsRoute from './tags.js';

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
  path: '/plugin-loaders',
  component: PluginsRoute,
});
