/**
 * Utility Routes for TanStack Router
 *
 * Includes:
 * - /plugin-loaders - Plugin registry
 */

import { createRoute } from '@tanstack/react-router';
import PluginsRoute from './plugins.js';
import { rootRoute } from './rootRoute.js';

export const pluginsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plugin-loaders',
  component: PluginsRoute,
});
