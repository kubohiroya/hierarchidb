import { createRoute } from '@tanstack/react-router';
import MaintenancePage from '~/router/pages/maintenance/MaintenancePage';
import { rootRoute } from './rootRoute.js';

export const maintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/maintenance',
  component: MaintenancePage,
});
