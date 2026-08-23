import { createRoute } from '@tanstack/react-router';
import MapExportPage from './map-export/MapExportPage.js';
import { rootRoute } from './rootRoute.js';

export const mapExportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/map-export',
  component: MapExportPage,
});
