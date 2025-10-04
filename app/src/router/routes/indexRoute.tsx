/**
 * Index Route (Home Page) for TanStack Router
 * 
 * Displays the landing page with tree type selection
 */

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './rootRoute.js';
import HomePage from '../../pages/Home/HomePage.js';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});
