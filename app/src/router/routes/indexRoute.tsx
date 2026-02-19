/**
 * Index Route (home Page) for TanStack Router
 *
 * Displays the landing page with console type selection
 */

import { createRoute } from '@tanstack/react-router';
import HomePage from '~/router/pages/home/HomePage';
import { rootRoute } from './rootRoute.js';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});
