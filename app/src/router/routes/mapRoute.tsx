/**
 * Map Route for TanStack Router
 *
 * Displays the map page with URL-synchronized position
 */

import { createRoute } from '@tanstack/react-router';
import {
  type MapSearch,
  type MapViewState,
  mapLoader,
  normalizeMapSearch,
} from '~/router/loaders/mapLoader';
// Import the existing map page component
import MapPage from './map.js';
import { rootRoute } from './rootRoute.js';

export const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/map/$nodeId',
  validateSearch: (search: Record<string, unknown>): MapSearch => {
    return normalizeMapSearch(search);
  },
  loaderDeps: ({ search }) => ({ zxy: search.zxy }),
  loader: ({ deps }): MapViewState => {
    return mapLoader({ zxy: deps.zxy });
  },
  component: MapPage,
});
