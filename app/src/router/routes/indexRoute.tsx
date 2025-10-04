/**
 * Index Route (Home Page) for TanStack Router
 * 
 * Displays the landing page with tree type selection
 */

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './rootRoute.js';

// Import the existing home page component from React Router routes
// We'll reuse this component as-is for now
import IndexPage from '../../routes/_index.js';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});
