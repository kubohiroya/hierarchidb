/**
 * Map Route for TanStack Router
 * 
 * Displays the map page with URL-synchronized position
 */

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './rootRoute.js';
import { mapLoader, type MapViewState } from '../loaders/mapLoader.js';

// Import the existing map page component
import MapPage from '../../routes/map.js';

interface MapSearch {
  zxy?: string;
}

export const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/map',
  validateSearch: (search: Record<string, unknown>): MapSearch => {
    return {
      zxy: typeof search.zxy === 'string' ? search.zxy : undefined,
    };
  },
  loaderDeps: ({ search }) => ({ zxy: search.zxy }),
  loader: ({ deps }): MapViewState => {
    return mapLoader({ zxy: deps.zxy });
  },
  component: MapPage,
});
